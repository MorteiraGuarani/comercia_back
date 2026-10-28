import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import * as jsx from "react/jsx-runtime";

// Componentes y callbacks reales, con red, GPS y Maps simulados. No usa navegador.
function cargar(ruta, deps = {}, extra = "", ambiente = {}) {
  const js = ts.transpileModule(readFileSync(new URL(`../src/${ruta}`, import.meta.url), "utf8"), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  const modulo = { exports: {} };
  vm.runInThisContext(`(function(module, exports, require, navigator, window) {${js}\n${extra}\n})`)(modulo, modulo.exports, (nombre) => {
    if (nombre === "react/jsx-runtime") return jsx;
    assert.ok(nombre in deps, `Dependencia sin simular: ${nombre}`);
    return deps[nombre];
  }, ambiente.navigator, ambiente.window);
  return modulo.exports;
}
const stub = () => null;
const iconos = new Proxy({}, { get: () => stub });
const fechas = cargar("utils/fechas.ts");
const estados = cargar("utils/estado-jornada.ts");
const { EstadoRutaSimple } = cargar("components/campo/ui/estado-ruta-simple.tsx", { "@/utils/estado-jornada": estados });
const distancia = cargar("utils/distancia.ts");
const ruta = cargar("utils/ruta-recomendada.ts", { "./distancia": distancia });
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
const botones = (arbol) => nodos(arbol).filter((n) => n.type === "button");
const boton = (arbol, nombre) => botones(arbol).find((n) => texto(n).trim() === nombre);
const hoy = "2026-10-27";
const agenda = (id, estado = "pendiente") => ({
  id, estado, estadoPresentismo: "SIN_REGISTRO", esBackup: false, titular: "Titular", visitas: [],
  local: { id: `C${id}`, nombre: `Local ${id}`, direccion: `Calle ${id}`, latitud: -25.3 + id / 1000, longitud: -57.6, horarios: [{ id, entrada: "08:00", salida: "18:00" }] },
});
let consultarTareas = null;
let novedades = 0;
let entradas = 0;
let salidas = 0;
let inventarios = 0;
const { TarjetaAgendaRepositor } = cargar("components/campo/tarjeta-agenda-repositor.tsx", {
  "next/link": { default: stub }, "@/utils/estado-jornada": estados, "@/utils/fechas": fechas, "@/utils/duracion": cargar("utils/duracion.ts"), "@/components/ui": { colorFinalizar: "" },
  "@/hooks/use-resumen-tareas-local": { useResumenTareasLocal: (...args) => { consultarTareas = args[3]; return args[3] ? { hechas: 1, total: 3 } : null; } },
  "./ui/status-stamp": { StatusStamp: stub }, "./ui/estado-ruta-simple": { EstadoRutaSimple }, "./ui/foto-local": { FotoLocal: stub }, "./ui/texto-expandible": { TextoExpandible: ({ texto }) => texto }, "./ui/iconos-campo": iconos,
});
const base = { agenda: agenda(1), orden: 1, abierta: true, alternar: stub, qsFecha: `fecha=${hoy}`, visitaAbierta: null, onMapa: stub, onNovedad: () => { novedades++; } };
let tarjeta = TarjetaAgendaRepositor({ ...base, soloConsulta: true });
assert.equal(consultarTareas, false, "El impulsador no hace consultas de tareas al desplegar el local");
assert.equal(boton(tarjeta, "Iniciar Visita"), undefined);
assert.equal(boton(tarjeta, "Finalizar Visita"), undefined);
assert.equal(boton(tarjeta, "Tareas"), undefined);
assert.equal(boton(tarjeta, "Inventario"), undefined);
assert.ok(texto(tarjeta).includes("08:00–18:00"), "Conserva los horarios del impulsador");
assert.equal(boton(tarjeta, "Novedad").props.disabled, true, "Sin visita iniciada no se reporta novedad");
const enCurso = { ...base.agenda, visitas: [{ id: 9, estado: "EN_CURSO", entrada: `${hoy}T11:00:00Z`, salida: null }] };
tarjeta = TarjetaAgendaRepositor({ ...base, agenda: enCurso, soloConsulta: true });
assert.equal(boton(tarjeta, "Novedad").props.disabled, false);
boton(tarjeta, "Novedad").props.onClick();
assert.equal(novedades, 1);
const cerrada = { ...base.agenda, visitas: [{ id: 8, estado: "CERRADA", entrada: `${hoy}T11:10:00Z`, salida: `${hoy}T11:26:00Z` }] };
assert.ok(texto(TarjetaAgendaRepositor({ ...base, agenda: cerrada, soloConsulta: true })).includes("16 min"), "Muestra cuánto duró la visita");
tarjeta = TarjetaAgendaRepositor({ ...base, soloConsulta: true });
const operativa = { ...base, hoy: true, revisionTareas: 0, onInventario: () => { inventarios++; }, onEntrada: () => { entradas++; }, onSalida: () => { salidas++; }, onTareas: stub };
tarjeta = TarjetaAgendaRepositor(operativa);
assert.equal(consultarTareas, true);
assert.equal(boton(tarjeta, "Inventario").props.disabled, true, "El inventario espera a que se inicie la visita");
boton(tarjeta, "Iniciar Visita").props.onClick();
assert.equal(entradas, 1, "El repositor mantiene su entrada");
const visita = { id: 33, asignacionId: 1, fecha: hoy, entrada: `${hoy}T11:00:00Z`, local: base.agenda.local };
tarjeta = TarjetaAgendaRepositor({ ...operativa, visitaAbierta: visita });
boton(tarjeta, "Finalizar Visita").props.onClick();
assert.equal(salidas, 1, "El repositor mantiene su salida");
boton(tarjeta, "Inventario").props.onClick();
assert.equal(inventarios, 1, "El inventario se abre en Mi Ruta, sin cambiar de página");
assert.ok(botones(tarjeta).some((b) => texto(b).includes("Tareas") && !b.props.disabled));
tarjeta = TarjetaAgendaRepositor({ ...base, visitaAbierta: visita, soloConsulta: true });
assert.equal(consultarTareas, false);
assert.equal(boton(tarjeta, "Finalizar Visita"), undefined, "Una visita abierta no habilita marcaciones en la variante impulsador");

let indice = 0;
const valores = [];
const react = {
  useState(inicial) {
    const i = indice++;
    if (!(i in valores)) valores[i] = typeof inicial === "function" ? inicial() : inicial;
    return [valores[i], (valor) => { valores[i] = typeof valor === "function" ? valor(valores[i]) : valor; }];
  },
  useMemo: (calcular) => calcular(), useEffect: stub,
};
let recargas = 0;
const items = Array.from({ length: 10 }, (_, i) => agenda(i + 1, i === 8 ? "en_curso" : i === 9 ? "completado" : "pendiente"));
const TablaCampo = () => null;
const KpisRuta = () => null;
const SaludoRuta = () => null;
const mapas = [];
const { RutaImpulsadorDelPeriodo, RutaImpulsadorPanel } = cargar("components/campo/ruta-impulsador-panel.tsx", {
  react, "next/dynamic": { default: () => stub }, "@/lib/api": {},
  "@/hooks/use-jornada-completa": { useJornadaCompleta: () => ({ items, total: items.length, cargando: false, error: null, refrescar: () => { recargas++; } }) },
  "@/hooks/use-fecha-campo": { useFechaCampo: () => hoy }, "@/components/panel/contexto": { usePanel: () => ({ usuario: { nombre: "Ana Campo" } }) },
  "@/utils/fechas": fechas, "@/utils/distancia": distancia, "@/utils/ruta-recomendada": ruta,
  "@/utils/error": { mensajeError: (error) => error.message }, "@/utils/estado-jornada": estados,
  "./ui/estado-ruta-simple": { EstadoRutaSimple }, "./ui/saludo-ruta": { SaludoRuta }, "./ui/kpis-ruta": { KpisRuta },
  "./tarjeta-agenda-repositor": { TarjetaAgendaRepositor }, "./tabla-campo": { TablaCampo }, "./ui/iconos-campo": iconos,
  "./ui/selector-fecha-filtro": { SelectorFechaFiltro: stub }, "@/components/pantalla-carga": { PantallaCarga: stub }, "./modal-novedad-local": { ModalNovedadLocal: stub },
}, "module.exports.RutaImpulsadorDelPeriodo = RutaImpulsadorDelPeriodo;", {
  navigator: { geolocation: { getCurrentPosition: (ok) => ok({ coords: { latitude: -25.3, longitude: -57.6 } }) } },
  window: { open: (...args) => mapas.push(args) },
});
const periodo = { clave: "hoy", etiqueta: "Hoy", fecha: hoy };
const render = () => { indice = 0; return RutaImpulsadorDelPeriodo({ qsFecha: `fecha=${hoy}`, periodo, onPeriodo: stub }); };
const tabla = (arbol) => nodos(arbol).find((n) => n.type === TablaCampo);
const kpis = (arbol) => nodos(arbol).find((n) => n.type === KpisRuta);
let pantalla = render();
assert.equal(nodos(pantalla).find((n) => n.type === SaludoRuta).props.nombre, "Ana");
assert.equal(tabla(pantalla).props.lista.items.length, 7);
assert.equal(tabla(pantalla).props.lista.items[0].estado, "en_curso");
assert.equal(kpis(pantalla).props.total, 10);
tabla(pantalla).props.lista.setPage(2);
pantalla = render();
assert.equal(tabla(pantalla).props.lista.items.length, 3);
assert.equal(kpis(pantalla).props.pendientes, 8, "Los KPI cuentan toda la ruta");
kpis(pantalla).props.onFiltro("completado");
pantalla = render();
assert.equal(tabla(pantalla).props.lista.datos.page, 1);
assert.equal(tabla(pantalla).props.lista.items[0].id, 10);
kpis(pantalla).props.onFiltro("todos");
pantalla = render();
nodos(pantalla).find((n) => n.type === "input").props.onChange({ target: { value: "C8" } });
pantalla = render();
assert.equal(tabla(pantalla).props.lista.items[0].id, 8, "Busca en toda la ruta, también fuera de la página visible");
assert.equal(tabla(pantalla).props.tarjetaMovil(items[0]).props.soloConsulta, true);
boton(pantalla, "Calcular ruta").props.onClick();
await new Promise((resolve) => setImmediate(resolve));
pantalla = render();
const sugerida = nodos(pantalla).find((n) => n.props?.["aria-label"] === "Ruta sugerida");
assert.ok(texto(sugerida).includes("8 paradas"), "El cálculo conserva todos los pendientes aunque haya búsqueda y paginación");
boton(pantalla, "Iniciar en Maps").props.onClick();
assert.equal(new URL(mapas[0][0]).hostname, "www.google.com");
assert.equal(mapas[0][2], "noopener,noreferrer");
botones(pantalla).find((n) => n.props["aria-label"] === "Actualizar ruta").props.onClick();
assert.equal(recargas, 1);

// El cambio de período renueva la agenda y descarta una ruta calculada para otra fecha.
valores.length = 0;
indice = 0;
let raiz = RutaImpulsadorPanel();
assert.equal(raiz.props.children.key, `fecha=${hoy}`);
raiz.props.children.props.onPeriodo({ clave: "rango", etiqueta: "Personalizado", fechaInicio: "2026-10-01", fechaFin: "2026-10-20" });
indice = 0;
raiz = RutaImpulsadorPanel();
assert.equal(raiz.props.children.key, "fechaInicio=2026-10-01&fechaFin=2026-10-20");

console.log("OK: UI compartida, acciones por rol, horarios, filtros, paginación, búsqueda global y cálculo de toda la ruta con Maps.");
