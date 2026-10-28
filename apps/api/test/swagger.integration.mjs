import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
require('reflect-metadata');
const { Test } = require('@nestjs/testing');
const { ValidationPipe, VersioningType } = require('@nestjs/common');
const { ConfigService } = require('@nestjs/config');
const { JwtService } = require('@nestjs/jwt');
const request = require('supertest');
const { Decimal } = require('@prisma/client/runtime/client');
const {
  CONTROLADORES_TABLAS_PRODUCTOS,
} = require('../dist/src/productos/productos.module.js');
const {
  TablasProductosService,
} = require('../dist/src/productos/tablas-productos.service.js');
const {
  ProductosService,
} = require('../dist/src/productos/productos.service.js');
const {
  TABLAS_PRODUCTOS,
} = require('../dist/src/productos/tablas-productos.js');
const { PrismaService } = require('../dist/src/prisma/prisma.service.js');
const { JwtAuthGuard } = require('../dist/src/auth/jwt-auth.guard.js');
const { SuperadminGuard } = require('../dist/src/auth/superadmin.guard.js');
const { configurarSwagger } = require('../dist/src/common/utils/swagger.js');
const {
  configurarCuerpoHttp,
} = require('../dist/src/common/utils/cuerpo-http.js');
const jwt = new JwtService({ secret: 'clave-ficticia-solo-pruebas-catalogo' });
const writes = [];
const reads = [];
const prisma = {
  empresa: {
    findUnique: async ({ where }) => (where.id === 1 ? { id: 1 } : null),
  },
  usuario: {
    findUnique: async ({ where }) => ({
      id: where.id,
      isActive: where.id !== 3,
      esSuperadmin: where.id === 1,
    }),
  },
  $queryRaw: async () => [{ id: 1 }],
};
for (const t of Object.values(TABLAS_PRODUCTOS)) {
  const row = {
    id: 9007199254740993n,
    empresaId: 1,
    interno: 'no exponer',
    ...Object.fromEntries(
      Object.entries(t.columnas).map(([campo, interno]) => [
        interno,
        t.decimales.includes(campo)
          ? new Decimal(t.ejemplo[campo])
          : t.ejemplo[campo],
      ]),
    ),
  };
  prisma[t.modelo] = {
    findMany: async () => [row],
    findFirst: async ({ where }) => {
      reads.push({ tabla: t.nombre, where });
      return (t.nombre === 'tbl_oitm' || where.empresaId === 1) &&
        t.clave.every((c) => where[t.columnas[c]] === row[t.columnas[c]])
        ? row
        : null;
    },
    count: async () => 0,
    create: async ({ data }) => {
      writes.push(data);
      return { ...row, ...data };
    },
    createMany: async ({ data }) => {
      writes.push(...data);
      return { count: data.length };
    },
    update: async ({ data }) => {
      writes.push(data);
      return { ...row, ...data };
    },
    delete: async () => row,
  };
}
prisma.producto.findUnique = async ({ where }) =>
  where.itemcode ? { itemcode: where.itemcode } : null;
