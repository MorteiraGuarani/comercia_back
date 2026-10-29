import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

const db = new PGlite();
try {
  await db.exec(`CREATE TABLE tbl_oitm ("ItemCode" varchar(15) NOT NULL UNIQUE, "ItemName" varchar(200));
    INSERT INTO tbl_oitm VALUES ('EXISTENTE', 'Conservar');`);
  await db.exec(await readFile(new URL('../prisma/migrations/20261029180000_oitm_itemcode_100/migration.sql', import.meta.url), 'utf8'));
  const column = await db.query(`SELECT character_maximum_length, is_nullable FROM information_schema.columns WHERE table_name='tbl_oitm' AND column_name='ItemCode'`);
  assert.deepEqual(column.rows, [{ character_maximum_length: 100, is_nullable: 'NO' }]);
  assert.deepEqual((await db.query('SELECT "ItemCode", "ItemName" FROM tbl_oitm')).rows, [{ ItemCode: 'EXISTENTE', ItemName: 'Conservar' }]);
  await db.query('INSERT INTO tbl_oitm ("ItemCode") VALUES ($1)', ['x'.repeat(100)]);
  await assert.rejects(db.query('INSERT INTO tbl_oitm ("ItemCode") VALUES ($1)', ['x'.repeat(101)]));
  await assert.rejects(db.query('INSERT INTO tbl_oitm ("ItemCode") VALUES ($1)', ['EXISTENTE']));
  console.log('OK: ItemCode admite 100 caracteres, conserva datos y unicidad.');
} finally {
  await db.close();
}
