import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
require('reflect-metadata');
const { Test } = require('@nestjs/testing');
const { ValidationPipe, VersioningType } = require('@nestjs/common');
const { ConfigService } = require('@nestjs/config');
const request = require('supertest');
const { configurarSwagger } = require('../dist/src/common/utils/swagger.js');
const {
  configurarCuerpoHttp,
} = require('../dist/src/common/utils/cuerpo-http.js');
const {
  CONTROLADORES_SOCIOS,
} = require('../dist/src/socios-negocio/socios-negocio.module.js');
const {
  SociosRelacionesController,
} = require('../dist/src/socios-negocio/socios-relaciones.controller.js');
const {
  SociosNegocioService,
} = require('../dist/src/socios-negocio/socios-negocio.service.js');
const {
  TABLAS_SOCIOS,
  MAX_SOCIOS_POR_LOTE,
} = require('../dist/src/socios-negocio/tablas-socios.js');
const {
  ejemploRespuestaSocios,
} = require('../dist/src/socios-negocio/utils/swagger-socios.js');
const calls = [];
const service = {
  listar: async (t, e, q) => {
    calls.push({ method: 'listar', tabla: t.nombre, empresa: e, query: q });
    return {
      items: [ejemploRespuestaSocios(t)],
      total: 1,
      page: q.page ?? 1,
      limit: q.limit ?? 7,
      totalPages: 1,
    };
  },
  obtener: async (t, e, id) => {
    calls.push({ method: 'obtener', tabla: t.nombre, empresa: e, id });
    return ejemploRespuestaSocios(t);
  },
  crear: async (t, e, d) => {
    calls.push({ method: 'crear', tabla: t.nombre, empresa: e, data: d });
    return Array.isArray(d)
      ? {
          recibidos: d.length,
          insertados: d.length,
          existentes: 0,
          duplicadosEnLote: 0,
          omitidos: 0,
        }
      : ejemploRespuestaSocios(t);
  },
  editar: async (t, e, id, d) => {
    calls.push({ method: 'editar', tabla: t.nombre, empresa: e, id, data: d });
    return ejemploRespuestaSocios(t);
  },
  eliminar: async (t, e, id) => {
    calls.push({ method: 'eliminar', tabla: t.nombre, empresa: e, id });
    return { ok: true };
  },
  relaciones: async () => ({
    tbl_ocrd: ejemploRespuestaSocios(TABLAS_SOCIOS.tbl_ocrd),
    ...Object.fromEntries(
      [
        'tbl_ocrg',
        'tbl_octg',
        'tbl_opln',
        'tbl_oagp',
        'tbl_oslp',
        'tbl_jcanal',
        'tbl_jsubcanal',
      ].map((t) => [t, null]),
    ),
  }),
  direcciones: async () => ({
    items: [ejemploRespuestaSocios(TABLAS_SOCIOS.tbl_crd1)],
    total: 1,
    page: 1,
    limit: 7,
    totalPages: 1,
  }),
};
const testing = await Test.createTestingModule({
  controllers: [...CONTROLADORES_SOCIOS, SociosRelacionesController],
  providers: [
    { provide: SociosNegocioService, useValue: service },
    {
      provide: ConfigService,
      useValue: {
        get: (k) => k === 'app.swaggerEnabled',
        getOrThrow: (k) => (k === 'app.httpBodyLimitMb' ? 50 : 1),
      },
    },
  ],
}).compile();
const app = testing.createNestApplication({ logger: false });
try {
  app.setGlobalPrefix('api');
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
  configurarCuerpoHttp(app);
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );
  configurarSwagger(app);
  await app.init();
  const http = app.getHttpServer();
  const { body: doc } = await request(http).get('/api/docs-json').expect(200);
  assert.equal(
    Object.values(doc.paths).reduce(
      (n, p) =>
        n +
        Object.keys(p).filter((m) =>
          ['get', 'post', 'put', 'delete'].includes(m),
        ).length,
      0,
    ),
    57,
  );
  for (const t of Object.values(TABLAS_SOCIOS)) {
    const route = '/api/v1/admin/socios-negocio/empresas/1/' + t.nombre;
    const path = route.replace('/empresas/1/', '/empresas/{empresaId}/');
    for (const [p, method] of [
      [path, 'get'],
      [path, 'post'],
      [path + '/{id}', 'get'],
      [path + '/{id}', 'put'],
      [path + '/{id}', 'delete'],
    ]) {
      const op = doc.paths[p][method];
      assert.ok(op.summary && op.description);
      assert.ok(!op.security?.length, method + ' ' + p + ' público');
      assert.ok(
        op.parameters.some(
          (p) => p.name === 'empresaId' && p.in === 'path' && p.required,
        ),
      );
      const response =
        op.responses[method === 'post' ? '201' : '200'].content[
          'application/json'
        ];
      assert.ok(
        response.example || response.examples,
        method + ' ' + p + ' ejemplo de respuesta',
      );
    }
    const schema = doc.components.schemas[t.Dto.name];
    assert.deepEqual(
      Object.keys(schema.properties).sort(),
      [...t.campos].sort(),
    );
    for (const campo of Object.values(schema.properties))
      assert.ok(campo.description && campo.example !== undefined);
    const creation = doc.paths[path].post;
    const consultas = doc.paths[path].get.parameters;
    assert.equal(consultas.find((p) => p.name === 'limit').schema.maximum, 50);
    assert.equal(consultas.find((p) => p.name === 'page').schema.default, 1);
    assert.equal(
      creation.requestBody.content['application/json'].schema.oneOf[1].maxItems,
      MAX_SOCIOS_POR_LOTE,
    );
    assert.ok(
      creation.responses['201'].content['application/json'].examples.lote,
    );
    const read = await request(http)
      .get(route)
      .set('Authorization', 'Bearer token-invalido')
      .expect(200);
    assert.equal(read.body.limit, 7);
    assert.deepEqual(
      Object.keys(read.body.items[0]).sort(),
      ['id', ...t.campos].sort(),
    );
    await request(http)
      .get(route + '/1')
      .expect(200);
    await request(http).post(route).send(t.ejemplo).expect(201);
    for (const sample of Object.values(
      creation.requestBody.content['application/json'].examples,
    ))
      await request(http).post(route).send(sample.value).expect(201);
    await request(http)
      .put(route + '/1')
      .send(t.ejemplo)
      .expect(200);
    const noClave =
      t.campos.find((c) => !t.clave.includes(c)) ?? t.campos.at(-1);
    await request(http)
      .put(route + '/1')
      .send({ [noClave]: t.ejemplo[noClave] ?? null })
      .expect((r) =>
        assert.equal(
          r.status,
          200,
          t.nombre + ' edición parcial: ' + JSON.stringify(r.body),
        ),
      );
    await request(http)
      .delete(route + '/1')
      .expect(200, { ok: true });
    for (const invalid of [
      { ...t.ejemplo, empresa_id: 2 },
      { ...t.ejemplo, campoInexistente: 'x' },
    ]) {
      const before = calls.length;
      await request(http).post(route).send(invalid).expect(400);
      assert.equal(calls.length, before);
    }
    await request(http)
      .get(route + '?limit=51')
      .expect(400);
    await request(http)
      .get(route + '?page=1e20')
      .expect(400);
    await request(http)
      .get(route + '/9223372036854775808')
      .expect(400);
  }
  const socios = '/api/v1/admin/socios-negocio/empresas/1/tbl_ocrd';
  let before = calls.length;
  const invalid = await request(http)
    .post(socios)
    .send([{ CardCode: 'VALIDO' }, { CardCode: 'INVALIDO', GroupCode: 32768 }])
    .expect(400);
  assert.equal(invalid.body.index, 1);
  assert.equal(calls.length, before);
  await request(http).post(socios).send({ cardcode: 'C0001' }).expect(400);
  await request(http).post(socios).send([]).expect(400);
  await request(http)
    .post(socios)
    .send(Array(MAX_SOCIOS_POR_LOTE + 1).fill(null))
    .expect(400);
  await request(http)
    .post(socios)
    .send({ CardCode: 'C0001', GroupNum: '1' })
    .expect(400);
  await request(http)
    .put(socios + '/1')
    .send({ CardCode: null })
    .expect(400);
  await request(http)
    .put(socios + '/1')
    .send([{ CardCode: 'C0001' }])
    .expect(400);
  await request(http)
    .post('/api/v1/admin/socios-negocio/empresas/1/tbl_jcanal')
    .send({ Code: null })
    .expect(400);
  await request(http)
    .get(socios + '/1/relaciones')
    .expect(200);
  await request(http)
    .get(socios + '/1/direcciones')
    .expect(200);
  const large = Array.from({ length: 5000 }, (_, i) => ({
    CardCode: 'B' + i,
    CardName: 'x'.repeat(200),
  }));
  assert.ok(Buffer.byteLength(JSON.stringify(large)) > 1024 * 1024);
  await request(http).post(socios).send(large).timeout(30000).expect(201);
  await request(http)
    .put(socios + '/1')
    .send(large)
    .expect(413);
  await request(http)
    .post('/api/v1/admin/socios-negocio/empresas/1/no_permitida')
    .send(large)
    .expect(413);
  assert.ok(calls.every((c) => c.empresa === 1));
  console.log(
    'OK: 57 operaciones públicas, once DTOs y ejemplos, validación atómica, nombres exactos y bulk >1 MiB con límites acotados',
  );
} finally {
  await app.close();
}
