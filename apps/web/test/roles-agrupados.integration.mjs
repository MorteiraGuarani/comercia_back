import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";

// Agrupación de la pantalla Roles (src/utils/agrupar-roles.ts).
const js = ts.transpileModule(
  readFileSync(new URL("../src/utils/agrupar-roles.ts", import.meta.url), "utf8"),
  { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } },
).outputText;
const modulo = { exports: {} };
vm.runInThisContext(`(function (module, exports, require) {${js}
})`)(modulo, modulo.exports, () => ({}));
const { agruparRoles } = modulo.exports;

const empresa = { id: 2, nombre: "Frigorifico Guarani" };
const imp = { id: 1, nombre: "Impulsadores Mod", tipo: "IMPULSADOR", activo: true };
const rep = { id: 2, nombre: "Repositores Mod", tipo: "REPOSITOR", activo: true };
const trad = { id: 3, nombre: "Repositores Trad", tipo: "REPOSITOR", activo: true };
let siguiente = 1;
const rol = (descripcion, { padre = null, equipo = null, gestiona = [], todos = false } = {}) => ({
  id: siguiente++,
  empresa,
  descripcion,
  padre,
  usuariosCount: 0,
  hijosCount: 0,
  equipoCampo: equipo,
  permisosTareas: [],
  puedeVerSeguimiento: false,
  gestionaTodosEquipos: todos,
  equiposGestion: gestiona,
});
const ref = (r) => ({ id: r.id, descripcion: r.descripcion });

const gerente = rol("Gerente General", { todos: true });
const jefe = rol("Jefe Canal Moderno", { padre: ref(gerente), gestiona: [imp, rep] });
const supImp = rol("Supervisor Impulsadores", { padre: ref(jefe), equipo: imp });
const tl = rol("TeamLeader", { padre: ref(supImp), equipo: imp });
const impulsador = rol("Impulsador", { padre: ref(tl), equipo: imp });
const boImp = rol("BackOffice Impulsadores", { equipo: imp });
const supRep = rol("Supervisor Repositores", { padre: ref(jefe), equipo: rep });
const manager = rol("Manager Ventas");
const jefeTrad = rol("Jefe Canal Tradicional", { padre: ref(gerente), gestiona: [trad] });

const [{ grupos }] = agruparRoles([impulsador, manager, supRep, tl, jefe, boImp, gerente, supImp, jefeTrad]);
const vista = grupos.map((g) => [
  g.titulo,
  g.supervisadoPor,
  g.filas.map((f) => `${"-".repeat(f.nivel)}${f.rol.descripcion}${f.superiorFuera ? " ↑" : ""}`),
]);
assert.deepEqual(vista, [
  // Jefaturas arriba, con su propia jerarquía.
  ["Jefaturas y gerencia", [], ["Gerente General", "-Jefe Canal Moderno", "-Jefe Canal Tradicional"]],
  // Cada equipo: quién lo supervisa y su cadena; el superior de otro grupo se marca.
  [
    "Impulsadores Mod",
    ["Gerente General", "Jefe Canal Moderno"],
    ["BackOffice Impulsadores", "Supervisor Impulsadores ↑", "-TeamLeader", "--Impulsador"],
  ],
  ["Repositores Mod", ["Gerente General", "Jefe Canal Moderno"], ["Supervisor Repositores ↑"]],
  // Un equipo solo supervisado, todavía sin roles propios, también aparece.
  ["Repositores Trad", ["Gerente General", "Jefe Canal Tradicional"], []],
  ["Sin equipo operativo", [], ["Manager Ventas"]],
]);

// Un ciclo en los superiores no pierde roles.
const a = rol("A", { equipo: imp });
const b = rol("B", { equipo: imp, padre: ref(a) });
a.padre = ref(b);
const [{ grupos: conCiclo }] = agruparRoles([a, b]);
assert.deepEqual(conCiclo[0].filas.map((f) => f.rol.descripcion).sort(), ["A", "B"]);

console.log("OK: roles agrupados por jefatura y equipo, jerarquía, supervisores y ciclos");
