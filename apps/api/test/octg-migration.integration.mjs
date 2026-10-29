import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
const db = new PGlite();
try {
  await db.exec(`CREATE TABLE empresas (id integer PRIMARY KEY);
    INSERT INTO empresas VALUES (1), (2);
    CREATE TABLE tbl_octg (id bigserial PRIMARY KEY, empresa_id integer NOT NULL REFERENCES empresas(id), "GroupNum" integer, "PymntGroup" varchar(200));
    INSERT INTO tbl_octg (empresa_id,"GroupNum","PymntGroup") VALUES (1,7,'Anterior');`);
  await db.exec(await readFile(new URL('../prisma/migrations/20261029200000_recrear_octg/migration.sql', import.meta.url), 'utf8'));
  assert.equal((await db.query('SELECT count(*)::int AS n FROM tbl_octg')).rows[0].n, 0);
  const cols = (await db.query(`SELECT column_name,data_type,character_maximum_length,is_nullable FROM information_schema.columns WHERE table_name='tbl_octg' ORDER BY ordinal_position`)).rows;
  assert.deepEqual(cols.map(c=>c.column_name), ['id','empresa_id','GroupNumber','PaymentTermsGroupName','PriceListNo']);
  assert.deepEqual(cols.slice(2).map(c=>[c.data_type,c.character_maximum_length,c.is_nullable]), [['integer',null,'YES'],['character varying',250,'YES'],['integer',null,'YES']]);
  await db.exec(`INSERT INTO tbl_octg(empresa_id,"GroupNumber","PaymentTermsGroupName","PriceListNo") VALUES (1,7,'Contado',3),(2,7,'Otra',4);`);
  await assert.rejects(db.exec(`INSERT INTO tbl_octg(empresa_id,"GroupNumber") VALUES (1,7)`));
  await assert.rejects(db.exec(`INSERT INTO tbl_octg(empresa_id,"GroupNumber") VALUES (3,8)`));
  console.log('OK: recreacion, columnas, perdida de datos prevista y aislamiento por empresa');
} finally { await db.close(); }
