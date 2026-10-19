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

// Misma ruta que la carga masiva real del catálogo (prefijo y versión incluidos).
class LotePruebaController {
  lote(body) { return { length: body.payload.length }; }
}
Controller('api/v1/admin/catalogo/empresas/:empresaId/productos')(LotePruebaController);
Post()(LotePruebaController.prototype, 'lote', Object.getOwnPropertyDescriptor(LotePruebaController.prototype, 'lote'));
Body()(LotePruebaController.prototype, 'lote', 0);

async function crearApp(loteMb, generalMb) {
  const module = await Test.createTestingModule({
    controllers: [CuerpoPruebaController, LotePruebaController],
    providers: [{
      provide: ConfigService,
      useValue: { getOrThrow: (clave) => (clave === 'app.httpBodyLimitMb' ? loteMb : generalMb) },
    }],
  }).compile();
  const app = module.createNestApplication({ logger: false });
  configurarCuerpoHttp(app);
  await app.init();
  return app;
}

const overhead = Buffer.byteLength(JSON.stringify({ payload: '' }));
const app = await crearApp(50, 1);
try {
  const http = app.getHttpServer();
  const lote = 50 * MB;
  await request(http).post('/api/v1/admin/catalogo/empresas/3/productos').set('Content-Type', 'application/json')
    .send(JSON.stringify({ payload: 'x'.repeat(lote - overhead) }))
    .timeout(30000)
    .expect(201, { length: lote - overhead });
  // Enviar el cuerpo completo también comprueba el límite de bytes real.
  const mayorLote = await request(http).post('/api/v1/admin/catalogo/empresas/3/productos').set('Content-Type', 'application/json')
    .send(JSON.stringify({ payload: 'x'.repeat(lote - overhead + 1) })).timeout(30000).expect(413);
  assert.equal(mayorLote.body.limitBytes, lote);
  assert.ok(mayorLote.body.message.includes('50 MB'));

  await request(http).post('/body-test/json').set('Content-Type', 'application/json')
    .send(JSON.stringify({ payload: 'x'.repeat(MB - overhead) })).expect(201, { length: MB - overhead });
  const mayor = await request(http).post('/body-test/json').set('Content-Type', 'application/json')
    .send(JSON.stringify({ payload: 'x'.repeat(MB - overhead + 1) })).expect(413);
  assert.equal(mayor.body.limitBytes, MB);
  assert.ok(mayor.body.message.includes('1 MB'));
  await request(http).put('/body-test/formulario').set('Content-Type', 'application/x-www-form-urlencoded')
    .send('payload=' + 'x'.repeat(2 * MB)).expect(413);
  await request(http).put('/body-test/formulario').set('Content-Type', 'application/x-www-form-urlencoded')
    .send(Array.from({ length: 1500 }, (_, i) => `p${i}=x`).join('&')).expect(413);
  await request(http).post('/body-test/json').set('Content-Type', 'application/json').send('{}{}').expect(400);
  console.log('OK: lote del catálogo hasta 50 MiB, resto de la API hasta 1 MiB, formularios grandes rechazados, JSON malformado rechazado');
} finally { await app.close(); }

const pequena = await crearApp(1, 1);
try {
  const http = pequena.getHttpServer();
  const grande = gzipSync(JSON.stringify({ payload: 'x'.repeat(MB) }));
  const response = await request(http).post('/body-test/json').set('Content-Type', 'application/json')
    .set('Content-Encoding', 'gzip').serialize((value) => value).send(grande).expect(413);
  assert.equal(response.body.limitBytes, MB);
  console.log('OK: límite aplicado también al JSON descomprimido');
} finally { await pequena.close(); }
