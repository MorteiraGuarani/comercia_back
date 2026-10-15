import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { gzipSync } from 'node:zlib';
const require = createRequire(import.meta.url);
const { Test } = require('@nestjs/testing');
const { Body, Controller, Post, Put } = require('@nestjs/common');
const { ConfigService } = require('@nestjs/config');
const request = require('supertest');
const { configurarCuerpoHttp } = require('../dist/src/common/utils/cuerpo-http.js');
const MB = 1024 * 1024;

class CuerpoPruebaController {
  json(body) { return { length: body.payload.length }; }
  formulario(body) { return { length: body.payload?.length, fields: Object.keys(body).length }; }
}
Controller('body-test')(CuerpoPruebaController);
Post('json')(CuerpoPruebaController.prototype, 'json', Object.getOwnPropertyDescriptor(CuerpoPruebaController.prototype, 'json'));
Body()(CuerpoPruebaController.prototype, 'json', 0);
Put('formulario')(CuerpoPruebaController.prototype, 'formulario', Object.getOwnPropertyDescriptor(CuerpoPruebaController.prototype, 'formulario'));
Body()(CuerpoPruebaController.prototype, 'formulario', 0);

async function crearApp(limiteMb) {
  const module = await Test.createTestingModule({
    controllers: [CuerpoPruebaController],
    providers: [{ provide: ConfigService, useValue: { getOrThrow: () => limiteMb } }],
  }).compile();
  const app = module.createNestApplication({ logger: false });
  configurarCuerpoHttp(app);
  await app.init();
  return app;
}

const app = await crearApp(50);
try {
  const http = app.getHttpServer();
  const limite = 50 * MB;
  const overhead = Buffer.byteLength(JSON.stringify({ payload: '' }));
  await request(http).post('/body-test/json').set('Content-Type', 'application/json')
    .send(JSON.stringify({ payload: 'x'.repeat(limite - overhead) }))
    .timeout(30000)
    .expect(201, { length: limite - overhead });
  // Enviar el cuerpo completo también comprueba el límite de bytes real.
  const mayor = await request(http).post('/body-test/json').set('Content-Type', 'application/json')
    .send(JSON.stringify({ payload: 'x'.repeat(limite - overhead + 1) })).timeout(30000).expect(413);
  assert.equal(mayor.body.limitBytes, limite);
  assert.ok(mayor.body.message.includes('50 MB'));
  await request(http).put('/body-test/formulario').set('Content-Type', 'application/x-www-form-urlencoded')
    .send('payload=' + 'x'.repeat(2 * MB)).expect(200, { length: 2 * MB, fields: 1 });
  await request(http).put('/body-test/formulario').set('Content-Type', 'application/x-www-form-urlencoded')
    .send(Array.from({ length: 1500 }, (_, i) => `p${i}=x`).join('&')).expect(200, { fields: 1500 });
  await request(http).post('/body-test/json').set('Content-Type', 'application/json').send('{}{}').expect(400);
  console.log('OK: JSON de 50 MiB exactos, 413 con límite explícito, formularios de más de 1 MiB y 1000 parámetros, JSON malformado rechazado');
} finally { await app.close(); }

const pequena = await crearApp(1);
try {
  const http = pequena.getHttpServer();
  const grande = gzipSync(JSON.stringify({ payload: 'x'.repeat(MB) }));
  const response = await request(http).post('/body-test/json').set('Content-Type', 'application/json')
    .set('Content-Encoding', 'gzip').serialize((value) => value).send(grande).expect(413);
  assert.equal(response.body.limitBytes, MB);
  console.log('OK: configuración del límite y límite aplicado también al JSON descomprimido');
} finally { await pequena.close(); }
