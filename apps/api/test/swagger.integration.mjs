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
const { PrismaService } = require('../dist/src/prisma/prisma.service.js');
const { JwtAuthGuard } = require('../dist/src/auth/jwt-auth.guard.js');
const { SuperadminGuard } = require('../dist/src/auth/superadmin.guard.js');
const { AUTH_COOKIE } = require('../dist/src/auth/auth.constants.js');
const jwt = new JwtService({ secret: 'clave-solo-para-pruebas-aisladas-swagger' });

async function crearApp(enabled) {
  const module = await Test.createTestingModule({
    controllers: [ProductosController],
    providers: [
      JwtAuthGuard, SuperadminGuard,
      { provide: ProductosService, useValue: {} },
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
  const admin = jwt.sign({ sub: 1 });
  const regular = jwt.sign({ sub: 2 });
  for (const path of ['/api/docs', '/api/docs-json', '/api/docs-yaml', '/api/docs/swagger-ui-init.js']) {
    await request(http).get(path).expect(401);
    await request(http).get(path).set('Authorization', `Bearer ${regular}`).expect(403);
    const response = await request(http).get(path).set('Authorization', `Bearer ${admin}`).expect(200);
    assert.equal(response.headers['cache-control'], 'no-store');
  }
  await request(http).get('/api/docs-json').set('Cookie', `${AUTH_COOKIE}=${jwt.sign({ sub: 3 })}`).expect(401);
  await request(http).get('/api/docs-json').set('Cookie', `${AUTH_COOKIE}=invalido`).expect(401);
  const { body: doc } = await request(http).get('/api/docs-json').set('Cookie', `${AUTH_COOKIE}=${admin}`).expect(200);
  assert.equal(doc.info.title, 'Comercia API');
  assert.ok(doc.paths['/api/v1/admin/catalogo/empresas/{empresaId}/productos'].post);
  assert.ok(doc.paths['/api/v1/admin/catalogo/empresas/{empresaId}/precios/{id}'].delete);
  assert.equal(doc.components.schemas.PrecioCatalogoDto.properties.precio.type, 'string');
  assert.equal(doc.components.schemas.CrearProductoDto.properties.cardCode.maxLength, 50);
  assert.ok(doc.components.schemas.CrearProductoDto.required.includes('inventario'));
  assert.ok(doc.components.securitySchemes.bearer);
  assert.ok(doc.components.securitySchemes.cookie);
  console.log('OK: Swagger real compilado, DTOs, JWT/cookie, superadmin, activos, assets y especificaciones protegidas');
} finally {
  await app.close();
}
const disabled = await crearApp(false);
try {
  await request(disabled.getHttpServer()).get('/api/docs').expect(404);
  await request(disabled.getHttpServer()).get('/api/docs-json').expect(404);
  console.log('OK: SWAGGER_ENABLED=false desactiva UI y especificacion');
} finally {
  await disabled.close();
}
