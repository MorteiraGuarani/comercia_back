import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

const db = new PGlite();
try {
  await db.exec(
    'CREATE TABLE empresas(id INTEGER PRIMARY KEY); INSERT INTO empresas VALUES (1), (2); CREATE TABLE tbl_oitm (id INTEGER PRIMARY KEY); INSERT INTO tbl_oitm VALUES (42);',
  );
  await db.exec(
    await readFile(
      new URL(
        '../prisma/migrations/20261029120000_catalogos_erp_adicionales/migration.sql',
        import.meta.url,
      ),
      'utf8',
    ),
  );
  const columns = await db.query(
    `SELECT table_name, column_name, data_type, character_maximum_length, is_nullable FROM information_schema.columns WHERE table_schema='public' AND table_name IN ('tbl_omrc','tbl_oscn','tbl_oitb','tbl_jtiposubcanales') AND column_name NOT IN ('id','empresa_id') ORDER BY table_name, ordinal_position`,
  );
  assert.deepEqual(columns.rows, [
    {
      table_name: 'tbl_jtiposubcanales',
      column_name: 'Code',
      data_type: 'character varying',
      character_maximum_length: 50,
      is_nullable: 'NO',
    },
    {
      table_name: 'tbl_jtiposubcanales',
      column_name: 'U_Descripcion',
      data_type: 'character varying',
      character_maximum_length: 120,
      is_nullable: 'YES',
    },
    {
      table_name: 'tbl_oitb',
      column_name: 'ItmsGrpCod',
      data_type: 'integer',
      character_maximum_length: null,
      is_nullable: 'NO',
    },
    {
      table_name: 'tbl_oitb',
      column_name: 'ItmsGrpNam',
      data_type: 'character varying',
      character_maximum_length: 200,
      is_nullable: 'YES',
    },
    {
      table_name: 'tbl_omrc',
      column_name: 'FirmCode',
      data_type: 'integer',
      character_maximum_length: null,
      is_nullable: 'YES',
    },
    {
      table_name: 'tbl_omrc',
      column_name: 'FirmName',
      data_type: 'character varying',
      character_maximum_length: 200,
      is_nullable: 'YES',
    },
    {
      table_name: 'tbl_oscn',
      column_name: 'ItemCode',
      data_type: 'character varying',
      character_maximum_length: 100,
      is_nullable: 'NO',
    },
    {
      table_name: 'tbl_oscn',
      column_name: 'CardCode',
      data_type: 'character varying',
      character_maximum_length: 200,
      is_nullable: 'NO',
    },
    {
      table_name: 'tbl_oscn',
      column_name: 'Substitute',
      data_type: 'character varying',
      character_maximum_length: 200,
      is_nullable: 'NO',
    },
    {
      table_name: 'tbl_oscn',
      column_name: 'Descriptio',
      data_type: 'character varying',
      character_maximum_length: 300,
      is_nullable: 'YES',
    },
  ]);
  await db.exec(`INSERT INTO tbl_omrc(empresa_id,"FirmCode") VALUES (1,NULL),(2,NULL),(1,4),(2,4);
    INSERT INTO tbl_oitb(empresa_id,"ItmsGrpCod") VALUES (1,100),(2,100);
    INSERT INTO tbl_oscn(empresa_id,"ItemCode","CardCode","Substitute") VALUES (1,'001','C1','ALT'),(2,'001','C1','ALT'),(1,'001','C1','OTRO');
    INSERT INTO tbl_jtiposubcanales(empresa_id,"Code") VALUES (1,'001'),(2,'001');`);
  for (const sql of [
    'INSERT INTO tbl_omrc(empresa_id,"FirmCode") VALUES (1,NULL)',
    'INSERT INTO tbl_omrc(empresa_id,"FirmCode") VALUES (1,4)',
    'INSERT INTO tbl_oitb(empresa_id,"ItmsGrpCod") VALUES (1,100)',
    'INSERT INTO tbl_oscn(empresa_id,"ItemCode","CardCode","Substitute") VALUES (1,\'001\',\'C1\',\'ALT\')',
    'INSERT INTO tbl_jtiposubcanales(empresa_id,"Code") VALUES (1,\'001\')',
    'INSERT INTO tbl_oitb(empresa_id,"ItmsGrpCod") VALUES (3,1)',
    'INSERT INTO tbl_oscn(empresa_id,"ItemCode","CardCode","Substitute") VALUES (1,NULL,\'C1\',\'ALT\')',
  ])
    await assert.rejects(db.exec(sql));
  assert.equal((await db.query('SELECT id FROM tbl_oitm')).rows[0].id, 42);
  console.log(
    'OK: tablas ERP, tipos SQL, nulabilidad, claves por empresa y datos existentes',
  );
} finally {
  await db.close();
}
