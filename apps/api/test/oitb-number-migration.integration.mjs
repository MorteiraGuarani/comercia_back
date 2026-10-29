import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

const db = new PGlite();
try {
  await db.exec('CREATE TABLE empresas(id INTEGER PRIMARY KEY); INSERT INTO empresas VALUES (1), (2);');
  await db.exec(await readFile(new URL('../prisma/migrations/20261029120000_catalogos_erp_adicionales/migration.sql', import.meta.url), 'utf8'));
  await db.exec(`INSERT INTO tbl_oitb(empresa_id, "ItmsGrpCod", "ItmsGrpNam") VALUES (1,100,'Anterior'),(2,100,'Anterior');
    INSERT INTO tbl_omrc(empresa_id, "FirmCode", "FirmName") VALUES (1,42,'Conservar');`);
  await db.exec(await readFile(new URL('../prisma/migrations/20261029140000_oitb_number_groupname/migration.sql', import.meta.url), 'utf8'));

  assert.equal((await db.query('SELECT count(*)::int AS total FROM tbl_oitb')).rows[0].total, 0);
  assert.equal((await db.query('SELECT "FirmName" FROM tbl_omrc')).rows[0].FirmName, 'Conservar');
  const columnas = await db.query(`SELECT column_name, data_type, character_maximum_length, is_nullable
    FROM information_schema.columns WHERE table_schema='public' AND table_name='tbl_oitb'
      AND column_name NOT IN ('id','empresa_id') ORDER BY ordinal_position`);
  assert.deepEqual(columnas.rows, [
    { column_name: 'Number', data_type: 'integer', character_maximum_length: null, is_nullable: 'NO' },
    { column_name: 'GroupName', data_type: 'character varying', character_maximum_length: 200, is_nullable: 'YES' },
  ]);
  await db.exec(`INSERT INTO tbl_oitb(empresa_id,"Number","GroupName") VALUES (1,100,NULL),(2,100,'Grupo');`);
  await assert.rejects(db.exec('INSERT INTO tbl_oitb(empresa_id,"Number") VALUES (1,100)'));
  await assert.rejects(db.exec('INSERT INTO tbl_oitb(empresa_id,"Number") VALUES (3,1)'));
  await assert.rejects(db.exec('INSERT INTO tbl_oitb(empresa_id,"Number") VALUES (1,NULL)'));
  await assert.rejects(db.exec(`INSERT INTO tbl_oitb(empresa_id,"Number","GroupName") VALUES (1,101,'${'x'.repeat(201)}')`));
  console.log('OK: OITB vacía, Number int4, GroupName varchar(200), aislamiento y demás tablas intactas');
} finally {
  await db.close();
}
