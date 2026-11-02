import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

// Administración de empresa: módulo con Usuarios y Organigrama, asignado solo
// a los roles de back office de cada empresa, sin pisar lo ya configurado.
const db = new PGlite();
try {
  await db.exec(`CREATE TABLE modulos (id serial PRIMARY KEY,nombre text,ruta text UNIQUE,icono text,orden int,activo boolean,updated_at timestamp);
    CREATE TABLE paginas (id serial PRIMARY KEY,modulo_id int REFERENCES modulos(id) ON DELETE CASCADE,nombre text,ruta text,orden int,activo boolean,updated_at timestamp,icono text,UNIQUE(modulo_id,ruta));
    CREATE TABLE roles (id serial PRIMARY KEY,descripcion text,empresa_id int);
    CREATE TABLE empresa_modulos (id serial PRIMARY KEY,empresa_id int,modulo_id int REFERENCES modulos(id) ON DELETE CASCADE,todas_las_paginas boolean,rol_ids int[],created_at timestamp,UNIQUE(empresa_id,modulo_id));
    CREATE TABLE empresa_paginas (id serial PRIMARY KEY,empresa_id int,pagina_id int REFERENCES paginas(id) ON DELETE CASCADE,rol_ids int[],created_at timestamp,UNIQUE(empresa_id,pagina_id));
    INSERT INTO roles(id,descripcion,empresa_id) VALUES
      (11,'BackOffice_Repositores_Moderno',2),(12,'BackOffice_Impulsadores',2),(22,'Backoffice_Repositores_Tradicional',2),
      (9,'Repositor_Moderno',2),(15,'AdminTI',2),(30,'Back Office',3),(40,'Gerente',4);`);
  const sql = await readFile(new URL('../prisma/migrations/20261102130000_modulo_administracion/migration.sql', import.meta.url), 'utf8');
  await db.exec(sql);
  await db.exec(sql);
  const modulo = (await db.query(`SELECT nombre,ruta,orden FROM modulos`)).rows;
  assert.deepEqual(modulo, [{ nombre: 'Administración de empresa', ruta: 'administracion', orden: 30 }]);
  const paginas = (await db.query(`SELECT ruta,orden,icono FROM paginas ORDER BY orden`)).rows;
  assert.deepEqual(paginas, [
    { ruta: 'usuarios', orden: 1, icono: 'clientes' },
    { ruta: 'organigrama', orden: 2, icono: 'equipo' },
  ]);
  const porEmpresa = (await db.query(`SELECT empresa_id,todas_las_paginas,rol_ids FROM empresa_modulos ORDER BY empresa_id`)).rows;
  assert.deepEqual(porEmpresa, [
    { empresa_id: 2, todas_las_paginas: false, rol_ids: [11, 12, 22] },
    { empresa_id: 3, todas_las_paginas: false, rol_ids: [30] },
  ], 'solo back office; la empresa sin back office no recibe el módulo');
  const accesos = (await db.query(`SELECT ep.empresa_id,p.ruta,ep.rol_ids FROM empresa_paginas ep JOIN paginas p ON p.id=ep.pagina_id ORDER BY 1,2`)).rows;
  assert.deepEqual(accesos, [
    { empresa_id: 2, ruta: 'organigrama', rol_ids: [11, 12, 22] },
    { empresa_id: 2, ruta: 'usuarios', rol_ids: [11, 12, 22] },
    { empresa_id: 3, ruta: 'organigrama', rol_ids: [30] },
    { empresa_id: 3, ruta: 'usuarios', rol_ids: [30] },
  ]);
  console.log('OK: Administración de empresa con Usuarios y Organigrama, asignada a back office e idempotente');
} finally { await db.close(); }
