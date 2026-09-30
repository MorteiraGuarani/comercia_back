const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

const fuente = fs.readFileSync(path.resolve(__dirname, '../apps/web/src/utils/tareas-campo.ts'), 'utf8');
const js = ts.transpileModule(fuente, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText;
const modulo = { exports: {} };
vm.runInNewContext(js, { module: modulo, exports: modulo.exports });
const { tareaCumplidaEnVisita } = modulo.exports;
const tarea = { visitasCompletadas: [12] };
assert.equal(tareaCumplidaEnVisita(tarea, 12), true);
assert.equal(tareaCumplidaEnVisita(tarea, 15), false, 'Al volver al mismo local, la tarea debe completarse en la nueva visita');
assert.equal(tareaCumplidaEnVisita(tarea), true, 'El historial conserva el cumplimiento anterior');
assert.equal(tareaCumplidaEnVisita({ visitasCompletadas: [12, 15] }, 15), true);
assert.equal(tareaCumplidaEnVisita({ visitasCompletadas: [] }, 15), false);
console.log('OK: tareas independientes por visita y conservación del historial.');
