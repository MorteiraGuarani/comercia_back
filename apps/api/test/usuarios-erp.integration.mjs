// SQL en PostgreSQL aislado y contratos HTTP/Swagger: no usa credenciales reales.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { PGlite } from '@electric-sql/pglite';

const db = new PGlite();
const limites = {
  ERP_CanalVenta: 50,
  ERP_Almacen: 8,
  ERP_Supervisor: 30,
  ERP_Repositor: 50,
  ERP_Impulsador: 50,
};
const campos = [...Object.keys(limites), 'ERP_Vendedor'];
try {
  await db.exec(
    "CREATE TABLE usuarios (id INTEGER PRIMARY KEY, nombre TEXT NOT NULL); INSERT INTO usuarios VALUES (1, 'Ana');",
  );
  await db.exec(
    await readFile(
      new URL(
        '../prisma/migrations/20261028160000_usuarios_campos_erp/migration.sql',
        import.meta.url,
      ),
      'utf8',
    ),
  );
  const { rows } = await db.query('SELECT * FROM usuarios WHERE id = 1');
  assert.equal(rows[0].nombre, 'Ana');
  for (const campo of campos) assert.equal(rows[0][campo], null, campo);
  for (const [campo, maximo] of Object.entries(limites)) {
    await db.query(`UPDATE usuarios SET "${campo}" = $1 WHERE id = 1`, [
      'A'.repeat(maximo),
    ]);
    await assert.rejects(
      db.query(`UPDATE usuarios SET "${campo}" = $1 WHERE id = 1`, [
        'A'.repeat(maximo + 1),
      ]),
      /too long/,
    );
  }
  for (const numero of [-2147483648, 0, 2147483647]) {
    await db.query('UPDATE usuarios SET "ERP_Vendedor" = $1 WHERE id = 1', [
      numero,
    ]);
  }
  await assert.rejects(
    db.query(
      'UPDATE usuarios SET "ERP_Vendedor" = $1 WHERE id = 1',
      [2147483648],
    ),
    /out of range/,
  );
} finally {
  await db.close();
}

const require = createRequire(import.meta.url);
require('reflect-metadata');
const { Test } = require('@nestjs/testing');
const { ValidationPipe, VersioningType } = require('@nestjs/common');
const { ConfigService } = require('@nestjs/config');
const request = require('supertest');
const {
  UsuariosController,
} = require('../dist/src/usuarios/usuarios.controller.js');
const {
  AdminUsuariosController,
} = require('../dist/src/usuarios/admin-usuarios.controller.js');
const { UsuariosService } = require('../dist/src/usuarios/usuarios.service.js');
const { JwtAuthGuard } = require('../dist/src/auth/jwt-auth.guard.js');
const { SuperadminGuard } = require('../dist/src/auth/superadmin.guard.js');
const { configurarSwagger } = require('../dist/src/common/utils/swagger.js');
const recibidos = [];
const servicio = {
  crear: async (_, dto) => {
    recibidos.push(dto);
    return { id: 7, ...dto };
  },
  actualizar: async (_, id, dto) => {
    recibidos.push(dto);
    return { id, ...dto };
  },
  crearLote: async (_, filas) => {
    recibidos.push(filas);
    return { total: filas.length };
  },
};
const guard = {
  canActivate: (contexto) => {
    contexto.switchToHttp().getRequest().usuarioId = 1;
    return true;
  },
};
const modulo = await Test.createTestingModule({
  controllers: [UsuariosController, AdminUsuariosController],
  providers: [
    { provide: UsuariosService, useValue: servicio },
    { provide: ConfigService, useValue: { get: () => true } },
  ],
})
  .overrideGuard(JwtAuthGuard)
  .useValue(guard)
  .overrideGuard(SuperadminGuard)
  .useValue(guard)
  .compile();
const app = modulo.createNestApplication({ logger: false });
app.setGlobalPrefix('api');
app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
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
try {
  const http = app.getHttpServer();
  const { body: doc } = await request(http).get('/api/docs-json').expect(200);
  for (const nombre of [
    'CrearUsuarioDto',
    'ActualizarUsuarioDto',
    'ActualizarUsuarioLoteDto',
    'UsuarioAdminRespuestaDto',
  ]) {
    const esquema = doc.components.schemas[nombre];
    for (const [campo, maximo] of Object.entries(limites)) {
      assert.equal(
        esquema.properties[campo].type,
        'string',
        `${nombre}.${campo}`,
      );
      assert.equal(esquema.properties[campo].maxLength, maximo);
      assert.equal(esquema.properties[campo].nullable, true);
    }
    assert.equal(esquema.properties.ERP_Vendedor.type, 'integer');
    assert.equal(esquema.properties.ERP_Vendedor.minimum, -2147483648);
    assert.equal(esquema.properties.ERP_Vendedor.maximum, 2147483647);
    assert.equal(esquema.properties.passwordHash, undefined);
  }
  for (const base of ['/api/v1/usuarios', '/api/v1/admin/usuarios']) {
    assert.match(
      doc.paths[base].get.responses['200'].content['application/json'].schema
        .$ref,
      /PaginaUsuariosRespuestaDto$/,
    );
    const validos = {
      ERP_CanalVenta: ' MAYORISTA ',
      ERP_Almacen: 'ALM01',
      ERP_Supervisor: 'SUP01',
      ERP_Vendedor: 0,
      ERP_Repositor: 'REP01',
      ERP_Impulsador: 'IMP01',
    };
    const { body } = await request(http).post(base).send(validos).expect(201);
    assert.equal(body.ERP_CanalVenta, 'MAYORISTA');
    assert.equal(body.ERP_Vendedor, 0);
    const { body: vaciados } = await request(http)
      .patch(`${base}/7`)
      .send({ ERP_Almacen: '', ERP_Vendedor: null })
      .expect(200);
    assert.equal(vaciados.ERP_Almacen, null);
    assert.equal(vaciados.ERP_Vendedor, null);
    for (const [campo, maximo] of Object.entries(limites)) {
      await request(http)
        .patch(`${base}/7`)
        .send({ [campo]: 'A'.repeat(maximo + 1) })
        .expect(400);
    }
    for (const valor of [1.5, true, 'ABC', 2147483648, -2147483649]) {
      await request(http)
        .patch(`${base}/7`)
        .send({ ERP_Vendedor: valor })
        .expect(400);
    }
  }
  await request(http)
    .post('/api/v1/admin/usuarios')
    .send([{ ERP_Vendedor: 0 }, { ERP_Almacen: 'A'.repeat(9) }])
    .expect(201);
  const filas = recibidos.at(-1);
  assert.equal(filas[0].dto.ERP_Vendedor, 0);
  assert.match(filas[1].error, /ERP_Almacen/);
} finally {
  await app.close();
}
console.log(
  'Usuarios ERP: migración aislada, HTTP individual/bulk y Swagger verificados.',
);
