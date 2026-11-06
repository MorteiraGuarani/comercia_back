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
  ERP_CanalVenta: "1",
  ERP_Sucursal: 0,
  ERP_CodigoAlmacen: "01",
  ERP_NombreAlmacen: "DEPÓSITO CENTRAL",
  ERP_CodUsuarioSap: "manager",
};
const serializar = (valor) => JSON.parse(JSON.stringify(valor));
assert.deepEqual(
  serializar(datosErpFormulario(formularioErpUsuario(erp))),
  erp,
);
assert.deepEqual(serializar(datosErpFormulario(formularioErpUsuario())), {
  ERP_CanalVenta: null,
  ERP_Sucursal: null,
  ERP_CodigoAlmacen: null,
  ERP_NombreAlmacen: null,
  ERP_CodUsuarioSap: null,
});
// Un texto en blanco no guarda espacios: viaja como null.
assert.equal(
  datosErpFormulario({ ...formularioErpUsuario(erp), ERP_CodUsuarioSap: "   " })
    .ERP_CodUsuarioSap,
  null,
);
console.log(
  "Usuarios ERP: canal, sucursal (Code cero incluido), almacén, usuario SAP y borrado verificados.",
);
