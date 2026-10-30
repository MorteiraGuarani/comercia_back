import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
const db = new PGlite();
try {
  await db.exec(`CREATE TABLE modulos (id serial PRIMARY KEY,nombre text,ruta text UNIQUE,icono text,orden int,activo boolean,updated_at timestamp);
    CREATE TABLE paginas (id serial PRIMARY KEY,modulo_id int REFERENCES modulos(id),nombre text,ruta text,orden int,activo boolean,updated_at timestamp,icono text,UNIQUE(modulo_id,ruta));
    INSERT INTO modulos(nombre,ruta,orden,activo,updated_at) VALUES ('Gestion','gestion-campo',1,true,CURRENT_TIMESTAMP);
    INSERT INTO paginas(modulo_id,nombre,ruta,orden,activo,updated_at) VALUES (1,'Visitas','visitas',3,true,CURRENT_TIMESTAMP);`);
  const sql = await readFile(new URL('../prisma/migrations/20261030150000_itinerario_supervisor_jefatura/migration.sql', import.meta.url), 'utf8');
  await db.exec(sql);
  await db.exec(sql);
  const rows = (await db.query(`SELECT m.ruta modulo,p.ruta,p.orden,p.activo FROM paginas p JOIN modulos m ON m.id=p.modulo_id ORDER BY m.ruta,p.ruta`)).rows;
  assert.deepEqual(rows, [{ modulo:'gestion-campo', ruta:'itinerario', orden:4, activo:true },{ modulo:'gestion-campo', ruta:'visitas', orden:3, activo:true },{ modulo:'jefatura', ruta:'avance', orden:1, activo:true }]);
  console.log('OK: migracion idempotente conserva paginas existentes y agrega itinerario y jefatura');
} finally { await db.close(); }
