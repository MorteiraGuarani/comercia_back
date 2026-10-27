import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import * as jsx from "react/jsx-runtime";

// Ejecuta los componentes y sus callbacks reales sin navegador, servidor ni red.
function cargar(ruta, dependencias = {}, extra = "") {
  const codigo = ts.transpileModule(readFileSync(new URL(`../src/${ruta}`, import.meta.url), "utf8"), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  const modulo = { exports: {} };
  vm.runInThisContext(`(function(module, exports, require) {${codigo}\n${extra}\n})`)(modulo, modulo.exports, (nombre) => {
    if (nombre === "react/jsx-runtime") return jsx;
    assert.ok(nombre in dependencias, `Dependencia sin simular: ${nombre}`);
    return dependencias[nombre];
  });
  return modulo.exports;
}

function estadoReact(iniciales = {}) {
  const valores = [];
  const efectos = [];
  let indice = 0;
  return {
    iniciar() { indice = 0; },
    valores,
    efectos,
    react: {
      useState(inicial) {
        const i = indice++;
        if (!(i in valores)) valores[i] = i in iniciales ? iniciales[i] : typeof inicial === "function" ? inicial() : inicial;
        return [valores[i], (valor) => { valores[i] = typeof valor === "function" ? valor(valores[i]) : valor; }];
      },
      useId: () => `id-${indice++}`,
      useRef: () => ({ current: null }),
      useMemo: (calcular) => calcular(),
      useEffect: (efecto) => efectos.push(efecto),
    },
  };
}
function nodos(nodo) {
  if (!nodo || typeof nodo !== "object") return [];
  if (Array.isArray(nodo)) return nodo.flatMap(nodos);
  return [nodo, ...nodos(nodo.props?.children)];
}
function texto(nodo) {
  if (nodo == null || typeof nodo === "boolean") return "";
  if (Array.isArray(nodo)) return nodo.map(texto).join("");
  return typeof nodo === "object" ? texto(nodo.props?.children) : String(nodo);
}
const fechas = cargar("utils/fechas.ts");
const periodos = cargar("utils/periodo-inicio.ts", { "./fechas": fechas });
const hoy = "2026-10-27";
const presets = periodos.periodosDesdeHoy(hoy);
assert.deepEqual(presets.map((p) => p.etiqueta), ["Hoy", "Ayer", "Semana", "Mes", "Mes Pasado"]);
assert.deepEqual(presets.map((p) => periodos.consultaPeriodoInicio(p, hoy)), [
  "fecha=2026-10-27", "fecha=2026-10-26", "fechaInicio=2026-10-26&fechaFin=2026-10-27",
  "fechaInicio=2026-10-01&fechaFin=2026-10-27", "fechaInicio=2026-09-01&fechaFin=2026-09-30",
]);
for (const [fecha, inicio, fin] of [["2026-01-01", "2025-12-01", "2025-12-31"], ["2024-03-01", "2024-02-01", "2024-02-29"]]) {
  assert.equal(periodos.consultaPeriodoInicio(periodos.periodosDesdeHoy(fecha)[4], fecha), `fechaInicio=${inicio}&fechaFin=${fin}`);
}
assert.equal(periodos.consultaPeriodoInicio(presets[0], "2026-10-28"), "fecha=2026-10-28", "Hoy se actualiza al cambiar de día");

const estado = estadoReact();
let elegido = null;
const { SelectorFechaFiltro } = cargar("components/campo/ui/selector-fecha-filtro.tsx", {
  react: estado.react, "@/utils/fechas": { ...fechas, fechaEnZonaIso: () => hoy }, "@/utils/periodo-inicio": periodos,
});
const render = () => { estado.iniciar(); return SelectorFechaFiltro({ valorActual: presets[0], onChange: (p) => { elegido = p; } }); };
const boton = (arbol, nombre) => nodos(arbol).find((n) => n.type === "button" && texto(n).startsWith(nombre));
let arbol = render();
boton(arbol, "Período:").props.onClick();
arbol = render();
assert.deepEqual(nodos(arbol).filter((n) => n.type === "button" && "aria-pressed" in n.props).map(texto), presets.map((p) => p.etiqueta));
let acordeon = boton(arbol, "Fecha personalizada");
assert.equal(acordeon.props["aria-expanded"], false);
assert.equal(nodos(arbol).find((n) => n.props?.id === acordeon.props["aria-controls"]).props.hidden, true);
const orden = nodos(arbol);
assert.ok(orden.indexOf(boton(arbol, "Mes Pasado")) < orden.indexOf(acordeon));
acordeon.props.onClick();
arbol = render();
assert.equal(boton(arbol, "Fecha personalizada").props["aria-expanded"], true);
const inputs = nodos(arbol).filter((n) => n.type === "input");
inputs[0].props.onChange({ target: { value: "2026-10-18" } });
inputs[1].props.onChange({ target: { value: "2026-10-05" } });
arbol = render();
boton(arbol, "Aplicar rango").props.onClick();
assert.equal(periodos.consultaPeriodoInicio(elegido, hoy), "fechaInicio=2026-10-05&fechaFin=2026-10-18");
arbol = render();
boton(arbol, "Período:").props.onClick();
arbol = render();
assert.equal(boton(arbol, "Fecha personalizada").props["aria-expanded"], false, "El rango vuelve a estar plegado al abrir");
boton(arbol, "Mes Pasado").props.onClick();
assert.equal(elegido.clave, "mes_pasado");

async function disponibilidad(responder) {
  const pedidos = [];
  const signal = new AbortController().signal;
  const { hayTareasAsignadas } = cargar("lib/disponibilidad-tareas.ts", {
    "./api": { apiFetch: async (ruta, opciones) => { assert.equal(opciones.signal, signal); pedidos.push(ruta); return responder(ruta); } },
  });
  return { disponible: await hayTareasAsignadas("fecha=2026-10-27", signal), pedidos };
}
assert.equal((await disponibilidad(() => ({ items: [], totalPages: 0 }))).disponible, false);
const segunda = await disponibilidad((ruta) => ruta.includes("asignaciones=")
  ? { items: [{ total: ruta.includes("asignaciones=2") ? 1 : 0 }] }
  : { items: [{ id: ruta.includes("page=2") ? 2 : 1 }], totalPages: 3 });
assert.equal(segunda.disponible, true, "Encuentra tareas en locales fuera de la primera página");
assert.equal(segunda.pedidos.length, 4, "Deja de consultar apenas encuentra una asignación");
await assert.rejects(disponibilidad(() => { throw new Error("Sin red"); }), /Sin red/);

const stub = () => null;
const Link = stub;
const { EnlacePanel } = cargar("components/panel/enlace-panel.tsx", { "next/link": { default: Link } });
const sinEnlace = EnlacePanel({ href: "/panel/mi-jornada/tareas", disabled: true, children: "Mis tareas" });
assert.equal(sinEnlace.type, "button");
assert.equal(sinEnlace.props.disabled, true);
assert.equal(sinEnlace.props.href, undefined);
assert.equal(EnlacePanel({ href: "/panel/mi-jornada/tareas", children: "Mis tareas" }).props.href, "/panel/mi-jornada/tareas");
const ui = cargar("components/campo/ui/tablero-campo.tsx", { "next/link": { default: Link }, "./iconos-campo": {} });
assert.equal(ui.TarjetaIndicador({ letra: "C", nombre: "Tareas", tono: "info", valor: 0, nota: "Sin tareas", href: "/tareas", disabled: true }).props.disabled, true);

const resumen = {
  presentismo: { totalEquipo: 1, estados: { PRESENTE: 1, TARDE: 0, INCOMPLETO: 0, AUSENTE: 0, SIN_REGISTRO: 0 } },
  rutas: { total: 0, completadas: 0, enCurso: 0, incompletas: 0, ausentes: 0, pendientes: 0 },
  tareas: { total: 0, completadas: 0, obligatoriasPendientes: 0, pct: 0 }, colaboradores: [],
};
const calculos = cargar("utils/hoy-en-campo.ts", { "./fechas": fechas });
const estadoPresentismo = estadoReact();
let personaAbierta = null;
const { DetallePresentismoInicio } = cargar("components/campo/detalle-presentismo-inicio.tsx", {
  react: estadoPresentismo.react, "@/components/paginacion": { Paginacion: stub },
  "@/utils/hoy-en-campo": calculos, "./ui/tablero-campo": ui, "./ui/iconos-campo": { IconoTelefono: stub },
});
const equipoPresentismo = ["PRESENTE", "TARDE", "INCOMPLETO", "AUSENTE", "SIN_REGISTRO"].map((estado, i) => ({
  id: i + 1, nombre: `Persona ${estado}`, estadoPresentismo: estado, telefono: "+595991188620", inicioJornada: null,
}));
const renderPresentismo = () => {
  estadoPresentismo.iniciar();
  return DetallePresentismoInicio({
    resumen: { presentismo: { totalEquipo: 5, estados: Object.fromEntries(equipoPresentismo.map((c) => [c.estadoPresentismo, 1])) } },
    equipo: equipoPresentismo, onAbrir: (id) => { personaAbierta = id; },
  });
};
let detallePresentismo = renderPresentismo();
const filtrosPresentismo = (arbol) => nodos(arbol).filter((n) => n.type === "button" && "aria-pressed" in n.props);
assert.equal(filtrosPresentismo(detallePresentismo).length, 4);
assert.ok(filtrosPresentismo(detallePresentismo).every((n) => n.props["aria-label"].includes("20%, 1 de 5")));
filtrosPresentismo(detallePresentismo)[2].props.onClick();
detallePresentismo = renderPresentismo();
assert.equal(nodos(detallePresentismo).filter((n) => n.type === "li").length, 1);
const personaIncompleta = nodos(detallePresentismo).find((n) => n.type === "button" && texto(n) === "Persona INCOMPLETO");
assert.ok(personaIncompleta);
personaIncompleta.props.onClick();
assert.equal(personaAbierta, 3);
filtrosPresentismo(detallePresentismo)[3].props.onClick();
detallePresentismo = renderPresentismo();
const llamada = nodos(detallePresentismo).find((n) => n.type === "a");
assert.equal(llamada.props.href, "tel:+595991188620");
assert.equal(llamada.props["aria-label"], "Llamar a Persona AUSENTE");
assert.equal(texto(llamada), "", "El enlace de llamada muestra solo un icono");
filtrosPresentismo(detallePresentismo)[3].props.onClick();
assert.equal(nodos(renderPresentismo()).filter((n) => n.type === "li").length, 5, "Tocar el filtro activo vuelve a todas las marcaciones");
const panel = {
  usuario: { id: 1, nombre: "Ana", empresa: { nombre: "Empresa" } },
  modulos: [{ ruta: "mi-jornada", paginas: ["locales", "tareas", "novedades"].map((ruta) => ({ ruta })) }],
  tareasDisponibles: { "mi-jornada": false },
};
const comun = {
  "next/link": { default: Link }, "@/components/panel/contexto": { usePanel: () => panel },
  "@/lib/api": {}, "@/utils/fechas": { ...fechas, fechaEnZonaIso: () => hoy }, "@/utils/periodo-inicio": periodos,
  "./ui/tablero-campo": ui, "./ui/barra-segmentos": { BarraSegmentos: stub }, "./ui/iconos-campo": {},
  "./ui/periodo-inicio": { SelectorPeriodoInicio: stub }, "@/utils/hoy-en-campo": calculos, "@/utils/estado-jornada": { RUTA: {} },
};
const { Indicadores, DetalleIndicador } = cargar("components/campo/hoy-en-campo.tsx", {
  ...comun, react: estadoReact().react, "@/lib/cache-sesion": {}, "@/components/modal": {}, "./hilo-novedad": {}, "./detalle-presentismo-inicio": { DetallePresentismoInicio },
}, "module.exports.Indicadores = Indicadores; module.exports.DetalleIndicador = DetalleIndicador;");
const propsIndicador = { indicador: "presentismo", resumen, equipo: [], novedades: [], abiertas: 0, onAbrir: stub };
assert.equal(DetalleIndicador({ ...propsIndicador, presentismoImpulsador: true }).type, DetallePresentismoInicio);
assert.notEqual(DetalleIndicador(propsIndicador).type, DetallePresentismoInicio, "Conserva la vista de Presentismo de los demás equipos");
const tarjetasEquipo = nodos(Indicadores({ resumen, novedades: [], abiertas: 0, cuando: "hoy", onAbrir: stub })).filter((n) => n.type === ui.TarjetaIndicador);
assert.deepEqual(tarjetasEquipo.map((n) => n.props.nombre), ["Presentismo", "Mi Ruta", "Tareas", "Novedades"]);
assert.equal(tarjetasEquipo[2].props.disabled, true);
resumen.tareas.total = 1;
assert.equal(nodos(Indicadores({ resumen, novedades: [], abiertas: 0, cuando: "hoy", onAbrir: stub })).find((n) => n.props?.nombre === "Tareas").props.disabled, false);

const estadoMiDia = estadoReact({ 3: { agenda: [], abierta: null, tareas: null, hayTareas: null, novedadesAbiertas: 0, avisos: null, actualizado: "2026-10-27T12:00:00Z" } });
const { MiDiaCampo } = cargar("components/campo/mi-dia-campo.tsx", {
  ...comun, react: estadoMiDia.react, "@/utils/tareas-campo": {}, "@/lib/disponibilidad-tareas": {},
});
const tarjetasPropias = nodos(MiDiaCampo()).filter((n) => n.type === ui.TarjetaIndicador);
assert.deepEqual(tarjetasPropias.map((n) => n.props.nombre), ["Presentismo", "Mi Ruta", "Tareas", "Novedades"]);
assert.equal(tarjetasPropias[2].props.disabled, true);
panel.tareasDisponibles["mi-jornada"] = true;
estadoMiDia.iniciar();
assert.equal(nodos(MiDiaCampo()).find((n) => n.props?.nombre === "Tareas").props.disabled, false, "Tener tareas habilita el KPI aunque no haya una visita abierta");
panel.tareasDisponibles["mi-jornada"] = false;

const estadoGeneral = estadoReact({ 0: resumen, 1: 2, 2: 0, 11: `0|fecha=${hoy}` });
const { InicioResumen } = cargar("app/panel/page.tsx", {
  ...comun, react: estadoGeneral.react,
  "@/components/panel/enlace-panel": { EnlacePanel },
  "@/components/campo/hoy-en-campo": {}, "@/components/campo/mi-dia-campo": {},
  "@/components/campo/ui/iconos-campo": {}, "@/components/campo/ui/periodo-inicio": {},
  "@/utils/nombres-menu": cargar("utils/nombres-menu.ts"), "@/lib/disponibilidad-tareas": {},
}, "module.exports.InicioResumen = InicioResumen;");
const general = (ruta, paginas) => {
  estadoGeneral.iniciar();
  return nodos(InicioResumen({ modulo: { ruta, paginas: paginas.map((ruta) => ({ ruta })) } })).filter((n) => n.props?.label);
};
assert.deepEqual(general("gestion-campo", ["visitas", "tareas", "novedades"]).map((n) => n.props.label), ["Presentismo", "Mi Ruta", "Tareas", "Novedades"]);
const generalPropio = general("mi-jornada", ["locales", "tareas", "novedades"]);
assert.deepEqual(generalPropio.map((n) => n.props.label), ["Presentismo", "Mi Ruta", "Tareas", "Novedades"]);
assert.equal(generalPropio[2].props.disabled, true);

// La disponibilidad sigue permisos y empresa/usuario de la sesión, para cualquier rol.
async function comprobarRol(modulos, { conTareas = false, error = false } = {}) {
  const estado = estadoReact();
  const pedidos = [];
  const ventanaAnterior = globalThis.window;
  globalThis.window = new EventTarget();
  try {
    const { useDisponibilidadTareas: consultarEstado } = cargar("hooks/use-disponibilidad-tareas.ts", {
      react: estado.react, "./use-fecha-campo": { useFechaCampo: () => hoy },
      "@/lib/eventos-plataforma": { EVENTO_PLATAFORMA_ACTUALIZADA: "plataforma" },
      "@/lib/api": { apiFetch: async (ruta) => {
        pedidos.push(ruta);
        if (error) throw new Error("Sin red");
        return ruta.includes("supervision") ? { tareas: { total: conTareas ? 1 : 0 } } : { total: conTareas ? 1 : 0 };
      } },
      "@/lib/disponibilidad-tareas": { hayTareasAsignadas: async () => {
        pedidos.push("propias");
        if (error) throw new Error("Sin red");
        return conTareas;
      } },
    });
    assert.deepEqual(consultarEstado(1, modulos, "/panel"), {});
    const limpiezas = estado.efectos.map((efecto) => efecto()).filter(Boolean);
    await new Promise((resolver) => setImmediate(resolver));
    estado.iniciar();
    const valor = consultarEstado(1, modulos, "/panel");
    estado.iniciar();
    assert.deepEqual(consultarEstado(2, modulos, "/panel"), {}, "No reutiliza disponibilidad de otra cuenta");
    limpiezas.forEach((limpiar) => limpiar());
    return { valor, pedidos };
  } finally { globalThis.window = ventanaAnterior; }
}
const modulo = (ruta, paginas) => ({ ruta, paginas: paginas.map((ruta) => ({ ruta })) });
const personal = [modulo("mi-jornada", ["locales", "tareas"])];
assert.equal((await comprobarRol(personal)).valor["mi-jornada"], false);
assert.equal((await comprobarRol(personal, { conTareas: true })).valor["mi-jornada"], true);
assert.deepEqual((await comprobarRol(personal, { error: true })).valor, {}, "Error de red conserva estado desconocido");
const lider = await comprobarRol([modulo("gestion-campo", ["visitas", "tareas"])]);
assert.equal(lider.valor["gestion-campo"], false);
assert.ok(lider.pedidos[0].includes("supervision/resumen"));
const gestor = await comprobarRol([modulo("gestion-campo", ["tareas"])]);
assert.equal(gestor.valor["gestion-campo"], false);
assert.ok(gestor.pedidos[0].startsWith("/campo/tareas?"));
assert.deepEqual((await comprobarRol([modulo("mi-jornada", ["locales"])])).pedidos, [], "No consulta páginas sin permiso");

console.log("OK: calendario, asignaciones, KPI y accesos; Presentismo del impulsador con cuatro filtros, porcentajes y llamada por icono.");