prisma.productoLocalCampo = { count: async () => 0 };
prisma.cargaInventarioCampo = { count: async () => 0 };
prisma.$transaction = async (fn) => fn(prisma);
const authCalls = [];
const catalogo = {
  autorizar: async (u, e) => {
    authCalls.push({ u, e });
    assert.equal(u, 1);
    assert.equal(e, 1);
  },
};
async function crearApp(enabled) {
  const module = await Test.createTestingModule({
    controllers: CONTROLADORES_TABLAS_PRODUCTOS,
    providers: [
      TablasProductosService,
      JwtAuthGuard,
      SuperadminGuard,
      { provide: JwtService, useValue: jwt },
      { provide: PrismaService, useValue: prisma },
      { provide: ProductosService, useValue: catalogo },
      {
        provide: ConfigService,
        useValue: {
          get: (k) => (k === 'app.swaggerEnabled' ? enabled : undefined),
          getOrThrow: (k) => (k === 'app.httpBodyLimitMb' ? 50 : 1),
        },
      },
    ],
  }).compile();
  const app = module.createNestApplication({ logger: false });
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
  return app;
}
const app = await crearApp(true);
try {
  const http = app.getHttpServer();
  const token = jwt.sign({ sub: 1 });
  for (const path of [
    '/api/docs',
    '/api/docs-json',
    '/api/docs-yaml',
    '/api/docs/swagger-ui.css',
    '/api/docs/swagger-ui-bundle.js',
  ]) {
    const r = await request(http).get(path).expect(200);
    assert.equal(r.headers['cache-control'], 'no-store');
  }
  const { body: doc } = await request(http).get('/api/docs-json').expect(200);
  assert.equal(
    Object.values(doc.paths).reduce(
      (n, p) =>
        n +
        Object.keys(p).filter((m) =>
          ['get', 'post', 'put', 'patch', 'delete'].includes(m),
        ).length,
      0,
    ),
    42,
  );
  for (const t of Object.values(TABLAS_PRODUCTOS)) {
    const route = '/api/v1/admin/catalogo/empresas/1/' + t.nombre;
    const path = route.replace('/empresas/1/', '/empresas/{empresaId}/');
    const keyPath = t.clave.map((c) => '/{' + c + '}').join('');
    const keyRoute = t.clave
      .map((c) => '/' + encodeURIComponent(t.ejemplo[c]))
      .join('');
    const methods = [
      [path, 'get'],
      [path, 'post'],
      [path + keyPath, 'get'],
      [path + keyPath, 'put'],
      [path + keyPath, 'patch'],
      [path + keyPath, 'delete'],
    ];
    for (const [p, method] of methods) {
      const op = doc.paths[p][method];
      assert.ok(op.summary && op.description);
      assert.equal(Boolean(op.security?.length), t.protegida);
      assert.ok(
        op.parameters.some((p) => p.name === 'empresaId' && p.required),
      );
      const response =
        op.responses[method === 'post' ? '201' : '200'].content[
          'application/json'
        ];
      assert.ok(response.example || response.examples);
    }
    const schema = doc.components.schemas[t.Dto.name];
    assert.deepEqual(
      Object.keys(schema.properties).sort(),
      Object.keys(t.columnas).sort(),
    );
    for (const field of Object.values(schema.properties))
      assert.ok(field.description && field.example !== undefined);
    const samples =
      doc.paths[path].post.requestBody.content['application/json'].examples;
    const call = (method, url) => {
      const q = request(http)[method](url);
      return t.protegida ? q.set('Authorization', 'Bearer ' + token) : q;
    };
    if (t.protegida) {
      await request(http).get(route).expect(401);
      await request(http).post(route).send(t.ejemplo).expect(401);
      await request(http)
        .get(route)
        .set('Authorization', 'Bearer ' + jwt.sign({ sub: 2 }))
        .expect(403);
    } else
      await request(http)
        .get(route)
        .set('Authorization', 'Bearer invalido')
        .expect(200);
    const list = await call('get', route).expect(200);
    assert.equal(list.body.limit, 7);
    assert.deepEqual(
      Object.keys(list.body.items[0]).sort(),
      [
        ...(t.nombre === 'tbl_oitm' ? [] : ['id']),
        ...Object.keys(t.columnas),
      ].sort(),
    );
    if (t.nombre !== 'tbl_oitm')
      assert.equal(list.body.items[0].id, '9007199254740993');
    for (const sample of Object.values(samples))
      await call('post', route).send(sample.value).expect(201);
    await call('get', route + keyRoute).expect(200);
    await call('put', route + keyRoute)
      .send(t.ejemplo)
      .expect(200);
    const campo = Object.keys(t.columnas).find((c) => !t.clave.includes(c));
    await call('patch', route + keyRoute)
      .send({ [campo]: null })
      .expect(t.nombre === 'tbl_ospp' && campo === 'Valid' ? 400 : 200);
    await call('delete', route + keyRoute).expect(200, { ok: true });
    const before = writes.length;
    await call('post', route)
      .send({ ...t.ejemplo, empresa_id: 2 })
      .expect(400);
    await call('post', route)
      .send({ ...t.ejemplo, campoRetirado: 'x' })
      .expect(400);
    assert.equal(writes.length, before);
    // Una fila inválida no corta el bulk: se saltea, se informa y la otra se guarda.
    const parcial = await call('post', route)
      .send([{ ...t.ejemplo }, { ...t.ejemplo, [t.clave[0]]: null }])
      .expect(201);
    assert.equal(parcial.body.invalidas, 1);
    assert.equal(parcial.body.filasInvalidas[0].fila, 2);
    assert.equal(parcial.body.filasInvalidas[0].errores[0].campo, t.clave[0]);
    // La fila se identifica por su clave de negocio (ItemCode...), no solo por posición.
    assert.ok('clave' in parcial.body.filasInvalidas[0]);
    assert.ok(!('index' in parcial.body.filasInvalidas[0]));
    assert.equal(writes.length, before + 1);
    await call('get', route + '?limit=51').expect(400);
    await call(
      'get',
      route +
        keyRoute.replace(encodeURIComponent(t.ejemplo.ItemCode), 'NO-EXISTE'),
    ).expect(404);
    if (t.clave.includes('PriceList'))
      await call(
        'get',
        route + '/' + encodeURIComponent(t.ejemplo.ItemCode) + '/2147483648',
      ).expect(400);
    assert.ok(
      reads.some(
        (r) =>
          r.tabla === t.nombre &&
          (t.nombre === 'tbl_oitm' || r.where.empresaId === 1) &&
          t.clave.every((c) => r.where[t.columnas[c]] === t.ejemplo[c]),
      ),
    );
    if (t.alias)
      await call('get', route.replace(t.nombre, t.alias)).expect(200);
  }
  const master = '/api/v1/admin/catalogo/empresas/1/tbl_oitm';
  await request(http)
    .get(master + '/0001')
    .expect(404);
  assert.deepEqual(reads.at(-1).where, { itemcode: '0001' });
  await request(http)
    .get(master + '/' + encodeURIComponent('A/B + 1'))
    .expect(404);
  assert.deepEqual(reads.at(-1).where, { itemcode: 'A/B + 1' });
  await request(http)
    .get(master + '/1')
    .expect(404);
  assert.deepEqual(reads.at(-1).where, { itemcode: '1' });
  assert.ok(doc.components.schemas.ArticuloDto.properties.U_beas_vg);
  assert.ok(!doc.components.schemas.ArticuloDto.properties.TIPO);
  assert.ok(!Object.keys(doc.paths).some((p) => p.includes('/{id}')));
  await request(http)
    .post(master)
    .send({ ItemCode: 'x'.repeat(16) })
    .expect(400);
  await request(http)
    .post(master)
    .send({ ItemCode: 'A', ItmsGrpCod: 32768 })
    .expect(400);
  await request(http)
    .post(master)
    .send({ ItemCode: 'A', TaxCodeAR: '10' })
    .expect(400);
  const large = Array.from({ length: 5000 }, (_, i) => ({
    ItemCode: 'B' + i,
    ItemName: 'x'.repeat(200),
  }));
  await request(http).post(master).send(large).timeout(30000).expect(201);
  await request(http)
    .put(master + '/1')
    .send(large)
    .expect(413);
  await request(http).post(master).send([]).expect(400);
  await request(http).post(master).send(Array(50001).fill(null)).expect(400);
  const special = '/api/v1/admin/catalogo/empresas/1/tbl_ospp';
  await request(http)
    .post(special)
    .set('Authorization', 'Bearer ' + token)
    .send({ ItemCode: 'A', CardCode: 'C', ListNum: 1, Valid: null })
    .expect(400);
  // Todas las tablas tbl_* son públicas: nunca se pide superadministrador.
  assert.equal(authCalls.length, 0);
  console.log(
    'OK: Swagger público completo, 42 operaciones de cinco tablas/alias públicas, DTOs exactos, ejemplos válidos, bulk >1 MiB, filas inválidas salteadas e informadas, decimales y BigInt.',
  );
} finally {
  await app.close();
}
const disabled = await crearApp(false);
try {
  await request(disabled.getHttpServer()).get('/api/docs-json').expect(404);
} finally {
  await disabled.close();
}
