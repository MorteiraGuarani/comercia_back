import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
const db = new PGlite();
try {
  await db.exec(`CREATE TABLE empresas (id integer PRIMARY KEY);
    INSERT INTO empresas VALUES (1), (2);
    CREATE TABLE tbl_omrc (id bigserial PRIMARY KEY, empresa_id integer NOT NULL REFERENCES empresas(id), "FirmCode" integer, "FirmName" varchar(200));
    INSERT INTO tbl_omrc (empresa_id,"FirmCode","FirmName") VALUES (1,7,'Anterior');`);
  await db.exec(await readFile(new URL('../prisma/migrations/20261030120000_recrear_omrc/migration.sql', import.meta.url), 'utf8'));
  assert.equal((await db.query('SELECT count(*)::int AS n FROM tbl_omrc')).rows[0].n, 0);
  const cols = (await db.query(`SELECT column_name,data_type,character_maximum_length,is_nullable FROM information_schema.columns WHERE table_name='tbl_omrc' ORDER BY ordinal_position`)).rows;
  assert.deepEqual(cols.map(c=>c.column_name), ['id','empresa_id','Code','ManufacturerName']);
  assert.deepEqual(cols.slice(2).map(c=>[c.data_type,c.character_maximum_length,c.is_nullable]), [['integer',null,'YES'],['character varying',250,'YES']]);
  await db.exec(`INSERT INTO tbl_omrc(empresa_id,"Code","ManufacturerName") VALUES (1,7,'Fabricante'),(2,7,'Otro');`);
  await assert.rejects(db.exec(`INSERT INTO tbl_omrc(empresa_id,"Code") VALUES (1,7)`));
  await assert.rejects(db.exec(`INSERT INTO tbl_omrc(empresa_id,"Code") VALUES (3,8)`));
  console.log('OK: recreacion, columnas, perdida de datos prevista y aislamiento por empresa');
} finally { await db.close(); }
