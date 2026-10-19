import "fake-indexeddb/auto";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import Dexie from "dexie";

// Se evalúa en el mismo realm que Dexie: sus transacciones siguen las promesas
// nativas del módulo y fallarían con un contexto vm separado.
const modulos = new Map();
class ApiError extends Error {
  constructor(status, mensaje) { super(mensaje); this.status = status; }
}
const llamadas = [];
let responder = null;
async function apiFetch(ruta) {
  llamadas.push(ruta);
  return responder();
}
function cargar(ruta) {
  if (modulos.has(ruta)) return modulos.get(ruta);
  const fuente = readFileSync(new URL(`../src/${ruta}.ts`, import.meta.url), "utf8");
  const js = ts.transpileModule(fuente, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
  }).outputText;
  const modulo = { exports: {} };
  const requerir = (nombre) => {
    if (nombre === "dexie") return { default: Dexie, __esModule: true };
    if (nombre === "./api") return { apiFetch, ApiError };
    return cargar(nombre.replace(/^@\//, ""));
  };
  vm.runInThisContext(`(function (require, module, exports) {${js}\n})`)(requerir, modulo, modulo.exports);
  modulos.set(ruta, modulo.exports);
  return modulo.exports;
}

// Reloj que avanza en cada lectura: ordena los elegidos sin depender del tiempo real.
let reloj = Date.UTC(2026, 9, 16, 12);
Date.now = () => ++reloj;

// Un navegador con la copia v1 (un artículo por código) debe volver a descargar.
const vieja = new Dexie("comercia-inventario");
vieja.version(1).stores({ items: "[empresaId+itemcode], empresaId", elegidos: "[usuarioId+itemcode], [usuarioId+agregadoEn]", catalogos: "empresaId" });
await vieja.table("catalogos").put({ empresaId: 10, sincronizadoEn: Date.now(), total: 1 });
await vieja.table("items").put({ empresaId: 10, itemcode: "X", itemname: "Viejo", busqueda: "x viejo" });
vieja.close();

const lib = cargar("lib/inventario-db");
const { catalogoDesactualizado, detalleListaPrecio, ordenItemInventario } = cargar("utils/inventario");
const claves = [["A", -1], ["A", 0], ["A", 2], ["A", 10], ["A-1", 1], ["A-10", 1]].map(([itemcode, pricelist]) => ordenItemInventario({ itemcode, pricelist }));
assert.deepEqual([...claves].sort(), claves, "Ordena por código y lista, también con listas negativas");
assert.equal(await lib.leerCatalogo(10), null, "La copia v1 no cuenta como descargada");

// 60 artículos en 2 listas de precios: 120 filas de tbl_itm1.
const catalogo = Array.from({ length: 60 }, (_, i) => [1, 2].map((lista) => ({
  id: String(i * 2 + lista),
  itemcode: `A-${String(i + 1).padStart(3, "0")}`,
  itemname: i === 4 ? "Carne Picada Especial" : `Artículo ${i + 1}`,
  pricelist: lista,
  pricelistname: lista === 1 ? "Minorista" : null,
  price: lista === 1 ? "25000.000000" : null,
}))).flat();
const completo = (lista) => () => ({ items: lista, total: lista.length });

responder = completo([...catalogo, catalogo[0]]);
const [primera, repetida] = [lib.sincronizarCatalogo(10), lib.sincronizarCatalogo(10)];
assert.equal(primera, repetida, "Dos pedidos simultáneos comparten la misma descarga");
const estado = await primera;
assert.deepEqual([estado.total, estado.articulos], [120, 60], "Guarda cada artículo en cada lista, una sola vez por fila");
assert.deepEqual(llamadas, ["/campo/inventario/items"], "Un solo pedido, sin paginar");
assert.deepEqual(await lib.leerCatalogo(10), estado);

const busqueda = await lib.buscarItems(10, "carne  PICADA", 1, 7);
assert.deepEqual(busqueda.items.map((i) => [i.itemcode, i.pricelist]), [["A-005", 1], ["A-005", 2]], "Muestra el artículo en todas sus listas");
assert.equal((await lib.buscarItems(10, "minorista", 1, 7)).total, 60, "Busca por nombre de lista");
assert.equal((await lib.buscarItems(10, "articulo", 1, 7)).total, 118, "Busca sin acentos");
const pagina3 = await lib.buscarItems(10, "", 3, 7);
assert.deepEqual([pagina3.total, pagina3.totalPages, pagina3.items[0].itemcode, pagina3.items[0].pricelist], [120, 18, "A-008", 1]);
assert.equal((await lib.buscarItems(20, "", 1, 7)).total, 0, "Cada empresa conserva su catálogo");

// Una descarga fallida conserva la copia anterior completa.
responder = () => { throw new ApiError(0, "No se pudo conectar con el servidor"); };
await assert.rejects(lib.sincronizarCatalogo(10), /No se pudo conectar/);
assert.deepEqual(await lib.leerCatalogo(10), estado);
assert.equal((await lib.buscarItems(10, "", 1, 7)).total, 120);

// Una descarga completa reemplaza filas retiradas del catálogo.
responder = completo(catalogo.slice(0, 60));
assert.deepEqual(Object.values(await lib.sincronizarCatalogo(10)).slice(2), [60, 30]);
assert.equal((await lib.buscarItems(10, "", 1, 7)).total, 60);

// Elegidos: por usuario y por lista, sin duplicados, últimos primero.
for (const item of catalogo.slice(0, 8)) await lib.agregarElegido(8, 10, item);
await lib.agregarElegido(8, 10, catalogo[0]);
await lib.agregarElegido(9, 10, catalogo[9]);
let elegidos = await lib.listarElegidos(8, 10, 1, 7);
assert.deepEqual([elegidos.total, elegidos.totalPages, elegidos.items[0].id], [8, 2, "8"]);
assert.deepEqual([...(await lib.idsElegidos(8, 10))].sort(), ["1", "2", "3", "4", "5", "6", "7", "8"], "El mismo artículo se elige en cada lista");
assert.deepEqual([...(await lib.idsElegidos(9, 10))], ["10"], "Otro usuario no ve la selección ajena");
await lib.quitarElegido(8, "1");
elegidos = await lib.listarElegidos(8, 10, 2, 7);
assert.deepEqual([elegidos.page, elegidos.total, elegidos.items.length], [1, 7, 7], "Vuelve a la última página con datos");
assert.equal((await lib.idsElegidos(8, 10)).has("2"), true, "Quitar una lista conserva la otra del mismo artículo");

assert.equal(detalleListaPrecio(catalogo[0]), "Minorista · 25.000");
assert.equal(detalleListaPrecio(catalogo[1]), "Lista 2 · Sin precio");

// Renovación diaria según el día calendario del equipo.
const noche = new Date(2026, 9, 15, 23, 0).getTime();
assert.equal(catalogoDesactualizado(undefined, noche), true);
assert.equal(catalogoDesactualizado(noche, new Date(2026, 9, 15, 23, 59).getTime()), false);
assert.equal(catalogoDesactualizado(noche, new Date(2026, 9, 16, 7, 0).getTime()), true);

console.log("OK: todas las filas artículo + lista en un pedido, migración v1, copia previa ante fallos y elegidos por lista");
