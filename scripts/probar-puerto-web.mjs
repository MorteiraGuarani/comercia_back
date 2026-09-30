import assert from 'node:assert/strict';
import { elegirPuertoWeb } from './puerto-web.mjs';

const consultados = [];
const disponible = async (puerto) => { consultados.push(puerto); return puerto === 3003; };
assert.equal(await elegirPuertoWeb(3000, [3001, 3002, 5435], false, disponible), 3003);
assert.deepEqual(consultados, [3000, 3003], 'No intenta usar puertos del backend o del túnel');
assert.equal(await elegirPuertoWeb(4000, [3001, 5435], true, async () => true), 4000);
await assert.rejects(elegirPuertoWeb(3000, [], true, async () => false), /ocupado/);
await assert.rejects(elegirPuertoWeb(0, [], false, disponible), /válido/);
console.log('OK: puerto ocupado, servicios reservados y puerto web explícito.');
