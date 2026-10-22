// Service worker de comercIA. Conservador a propósito:
// - Los datos (/api) y el detector de despliegues van siempre a la red.
// - Los archivos de /_next/static llevan hash en el nombre: se guardan y se
//   sirven desde el dispositivo (nunca cambian).
// - Las pantallas se piden primero a la red; sin señal se muestra la última
//   versión guardada o la página "Sin conexión".
const VERSION = "v1";
const CACHE_ESTATICOS = `comercia-estaticos-${VERSION}`;
const CACHE_PAGINAS = `comercia-paginas-${VERSION}`;
const SIN_CONEXION = "/sin-conexion";
const MAX_ESTATICOS = 300;
const MAX_PAGINAS = 30;

self.addEventListener("install", (evento) => {
  evento.waitUntil(
    caches
      .open(CACHE_PAGINAS)
      .then((cache) => cache.add(SIN_CONEXION))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (evento) => {
  evento.waitUntil(
    caches
      .keys()
      .then((nombres) =>
        Promise.all(
          nombres
            .filter(
              (nombre) =>
                nombre.startsWith("comercia-") &&
                nombre !== CACHE_ESTATICOS &&
                nombre !== CACHE_PAGINAS,
            )
            .map((nombre) => caches.delete(nombre)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

async function recortar(nombreCache, maximo) {
  const cache = await caches.open(nombreCache);
  const claves = await cache.keys();
  // keys() respeta el orden de inserción: se van los más viejos.
  await Promise.all(
    claves.slice(0, Math.max(0, claves.length - maximo)).map((c) => cache.delete(c)),
  );
}

async function estatico(pedido) {
  const cache = await caches.open(CACHE_ESTATICOS);
  const guardado = await cache.match(pedido);
  if (guardado) return guardado;
  const respuesta = await fetch(pedido);
  if (respuesta.ok) {
    await cache.put(pedido, respuesta.clone());
    void recortar(CACHE_ESTATICOS, MAX_ESTATICOS);
  }
  return respuesta;
}

async function pantalla(pedido) {
  const clave = new URL(pedido.url);
  clave.search = "";
  try {
    const respuesta = await fetch(pedido);
    if (respuesta.ok && respuesta.type === "basic") {
      const cache = await caches.open(CACHE_PAGINAS);
      await cache.put(clave.href, respuesta.clone());
      void recortar(CACHE_PAGINAS, MAX_PAGINAS);
    }
    return respuesta;
  } catch (error) {
    const cache = await caches.open(CACHE_PAGINAS);
    const guardada = (await cache.match(clave.href)) ?? (await cache.match(SIN_CONEXION));
    if (guardada) return guardada;
    throw error;
  }
}

// La app pide guardar pantallas que tienen que abrir sin señal aunque nunca se
// hayan cargado completas (se llega a ellas navegando dentro de la app).
self.addEventListener("message", (evento) => {
  const datos = evento.data;
  if (datos?.tipo !== "guardar-pantallas" || !Array.isArray(datos.rutas)) return;
  const rutas = datos.rutas.filter((r) => typeof r === "string" && r.startsWith("/panel/"));
  evento.waitUntil(
    caches
      .open(CACHE_PAGINAS)
      .then((cache) =>
        Promise.all(
          rutas.map(async (ruta) => {
            const url = new URL(ruta, self.location.origin).href;
            const respuesta = await fetch(url);
            if (respuesta.ok && respuesta.type === "basic" && !respuesta.redirected)
              await cache.put(url, respuesta);
          }),
        ),
      )
      .then(() => recortar(CACHE_PAGINAS, MAX_PAGINAS))
      .catch(() => undefined),
  );
});

self.addEventListener("fetch", (evento) => {
  const pedido = evento.request;
  if (pedido.method !== "GET" || pedido.cache === "no-store") return;
  const url = new URL(pedido.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/")) return;
  if (url.searchParams.has("_comercia_dpl")) return;
  if (url.pathname.startsWith("/_next/static/")) {
    evento.respondWith(estatico(pedido));
    return;
  }
  if (pedido.mode === "navigate") evento.respondWith(pantalla(pedido));
});
