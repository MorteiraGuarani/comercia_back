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
  const prisma = {
    usuario: {
      findUnique: async ({ where }) => ({ id: where.id, empresaId: 10, esSuperadmin: where.id === 1, isActive: where.id !== 3 }),
      findFirst: async () => { throw new Error('El catálogo público no consulta una sesión'); },
    },
    empresa: { findUnique: async ({ where }) => where.id === empresa.id ? empresa : null, count: async () => 1, findMany: async () => [empresa] },
    producto: {
      count: async () => 0, findMany: async () => [],
      create: async ({ data }) => filaProducto(data),
      update: async ({ where, data }) => filaProducto(data, where.id),
      delete: async ({ where }) => ({ id: where.id }),
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
      { provide: ConfigService, useValue: { get: (key) => key === 'app.env' ? 'production' : key === 'app.swaggerEnabled' ? enabled : undefined } },
      { provide: PrismaService, useValue: prisma },
    ],
  }).compile();
  const app = module.createNestApplication();
  app.setGlobalPrefix('api');
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
  app.use(cookieParser());
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
  await request(http).get('/api/v1/admin/catalogo/empresas/999/productos').expect(404);
  // Las otras secciones conservan sus permisos.
  await request(http).get('/api/v1/admin/catalogo/empresas/10/precios-especiales').expect(401);
  await request(http).get('/api/v1/admin/catalogo/empresas/10/precios-especiales').set('Authorization', `Bearer ${regular}`).expect(403);
  await request(http).get('/api/v1/campo/tolerancias/global/0').expect(401);
  console.log('OK: Swagger y seis endpoints de Productos y precios sin sesión; price numérico, tipos SQL, validación y permisos de las otras secciones');
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
