import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import vm from "node:vm";
const require = createRequire(import.meta.url);
const ts = require("typescript");
const fuente = readFileSync(
  new URL("../src/utils/usuario.ts", import.meta.url),
  "utf8",
);
const modulo = { exports: {} };
vm.runInNewContext(
  ts.transpileModule(fuente, {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  }).outputText,
  { module: modulo, exports: modulo.exports },
);
const { formularioErpUsuario, datosErpFormulario } = modulo.exports;
const erp = {
  ERP_CanalVenta: "MAYORISTA",
  ERP_Almacen: "ALM01",
  ERP_Supervisor: "SUP01",
  ERP_Vendedor: 0,
  ERP_Repositor: "REP01",
  ERP_Impulsador: "IMP01",
};
const serializar = (valor) => JSON.parse(JSON.stringify(valor));
assert.deepEqual(
  serializar(datosErpFormulario(formularioErpUsuario(erp))),
  erp,
);
const vacios = datosErpFormulario(formularioErpUsuario());
assert.deepEqual(
  serializar(vacios),
  Object.fromEntries(Object.keys(erp).map((campo) => [campo, null])),
);
const editar = {
  ...formularioErpUsuario(erp),
  ERP_Almacen: "  ",
  ERP_Vendedor: "",
};
assert.equal(datosErpFormulario(editar).ERP_Almacen, null);
assert.equal(datosErpFormulario(editar).ERP_Vendedor, null);
for (const invalido of ["1.5", "2147483648", "-2147483649", "ABC"]) {
  assert.throws(
    () => datosErpFormulario({ ...editar, ERP_Vendedor: invalido }),
    /entero/,
  );
}
console.log(
  "Usuarios ERP: carga/edición, vendedor cero y borrado de campos verificados.",
);
