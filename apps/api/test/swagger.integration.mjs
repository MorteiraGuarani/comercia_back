import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { Test } = require('@nestjs/testing');
const { ValidationPipe, VersioningType } = require('@nestjs/common');
const { ConfigService } = require('@nestjs/config');
const { JwtService } = require('@nestjs/jwt');
const cookieParser = require('cookie-parser');
const request = require('supertest');
const { configurarSwagger } = require('../dist/src/common/utils/swagger.js');
const { configurarCuerpoHttp } = require('../dist/src/common/utils/cuerpo-http.js');
const { ProductosController } = require('../dist/src/productos/productos.controller.js');
const { ProductosService } = require('../dist/src/productos/productos.service.js');
const { PreciosEspecialesController } = require('../dist/src/productos/precios-especiales.controller.js');
const { PreciosEspecialesService } = require('../dist/src/productos/precios-especiales.service.js');
const { ToleranciasController } = require('../dist/src/tolerancias/tolerancias.controller.js');
const { ToleranciasService } = require('../dist/src/tolerancias/tolerancias.service.js');
const { PrismaService } = require('../dist/src/prisma/prisma.service.js');
const { JwtAuthGuard } = require('../dist/src/auth/jwt-auth.guard.js');
const { SuperadminGuard } = require('../dist/src/auth/superadmin.guard.js');
const { AUTH_COOKIE } = require('../dist/src/auth/auth.constants.js');
const { Decimal } = require('@prisma/client/runtime/client');
const jwt = new JwtService({ secret: 'clave-solo-para-pruebas-aisladas-swagger' });

