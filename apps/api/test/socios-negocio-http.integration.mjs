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
  esCatalogoArticulos,
} = require('../dist/src/socios-negocio/rutas-socios.js');
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
  obtener: async (t, e, id, q) => {
    calls.push({
      method: 'obtener',
      tabla: t.nombre,
      empresa: e,
      id,
      query: q,
    });
    return t.nombre === 'tbl_crd1' || t.nombre === 'tbl_oscn'
      ? {
          items: [ejemploRespuestaSocios(t)],
          total: 1,
          page: q.page ?? 1,
          limit: q.limit ?? 7,
          totalPages: 1,
        }
      : ejemploRespuestaSocios(t);
  },
  crear: async (t, e, d) => {
    calls.push({ method: 'crear', tabla: t.nombre, empresa: e, data: d });
    return Array.isArray(d?.filas)
      ? {
          recibidos: d.recibidos,
          insertados: d.filas.length,
          existentes: 0,
          duplicadosEnLote: 0,
          omitidos: 0,
          invalidas: d.invalidas.length,
        }
      : ejemploRespuestaSocios(t);
  },
  editar: async (t, e, id, d, selector) => {
    calls.push({
      method: 'editar',
      tabla: t.nombre,
      empresa: e,
      id,
      data: d,
      selector,
    });
    return ejemploRespuestaSocios(t);
  },
  eliminar: async (t, e, id, selector) => {
    calls.push({
      method: 'eliminar',
      tabla: t.nombre,
      empresa: e,
      id,
      selector,
    });
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
        'tbl_jcanales',
        'tbl_jsubcanales',
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
    67,
  );
  for (const t of Object.values(TABLAS_SOCIOS)) {
    const route =
      '/api/v1/admin/' +
      (esCatalogoArticulos(t.nombre) ? 'catalogo' : 'socios-negocio') +
      '/empresas/1/' +
      t.nombre;
    const locator =
      t.nombre === 'tbl_ocrd' ||
      t.nombre === 'tbl_crd1' ||
      t.nombre === 'tbl_oscn'
        ? '{CardCode}'
        : t.nombre === 'tbl_oitb'
          ? '{Number}'
          : t.nombre === 'tbl_omrc'
            ? '{FirmCode}'
            : t.nombre === 'tbl_ocrg'
              ? '{GroupCode}'
              : t.nombre === 'tbl_octg'
                ? '{GroupNum}'
                : t.nombre === 'tbl_opln'
                  ? '{ListNum}'
                  : t.nombre === 'tbl_oslp'
                    ? '{SlpCode}'
                    : t.nombre === 'tbl_oagp'
                      ? '{AgentCode}'
                      : t.identidad
                        ? '{Code}'
                        : '{id}';
    const code =
      t.nombre === 'tbl_ocrd' ||
      t.nombre === 'tbl_crd1' ||
      t.nombre === 'tbl_oscn'
        ? 'C0001'
        : t.nombre === 'tbl_oagp'
          ? 'SUP01'
          : '1';
    const path = route.replace('/empresas/1/', '/empresas/{empresaId}/');
    for (const [p, method] of [
      [path, 'get'],
      [path, 'post'],
      [path + '/' + locator, 'get'],
      [path + '/' + locator, 'put'],
      [path + '/' + locator, 'delete'],
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
      .get(route + '/' + code)
      .expect(200);
    await request(http).post(route).send(t.ejemplo).expect(201);
    for (const sample of Object.values(
      creation.requestBody.content['application/json'].examples,
    ))
      await request(http).post(route).send(sample.value).expect(201);
    await request(http)
      .put(route + '/' + code)
      .send(t.ejemplo)
      .expect(200);
    const noClave =
      t.campos.find((c) => !t.clave.includes(c)) ?? t.campos.at(-1);
    await request(http)
      .put(route + '/' + code)
      .send({ [noClave]: t.ejemplo[noClave] ?? null })
      .expect((r) =>
        assert.equal(
          r.status,
          200,
          t.nombre + ' edición parcial: ' + JSON.stringify(r.body),
        ),
      );
    await request(http)
      .delete(route + '/' + code)
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
      .get(
        route +
          '/' +
          (t.nombre === 'tbl_crd1' || t.nombre === 'tbl_oscn'
            ? 'x'.repeat(201)
            : t.nombre === 'tbl_ocrd'
              ? 'x'.repeat(51)
              : t.nombre === 'tbl_oagp'
                ? 'x'.repeat(201)
                : '9223372036854775808'),
      )
      .expect(400);
    if (t.nombre === 'tbl_ocrd') {
      const codigoLargo = '0'.repeat(50);
      await request(http)
        .get(route + '/' + codigoLargo)
        .expect(200);
      assert.equal(calls.at(-1).id, codigoLargo);
      for (const campo of ['validFor', 'frozenFor']) {
        const before = calls.length;
        await request(http)
          .post(route)
          .send({ ...t.ejemplo, [campo]: null })
          .expect(400);
        await request(http)
          .put(route + '/' + code)
          .send({ [campo]: null })
          .expect(400);
        assert.equal(calls.length, before);
      }
    }
  }
  for (const [tabla, campo] of [
    ['tbl_ocrg', 'GroupCode'],
    ['tbl_octg', 'GroupNum'],
    ['tbl_oitb', 'Number'],
    ['tbl_omrc', 'FirmCode'],
  ]) {
    const grupo = ['tbl_oitb', 'tbl_omrc'].includes(tabla)
      ? 'catalogo'
      : 'socios-negocio';
    const ruta = `/api/v1/admin/${grupo}/empresas/1/${tabla}`;
    const path = `/api/v1/admin/${grupo}/empresas/{empresaId}/${tabla}`;
    assert.ok(!doc.paths[`${path}/{id}`]);
    for (const method of ['get', 'put', 'delete']) {
      const op = doc.paths[`${path}/{${campo}}`][method];
      const parametro = op.parameters.find((p) => p.name === campo);
      assert.equal(parametro.schema.type, 'integer');
      assert.equal(parametro.schema.minimum, -2147483648);
      assert.equal(parametro.schema.maximum, 2147483647);
    }
    for (const [method, servicio] of [
      ['get', 'obtener'],
      ['put', 'editar'],
      ['delete', 'eliminar'],
    ]) {
      let req = request(http)[method](`${ruta}/-1`);
      if (method === 'put')
        req = req.send(
          tabla === 'tbl_ocrg'
            ? { GroupName: 'Nuevo' }
            : tabla === 'tbl_octg'
              ? { PymntGroup: 'Nuevo' }
              : tabla === 'tbl_oitb'
                ? { GroupName: 'Nuevo' }
                : { FirmName: 'Nuevo' },
        );
      await req.expect(200);
      assert.equal(calls.at(-1).method, servicio);
      assert.equal(calls.at(-1).empresa, 1);
      assert.equal(calls.at(-1).id, -1);
    }
    for (const invalido of ['1.5', '1e2', '2147483648', '-2147483649']) {
      const antes = calls.length;
      await request(http).get(`${ruta}/${invalido}`).expect(400);
      assert.equal(calls.length, antes);
    }
  }
  const oscnPath = '/api/v1/admin/catalogo/empresas/{empresaId}/tbl_oscn';
  assert.ok(!doc.paths[oscnPath + '/{id}']);
  for (const method of ['get', 'put', 'delete']) {
    assert.ok(
      doc.paths[oscnPath + '/{CardCode}'][method].parameters.some(
        (p) => p.name === 'articulo',
      ),
    );
  }
  const oscn = '/api/v1/admin/catalogo/empresas/1/tbl_oscn/0001';
  const articulo = JSON.stringify({ ItemCode: '001', Substitute: 'ALT' });
  await request(http)
    .get(oscn + '?page=2&limit=10&articulo=' + encodeURIComponent(articulo))
    .expect(200);
  assert.equal(calls.at(-1).id, '0001');
  assert.equal(calls.at(-1).query.articulo, articulo);
  for (const method of ['put', 'delete']) {
    let req = request(http)[method](
      oscn + '?articulo=' + encodeURIComponent(articulo),
    );
    if (method === 'put') req = req.send({ Descriptio: 'Nuevo' });
    await req.expect(200);
    assert.equal(calls.at(-1).id, '0001');
    assert.equal(calls.at(-1).selector, articulo);
    const invalido = request(http)[method](
      oscn + '?articulo=' + encodeURIComponent('{"ItemCode":"001"}'),
    );
    if (method === 'put') invalido.send({ Descriptio: 'X' });
    await invalido.expect(400);
  }
  const fabricantes = '/api/v1/admin/catalogo/empresas/1/tbl_omrc';
  await request(http)
    .post(fabricantes)
    .send({ FirmCode: null, FirmName: null })
    .expect(201);
  await request(http)
    .post(fabricantes)
    .send({ FirmCode: 2147483648 })
    .expect(400);
  await request(http)
    .post(fabricantes)
    .send({ FirmName: 'x'.repeat(201) })
    .expect(400);
  const grupos = '/api/v1/admin/catalogo/empresas/1/tbl_oitb';
  const esquemaGrupos = doc.components.schemas.GrupoArticuloDto;
  assert.deepEqual(Object.keys(esquemaGrupos.properties).sort(), ['GroupName', 'Number']);
  assert.ok(esquemaGrupos.required.includes('Number'));
  assert.equal(esquemaGrupos.properties.GroupName.maxLength, 200);
  assert.ok(doc.paths['/api/v1/admin/catalogo/empresas/{empresaId}/tbl_oitb/{Number}']);
  assert.ok(!doc.paths['/api/v1/admin/catalogo/empresas/{empresaId}/tbl_oitb/{ItmsGrpCod}']);
  await request(http)
    .post(grupos)
    .send({ Number: 2147483647, GroupName: null })
    .expect(201);
  await request(http).post(grupos).send({ Number: null }).expect(400);
  await request(http).post(grupos).send({}).expect(400);
  await request(http).post(grupos).send({ Number: 2147483648 }).expect(400);
  await request(http).post(grupos).send({ Number: 1, GroupName: 'x'.repeat(201) }).expect(400);
  await request(http).post(grupos).send({ ItmsGrpCod: 1, ItmsGrpNam: 'Anterior' }).expect(400);
  const loteGrupos = await request(http).post(grupos).send([
    { Number: 10, GroupName: 'Nuevo' },
    { Number: null, GroupName: 'Inválido' },
  ]).expect(201);
  assert.equal(loteGrupos.body.invalidas, 1);
  assert.equal(calls.at(-1).data.filas[0].Number, 10);
  const sustitutos = '/api/v1/admin/catalogo/empresas/1/tbl_oscn';
  const codigo = {
    ItemCode: 'I'.repeat(100),
    CardCode: 'C'.repeat(200),
    Substitute: 'S'.repeat(200),
    Descriptio: 'D'.repeat(300),
  };
  await request(http).post(sustitutos).send(codigo).expect(201);
  await request(http)
    .post(sustitutos)
    .send({ ...codigo, ItemCode: 'I'.repeat(101) })
    .expect(400);
  await request(http)
    .post(sustitutos)
    .send({ ...codigo, CardCode: 'C'.repeat(201) })
    .expect(400);
  await request(http)
    .post(sustitutos)
    .send({ ...codigo, Substitute: null })
    .expect(400);
  await request(http)
    .post(sustitutos)
    .send({ ...codigo, Descriptio: 'D'.repeat(301) })
    .expect(400);
  const parcialCatalogo = await request(http)
    .post(sustitutos)
    .send([
      { ItemCode: '001', CardCode: 'C1', Substitute: 'A' },
      { ItemCode: '002', CardCode: 'C1', Substitute: null },
    ])
    .expect(201);
  assert.equal(parcialCatalogo.body.invalidas, 1);
  assert.equal(calls.at(-1).data.filas[0].ItemCode, '001');
  const tipos = '/api/v1/admin/socios-negocio/empresas/1/tbl_jtiposubcanales';
  await request(http)
    .post(tipos)
    .send({ Code: '001', U_Descripcion: null })
    .expect(201);
  assert.equal(calls.at(-1).data.Code, '001');
  await request(http).post(tipos).send({ Code: null }).expect(400);
  await request(http)
    .post(tipos)
    .send({ Code: 'x'.repeat(51) })
    .expect(400);
  await request(http)
    .post(tipos)
    .send({ Code: '001', U_Descripcion: 'x'.repeat(121) })
    .expect(400);
  const bulkCatalogo = Array.from({ length: 5000 }, (_, i) => ({
    ItemCode: String(i),
    CardCode: 'C1',
    Substitute: 'S',
    Descriptio: 'x'.repeat(200),
  }));
  assert.ok(Buffer.byteLength(JSON.stringify(bulkCatalogo)) > 1024 * 1024);
  await request(http)
    .post(sustitutos)
    .send(bulkCatalogo)
    .timeout(30000)
    .expect(201);
  for (const deleted of ['tbl_jcanal', 'tbl_jsubcanal']) {
    assert.ok(
      !Object.keys(doc.paths).some((p) => p.split('/').includes(deleted)),
    );
    await request(http)
      .get('/api/v1/admin/socios-negocio/empresas/1/' + deleted)
      .expect(404);
  }
  const addressRoute = '/api/v1/admin/socios-negocio/empresas/1/tbl_crd1/00001';
  const selector = JSON.stringify({
    Address: null,
    Street: 'null',
    AdresType: 'S',
  });
  await request(http)
    .get(addressRoute + '?page=2&limit=10')
    .expect(200);
  assert.equal(calls.at(-1).id, '00001');
  assert.equal(calls.at(-1).query.page, 2);
  await request(http)
    .put(addressRoute + '?direccion=' + encodeURIComponent(selector))
    .send({ Street: 'Nueva' })
    .expect(200);
  assert.equal(calls.at(-1).selector, selector);
  await request(http)
    .delete(addressRoute + '?direccion=' + encodeURIComponent(selector))
    .expect(200);
  assert.equal(calls.at(-1).selector, selector);
  for (const invalid of [
    '{}',
    'null',
    '{"Address":"X","Street":null,"AdresType":"S","id":"1"}',
    'INVALIDO',
  ]) {
    const before = calls.length;
    await request(http)
      .delete(addressRoute + '?direccion=' + encodeURIComponent(invalid))
      .expect(400);
    assert.equal(calls.length, before);
  }
  for (const [table, key] of [
    ['tbl_oslp', 'SlpCode'],
    ['tbl_oagp', 'AgentCode'],
  ]) {
    const base = '/api/v1/admin/socios-negocio/empresas/1/' + table;
    const path = '/api/v1/admin/socios-negocio/empresas/{empresaId}/' + table;
    assert.ok(!doc.paths[path + '/{id}']);
    for (const method of ['get', 'put', 'delete']) {
      const op = doc.paths[path + '/{' + key + '}'][method];
      assert.ok(op.parameters.some((p) => p.name === key && p.required));
      assert.ok(!op.security?.length);
    }
    const value = table === 'tbl_oslp' ? '0007' : '00%2FSUP';
    const expected = table === 'tbl_oslp' ? 7 : '00/SUP';
    await request(http)
      .get(base + '/' + value)
      .expect(200);
    assert.equal(calls.at(-1).id, expected);
    const body = table === 'tbl_oslp' ? { SlpName: 'X' } : { AgentName: 'X' };
    await request(http)
      .put(base + '/' + value)
      .send(body)
      .expect(200);
    assert.equal(calls.at(-1).id, expected);
    await request(http)
      .delete(base + '/' + value)
      .expect(200);
    assert.equal(calls.at(-1).id, expected);
    const invalids =
      table === 'tbl_oslp'
        ? ['1e3', '1.5', '2147483648', '-2147483649', 'no-codigo']
        : ['x'.repeat(201)];
    for (const invalid of invalids) {
      for (const method of ['get', 'delete'])
        await request(http)
          [method](base + '/' + invalid)
          .expect(400);
      await request(http)
        .put(base + '/' + invalid)
        .send(body)
        .expect(400);
    }
  }
  const vendedores = '/api/v1/admin/socios-negocio/empresas/1/tbl_oslp';
  await request(http)
    .get(vendedores + '/0')
    .expect(200);
  assert.equal(calls.at(-1).id, 0);
  await request(http)
    .delete(vendedores + '/-1')
    .expect(200);
  assert.equal(calls.at(-1).id, -1);
  const supervisores = '/api/v1/admin/socios-negocio/empresas/1/tbl_oagp';
  await request(http)
    .get(supervisores + '/0007')
    .expect(200);
  assert.equal(calls.at(-1).id, '0007');
  for (const table of ['tbl_jcanales', 'tbl_jsubcanales']) {
    const route = '/api/v1/admin/socios-negocio/empresas/1/' + table;
    await request(http)
      .get(route + '/0007')
      .expect(200);
    assert.equal(calls.at(-1).id, 7);
    for (const invalid of ['1e3', '1.5', '2147483648', 'no-codigo'])
      await request(http)
        .get(route + '/' + invalid)
        .expect(400);
  }
  const opln = '/api/v1/admin/socios-negocio/empresas/1/tbl_opln';
  const oplnPath = '/api/v1/admin/socios-negocio/empresas/{empresaId}/tbl_opln';
  assert.ok(!doc.paths[oplnPath + '/{id}']);
  for (const method of ['get', 'put', 'delete']) {
    const operation = doc.paths[oplnPath + '/{ListNum}'][method];
    assert.ok(
      operation.parameters.some((p) => p.name === 'ListNum' && p.required),
    );
    assert.ok(!operation.security?.length);
  }
  await request(http)
    .get(opln + '/0007')
    .expect(200);
  assert.equal(calls.at(-1).id, 7);
  await request(http)
    .put(opln + '/0')
    .send({ ListName: 'Actualizada' })
    .expect(200);
  assert.equal(calls.at(-1).id, 0);
  await request(http)
    .delete(opln + '/-1')
    .expect(200);
  assert.equal(calls.at(-1).id, -1);
  for (const invalid of [
    '1e3',
    '1.5',
    '2147483648',
    '-2147483649',
    'no-codigo',
  ]) {
    for (const method of ['get', 'delete'])
      await request(http)
        [method](opln + '/' + invalid)
        .expect(400);
    await request(http)
      .put(opln + '/' + invalid)
      .send({ ListName: 'X' })
      .expect(400);
  }
  const socios = '/api/v1/admin/socios-negocio/empresas/1/tbl_ocrd';
  await request(http)
    .get(socios + '/00001')
    .expect(200);
  assert.equal(calls.at(-1).id, '00001');
  assert.ok(
    doc.paths[
      '/api/v1/admin/socios-negocio/empresas/{empresaId}/tbl_ocrd/{CardCode}/relaciones'
    ],
  );
  assert.ok(
    !doc.paths[
      '/api/v1/admin/socios-negocio/empresas/{empresaId}/tbl_ocrd/{id}'
    ],
  );
  let before = calls.length;
  // La fila inválida no corta el bulk: la válida llega al servicio y la otra se informa.
  const parcial = await request(http)
    .post(socios)
    .send([{ CardCode: 'VALIDO' }, { CardCode: 'INVALIDO', GroupCode: 32768 }])
    .expect(201);
  assert.equal(parcial.body.invalidas, 1);
  assert.equal(calls.length, before + 1);
  assert.deepEqual(
    calls.at(-1).data.filas.map((f) => f.CardCode),
    ['VALIDO'],
  );
  assert.equal(calls.at(-1).data.invalidas[0].errores[0].campo, 'GroupCode');
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
    .post('/api/v1/admin/socios-negocio/empresas/1/tbl_jcanales')
    .send({ Code: null })
    .expect(400);
  await request(http)
    .get(socios + '/C0001/relaciones')
    .expect(200);
  await request(http)
    .get(socios + '/C0001/direcciones')
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
    'OK: 67 operaciones públicas, trece DTOs y ejemplos, filas inválidas salteadas, nombres exactos y bulk >1 MiB con límites acotados',
  );
} finally {
  await app.close();
}
