import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { Test } = require('@nestjs/testing');
const { VersioningType } = require('@nestjs/common');
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
const jwt = new JwtService({ secret: 'clave-solo-para-pruebas-aisladas-swagger' });

async function crearApp(enabled) {
  const module = await Test.createTestingModule({
    controllers: [ProductosController, PreciosEspecialesController, ToleranciasController],
    providers: [
      JwtAuthGuard, SuperadminGuard,
      { provide: ProductosService, useValue: {} },
      { provide: PreciosEspecialesService, useValue: {} },
      { provide: ToleranciasService, useValue: {} },
      { provide: JwtService, useValue: jwt },
      { provide: ConfigService, useValue: { get: (key) => key === 'app.env' ? 'production' : key === 'app.swaggerEnabled' ? enabled : undefined } },
      { provide: PrismaService, useValue: { usuario: { findUnique: async ({ where }) => ({ id: where.id, empresaId: 10, esSuperadmin: where.id === 1, isActive: where.id !== 3 }) } } },
    ],
  }).compile();
  const app = module.createNestApplication();
  app.setGlobalPrefix('api');
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
  app.use(cookieParser());
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
  assert.equal(producto.properties.price.type, 'string');
  assert.equal(producto.properties.itemcode.maxLength, 50);
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
  // La documentación pública no elimina los guards de las operaciones.
  const empresas = '/api/v1/admin/catalogo/empresas';
  await request(http).get(empresas).expect(401);
  await request(http).get(empresas).set('Authorization', `Bearer ${regular}`).expect(403);
  await request(http).get(empresas).set('Cookie', `${AUTH_COOKIE}=invalido`).expect(401);
  await request(http).get(empresas).set('Authorization', `Bearer ${jwt.sign({ sub: 3 })}`).expect(401);
  const productos = '/api/v1/admin/catalogo/empresas/10/productos';
  await request(http).get(productos).expect(401);
  await request(http).post(productos).send({}).expect(401);
  await request(http).post(productos).set('Authorization', `Bearer ${regular}`).send({}).expect(403);
  await request(http).get('/api/v1/campo/tolerancias/global/0').expect(401);
  console.log('OK: Swagger público, assets y especificaciones sin sesión, DTOs y endpoints protegidos por JWT/cookie y permisos');
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
