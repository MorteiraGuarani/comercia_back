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
  // Desempeño de Jefatura: la reciben los mismos roles que ya tienen Avance.
  await db.exec(`CREATE TABLE empresa_paginas (id serial PRIMARY KEY,empresa_id int,pagina_id int REFERENCES paginas(id) ON DELETE CASCADE,rol_ids int[],created_at timestamp,UNIQUE(empresa_id,pagina_id));
    INSERT INTO empresa_paginas(empresa_id,pagina_id,rol_ids,created_at) SELECT 7,id,ARRAY[3,5],CURRENT_TIMESTAMP FROM paginas WHERE ruta='avance';`);
  const desempeno = await readFile(new URL('../prisma/migrations/20261030200000_jefatura_desempeno/migration.sql', import.meta.url), 'utf8');
  await db.exec(desempeno);
  await db.exec(desempeno);
  const accesos = (await db.query(`SELECT p.ruta,p.nombre,p.orden,ep.empresa_id,ep.rol_ids FROM empresa_paginas ep JOIN paginas p ON p.id=ep.pagina_id ORDER BY p.ruta`)).rows;
  assert.deepEqual(accesos, [
    { ruta:'avance', nombre:'Avance', orden:1, empresa_id:7, rol_ids:[3,5] },
    { ruta:'desempeno', nombre:'Desempeño', orden:2, empresa_id:7, rol_ids:[3,5] },
  ]);
  // Sin Avance: sus roles se suman a Desempeño (vacío = todos) y la página se borra.
  await db.exec(`UPDATE empresa_paginas SET rol_ids = ARRAY[5,9] WHERE pagina_id = (SELECT id FROM paginas WHERE ruta='desempeno');
    INSERT INTO empresa_paginas(empresa_id,pagina_id,rol_ids,created_at) SELECT 8,id,ARRAY[4],CURRENT_TIMESTAMP FROM paginas WHERE ruta='avance';
    INSERT INTO empresa_paginas(empresa_id,pagina_id,rol_ids,created_at) SELECT 8,id,'{}',CURRENT_TIMESTAMP FROM paginas WHERE ruta='desempeno';
    INSERT INTO empresa_paginas(empresa_id,pagina_id,rol_ids,created_at) SELECT 9,id,ARRAY[2],CURRENT_TIMESTAMP FROM paginas WHERE ruta='avance';`);
  const quitar = await readFile(new URL('../prisma/migrations/20261102120000_quitar_jefatura_avance/migration.sql', import.meta.url), 'utf8');
  await db.exec(quitar);
  await db.exec(quitar);
  const finales = (await db.query(`SELECT p.ruta,p.orden,ep.empresa_id,ep.rol_ids FROM empresa_paginas ep JOIN paginas p ON p.id=ep.pagina_id JOIN modulos m ON m.id=p.modulo_id WHERE m.ruta='jefatura' ORDER BY ep.empresa_id`)).rows;
  assert.deepEqual(finales, [
    { ruta:'desempeno', orden:1, empresa_id:7, rol_ids:[3,5,9] },
    { ruta:'desempeno', orden:1, empresa_id:8, rol_ids:[] },
    { ruta:'desempeno', orden:1, empresa_id:9, rol_ids:[2] },
  ]);
  assert.equal((await db.query(`SELECT 1 FROM paginas WHERE ruta='avance'`)).rows.length, 0);
  console.log('OK: migracion idempotente conserva paginas existentes y agrega itinerario, jefatura y su Desempeño con los accesos de Avance; luego quita Avance sin perder accesos');
} finally { await db.close(); }