async function crearApp(enabled) {
  const empresa = { id: 10, nombre: 'Empresa de prueba' };
  const filaProducto = (data, id = 1n) => ({
    id, itemcode: data.itemcode, itemname: data.itemname, iva: data.iva,
    itmsgrpcode: data.itmsgrpcode, itmsgrpnam: data.itmsgrpnam ?? null,
    inventory: data.inventory === undefined ? 'Y' : data.inventory,
    pricelist: data.pricelist, pricelistname: data.pricelistname ?? null,
    price: data.price == null ? null : new Decimal(data.price), tipo: data.tipo ?? null,
  });
  let siguienteId = 0n;
  const productos = new Map();
  const coincide = (p, where) => p.empresaId === where.empresaId
    && (where.itemcode === undefined || p.itemcode === where.itemcode)
    && (where.pricelist === undefined || p.pricelist === where.pricelist)
    && (!where.OR || where.OR.some((clave) => p.itemcode === clave.itemcode && p.pricelist === clave.pricelist));
  const existe = (data) => [...productos.values()].some((p) => p.empresaId === data.empresaId && p.itemcode === data.itemcode && p.pricelist === data.pricelist);
  const guardar = (data) => {
    const fila = filaProducto(data, ++siguienteId);
    productos.set(fila.id, { ...fila, empresaId: data.empresaId });
    return fila;
  };
  const prisma = {
    $transaction: async (operacion) => {
      const antes = new Map(productos);
      try { return await operacion(prisma); }
      catch (error) {
        productos.clear();
        for (const [id, fila] of antes) productos.set(id, fila);
        throw error;
      }
    },
    usuario: {
      findUnique: async ({ where }) => ({ id: where.id, empresaId: 10, esSuperadmin: where.id === 1, isActive: where.id !== 3 }),
      findFirst: async () => { throw new Error('El catálogo público no consulta una sesión'); },
    },
    empresa: { findUnique: async ({ where }) => where.id === empresa.id ? empresa : null, count: async () => 1, findMany: async () => [empresa] },
    producto: {
      count: async ({ where }) => [...productos.values()].filter((p) => coincide(p, where)).length,
      findMany: async ({ where, skip = 0, take }) => [...productos.values()].filter((p) => coincide(p, where)).slice(skip, skip + take).map((p) => filaProducto(p, p.id)),
      create: async ({ data }) => {
        if (existe(data)) throw { code: 'P2002' };
        return guardar(data);
      },
      createMany: async ({ data, skipDuplicates }) => {
        assert.equal(skipDuplicates, true);
        let count = 0;
        for (const fila of data) {
          if (existe(fila)) continue;
          guardar(fila); count++;
        }
        return { count };
      },
      update: async ({ where, data }) => {
        const anterior = productos.get(where.id);
        if (!anterior || anterior.empresaId !== where.empresaId) throw { code: 'P2025' };
        const fila = filaProducto({ ...anterior, ...data }, where.id);
        productos.set(where.id, { ...fila, empresaId: where.empresaId });
        return fila;
      },
      delete: async ({ where }) => {
        productos.delete(where.id);
        return { id: where.id };
      },
    },
  };
  const module = await Test.createTestingModule({
    controllers: [ProductosController, PreciosEspecialesController, ToleranciasController],
    providers: [
      JwtAuthGuard, SuperadminGuard,
      ProductosService,
      { provide: PreciosEspecialesService, useValue: {} },
      { provide: ToleranciasService, useValue: {} },
      { provide: JwtService, useValue: jwt },
      { provide: ConfigService, useValue: {
        get: (key) => key === 'app.env' ? 'production' : key === 'app.swaggerEnabled' ? enabled : undefined,
        getOrThrow: (key) => key === 'app.httpBodyLimitMb' ? 50 : undefined,
      } },
      { provide: PrismaService, useValue: prisma },
    ],
  }).compile();
  const app = module.createNestApplication();
  app.setGlobalPrefix('api');
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
  app.use(cookieParser());
  configurarCuerpoHttp(app);
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true, transformOptions: { enableImplicitConversion: true } }));
  configurarSwagger(app);
  await app.init();
  return app;
}
const app = await crearApp(true);
try {
  const http = app.getHttpServer();
  const regular = jwt.sign({ sub: 2 });
  for (const path of ['/api/docs', '/api/docs-json', '/api/docs-yaml', '/api/docs/swagger-ui-init.js', '/api/docs/swagger-ui.css', '/api/docs/swagger-ui-bundle.js']) {
    const response = await request(http).get(path).expect(200);
    assert.equal(response.headers['cache-control'], 'no-store');
  }
  await request(http).get('/api/docs-json').set('Authorization', `Bearer ${regular}`).expect(200);
  await request(http).get('/api/docs-json').set('Cookie', `${AUTH_COOKIE}=${jwt.sign({ sub: 3 })}`).expect(200);
  await request(http).get('/api/docs-json').set('Cookie', `${AUTH_COOKIE}=invalido`).expect(200);
  const { body: doc } = await request(http).get('/api/docs-json').expect(200);
  assert.equal(doc.info.title, 'Comercia API');
  assert.ok(doc.paths['/api/v1/admin/catalogo/empresas/{empresaId}/productos'].post);
  assert.ok(doc.paths['/api/v1/admin/catalogo/empresas/{empresaId}/productos/{id}'].delete);
  const producto = doc.components.schemas.CrearProductoDto;
  assert.equal(producto.properties.price.type, 'number');
  assert.equal(producto.properties.price.example, 15000.123456);
  for (const campo of ['iva', 'itmsgrpcode', 'pricelist']) assert.equal(producto.properties[campo].type, 'integer');
  for (const campo of ['itemcode', 'itemname', 'itmsgrpnam', 'inventory', 'pricelistname', 'tipo']) assert.equal(producto.properties[campo].type, 'string');
  assert.equal(producto.properties.itemcode.maxLength, 50);
  assert.ok(producto.properties.itemcode.description.includes('distinto pricelist'));
  assert.ok(producto.properties.pricelist.description.includes('itemcode'));
  assert.ok(doc.paths['/api/v1/admin/catalogo/empresas/{empresaId}/productos'].post.description.includes('409'));
  const post = doc.paths['/api/v1/admin/catalogo/empresas/{empresaId}/productos'].post;
  assert.deepEqual(post.requestBody.content['application/json'].schema.oneOf, [
    { $ref: '#/components/schemas/CrearProductoDto' },
    { type: 'array', minItems: 1, maxItems: 50000, items: { $ref: '#/components/schemas/CrearProductoDto' } },
  ]);
  assert.ok(post.responses['201'].content['application/json'].schema.oneOf.some((schema) => schema.$ref === '#/components/schemas/LoteProductosRespuestaDto'));
  for (const campo of ['recibidos', 'insertados', 'existentes', 'duplicadosEnLote', 'omitidos']) {
    assert.equal(doc.components.schemas.LoteProductosRespuestaDto.properties[campo].type, 'integer');
  }
  assert.equal(producto.properties.tipo.maxLength, 50);
  assert.equal(producto.properties.pricelist.maximum, 32767);
  assert.equal(producto.properties.inventory.default, 'Y');
  assert.ok(producto.required.includes('pricelist'));
  assert.ok(!producto.required.includes('inventory'));
  assert.equal(doc.components.schemas.ProductoRespuestaDto.properties.id.type, 'string');
  assert.equal(doc.components.schemas.ProductoRespuestaDto.properties.price.nullable, true);
  assert.ok(doc.components.schemas.PaginaProductoDto.properties.items);
  const especiales = '/api/v1/admin/catalogo/empresas/{empresaId}/precios-especiales';
  assert.ok(doc.paths[especiales].get && doc.paths[especiales].post);
  assert.ok(doc.paths[`${especiales}/{id}`].patch && doc.paths[`${especiales}/{id}`].delete);
  assert.ok(doc.paths[`${especiales}-detalle`].get && doc.paths[`${especiales}-detalle/{id}`].patch);
  const { schemas } = doc.components;
  assert.ok(doc.paths['/api/v1/campo/tolerancias/{alcance}/{id}'].get);
  assert.ok(doc.paths['/api/v1/campo/tolerancias/{alcance}/{id}'].put);
  assert.equal(schemas.ToleranciaHorarioDto.properties.toleranciaEntrada.maximum, 1440);
  assert.equal(schemas.ToleranciaHorarioDto.properties.toleranciaEntrada.nullable, true);
  assert.equal(schemas.PrecioEspecialDto.required, undefined);
  assert.equal(schemas.PrecioEspecialDetalleDto.required, undefined);
  assert.equal(schemas.PrecioEspecialDto.properties.price.type, 'string');
  assert.deepEqual(schemas.PrecioEspecialDto.properties.valid.enum, ['Y', 'N']);
  assert.equal(schemas.PrecioEspecialDetalleDto.properties.cardCode.maxLength, 15);
  assert.equal(schemas.PrecioEspecialDetalleDto.properties.lineNum.maximum, 32767);
  assert.equal(schemas.PrecioEspecialDetalleRespuestaDto.properties.fromDate.format, 'date-time');
  assert.ok(schemas.PaginaPrecioEspecialDto.properties.items);
  assert.ok(doc.components.securitySchemes.bearer);
  assert.ok(doc.components.securitySchemes.cookie);
  // Toda la sección señalada por el usuario funciona sin sesión ni token.
  const publicas = [];
  for (const [ruta, operaciones] of Object.entries(doc.paths)) {
    for (const [metodo, operacion] of Object.entries(operaciones)) {
      if (!operacion.tags?.includes('Productos y precios')) continue;
      assert.deepEqual(operacion.security ?? doc.security ?? [], []);
      publicas.push(`${metodo.toUpperCase()} ${ruta}`);
    }
  }
  assert.equal(publicas.length, 6);
  const empresas = '/api/v1/admin/catalogo/empresas';
  await request(http).get(empresas).expect(200);
  await request(http).get(empresas).set('Authorization', `Bearer ${regular}`).expect(200);
  await request(http).get(empresas).set('Cookie', `${AUTH_COOKIE}=invalido`).expect(200);
  await request(http).get(empresas).set('Authorization', `Bearer ${jwt.sign({ sub: 3 })}`).expect(200);
  const productos = '/api/v1/admin/catalogo/empresas/10/productos';
  await request(http).get(productos).expect(200);
  await request(http).get(`${productos}/opciones`).expect(200);
  const cuerpo = { itemcode: 'A0001', itemname: 'Artículo de prueba', iva: 10, itmsgrpcode: 100, pricelist: 1, price: 15000.123456 };
  const creado = await request(http).post(productos).send(cuerpo).expect(201);
  assert.equal(creado.body.price, '15000.123456');
  assert.equal(creado.body.id, '1');
  assert.equal(creado.body.inventory, 'Y');
  const editado = await request(http).put(`${productos}/1`).send({ ...cuerpo, price: 17500.5 }).expect(200);
  assert.equal(editado.body.price, '17500.500000');
  await request(http).delete(`${productos}/1`).expect(200, { ok: true });
  for (const price of [0.0000001, 1000000000000000, 'no-numero', {}, []]) await request(http).post(productos).send({ ...cuerpo, price }).expect(400);
  await request(http).post(productos).send({ ...cuerpo, iva: 32768 }).expect(400);
  await request(http).post(productos).send({ ...cuerpo, pricelist: 1.5 }).expect(400);
  await request(http).post(productos).send({ ...cuerpo, empresa_id: 20 }).expect(400);
  const baseLote = {
    itemcode: 'AV00018', itemname: 'PAPAS TRAD. 9,5 MM 4X2.5 KG-XL', iva: 10,
    itmsgrpcode: 143, itmsgrpnam: 'Papas', inventory: 'Y', tipo: null,
  };
  await request(http).post(productos).send({ ...baseLote, pricelist: 11, pricelistname: 'Distribuidores', price: 130050 }).expect(201);
  const lote = [
    { pricelist: 13, pricelistname: 'Minoristas', price: 141650 },
    { pricelist: 14, pricelistname: 'Especiales', price: 141650 },
    { pricelist: 16, pricelistname: 'South Food', price: 123800 },
    { pricelist: 21, pricelistname: 'Mayoristas', price: 139100 },
    { pricelist: 22, pricelistname: 'Mayoristas Especiales', price: 139100 },
  ].map((lista) => ({ ...baseLote, ...lista }));
  const creados = await request(http).post(productos).send(lote).expect(201);
  assert.deepEqual(creados.body, { recibidos: 5, insertados: 5, existentes: 0, duplicadosEnLote: 0, omitidos: 0 });
  const consultados = await request(http).get(productos).query({ itemcode: 'AV00018' }).expect(200);
  assert.equal(consultados.body.total, 6);
  assert.equal(consultados.body.items.find((p) => p.pricelist === 11).price, '130050.000000');
  assert.equal(consultados.body.items.find((p) => p.pricelist === 16).price, '123800.000000');
  assert.equal(consultados.body.items[0].tipo, null);
  const nueva = { ...baseLote, pricelist: 23 };
  const mixto = await request(http).post(productos).send([{ ...lote[0], price: 1 }, nueva, { ...nueva, price: 2 }]).expect(201);
  assert.deepEqual(mixto.body, { recibidos: 3, insertados: 1, existentes: 1, duplicadosEnLote: 1, omitidos: 2 });
  await request(http).get(productos).query({ itemcode: 'AV00018', pricelist: 13 }).expect(200).then((r) => assert.equal(r.body.items[0].price, '141650.000000', 'No sobrescribe los precios existentes'));
  await request(http).get(productos).query({ itemcode: 'AV00018', pricelist: 23 }).expect(200).then((r) => assert.equal(r.body.items[0].price, null, 'Conserva la primera aparición del arreglo'));
  const repetido = await request(http).post(productos).send([nueva, nueva]).expect(201);
  assert.deepEqual(repetido.body, { recibidos: 2, insertados: 0, existentes: 1, duplicadosEnLote: 1, omitidos: 2 });
  await request(http).post(productos).send(nueva).expect(409);
  const libre = { ...nueva, pricelist: 25 };
  const invalido = await request(http).post(productos).send([libre, { ...nueva, pricelist: 24, price: 'no-numero' }]).expect(400);
  assert.equal(invalido.body.index, 1);
  for (const body of [[], [null], [[nueva]]]) await request(http).post(productos).send(body).expect(400);
  await request(http).post(productos).send([nueva, { ...nueva, pricelist: 24, empresa_id: 20 }]).expect(400);
  await request(http).get(productos).query({ itemcode: 'AV00018', pricelist: 25 }).expect(200).then((r) => assert.equal(r.body.total, 0));
  await request(http).post('/api/v1/admin/catalogo/empresas/999/productos').send(lote).expect(404);
  const grande = Array.from({ length: 5000 }, (_, i) => ({ ...baseLote, itemcode: `GRANDE-${i}`, pricelist: 13, price: 141650 }));
  await request(http).post(productos).send(grande.slice(0, 200)).expect(201);
  const jsonGrande = JSON.stringify(grande, null, 2);
  assert.ok(Buffer.byteLength(jsonGrande) > 1024 * 1024);
  const loteGrande = await request(http).post(productos).set('Content-Type', 'application/json').send(jsonGrande).expect(201);
  assert.deepEqual(loteGrande.body, { recibidos: 5000, insertados: 4800, existentes: 200, duplicadosEnLote: 0, omitidos: 200 });
  await request(http).get(productos).query({ itemcode: 'GRANDE-4999' }).expect(200).then((r) => assert.equal(r.body.total, 1));
  const bloques = Array.from({ length: 1001 }, (_, i) => ({ ...baseLote, itemcode: 'BLOQUES', pricelist: i, price: 1 }));
  bloques.push(grande[0], bloques[0]);
  const tardio = await request(http).post(productos).send(bloques).expect(201);
  assert.deepEqual(tardio.body, { recibidos: 1003, insertados: 1001, existentes: 1, duplicadosEnLote: 1, omitidos: 2 });
  await request(http).get(productos).query({ itemcode: 'BLOQUES' }).expect(200).then((r) => assert.equal(r.body.total, 1001));
  await request(http).get('/api/v1/admin/catalogo/empresas/999/productos').expect(404);
  // Las otras secciones conservan sus permisos.
  await request(http).get('/api/v1/admin/catalogo/empresas/10/precios-especiales').expect(401);
  await request(http).get('/api/v1/admin/catalogo/empresas/10/precios-especiales').set('Authorization', `Bearer ${regular}`).expect(403);
  await request(http).get('/api/v1/campo/tolerancias/global/0').expect(401);
  console.log('OK: Swagger público, POST individual, cinco listas y 5000 objetos de más de 1 MB con 200 existentes; resumen, duplicados entre bloques, conservación de precios, tipos, validación y permisos');
} finally {
  await app.close();
}
const disabled = await crearApp(false);
try {
  await request(disabled.getHttpServer()).get('/api/docs').expect(404);
  await request(disabled.getHttpServer()).get('/api/docs-json').expect(404);
  await request(disabled.getHttpServer()).get('/api/docs-yaml').expect(404);
  await request(disabled.getHttpServer()).get('/api/docs/swagger-ui-init.js').expect(404);
  console.log('OK: SWAGGER_ENABLED=false desactiva UI y especificacion');
} finally {
  await disabled.close();
}
