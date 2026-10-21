import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

const db = new PGlite();
const migration = await readFile(
  new URL(
    '../prisma/migrations/20261021200000_canales_plurales/migration.sql',
    import.meta.url,
  ),
  'utf8',
);
try {
  await db.exec(
    'CREATE TABLE empresas(id INTEGER PRIMARY KEY); INSERT INTO empresas VALUES(1),(2);',
  );
  await db.exec(
    await readFile(
      new URL(
        '../prisma/migrations/20261021170000_socios_negocio/migration.sql',
        import.meta.url,
      ),
      'utf8',
    ),
  );
  await db.exec(`
    INSERT INTO tbl_jcanal(empresa_id,"Code","Name") VALUES(1,7,'Mayorista'),(1,8,'Nuevo'),(2,7,'Empresa dos');
    INSERT INTO tbl_jcanales(empresa_id,"Code","Name") VALUES(1,7,'Conflicto'),(1,9,'Plural');
    INSERT INTO tbl_jsubcanal(empresa_id,"Code","Name") VALUES(1,11,'Subcanal');
    INSERT INTO tbl_jsubcanales(empresa_id,"Code","Name") VALUES(1,11,NULL);
    INSERT INTO tbl_ocrd(empresa_id,"CardCode","U_jCANAL","U_jSUBCANAL") VALUES(1,'0001','0007','11'),(2,'0001','7',NULL);
    INSERT INTO tbl_crd1(empresa_id,"CardCode","Address","Street") VALUES(1,'0001','Central','Calle 1'),(1,'0001','Sucursal','Calle 2');
  `);
  await assert.rejects(db.exec(migration), /Canales incompatibles/);
  await db.exec('ROLLBACK');
  assert.equal(
    (await db.query("SELECT to_regclass('tbl_jcanal')::text AS tabla")).rows[0]
      .tabla,
    'tbl_jcanal',
  );
  await db.exec(
    `UPDATE tbl_jcanales SET "Name"='Mayorista' WHERE empresa_id=1 AND "Code"=7`,
  );
  const before = (await db.query('SELECT * FROM tbl_ocrd ORDER BY id')).rows;
  const addresses = (await db.query('SELECT * FROM tbl_crd1 ORDER BY id')).rows;
  await db.exec(migration);
  for (const t of ['tbl_jcanal', 'tbl_jsubcanal'])
    assert.equal(
      (await db.query('SELECT to_regclass($1)::text AS tabla', [t])).rows[0]
        .tabla,
      null,
    );
  assert.deepEqual(
    (
      await db.query(
        'SELECT empresa_id,"Code","Name" FROM tbl_jcanales ORDER BY empresa_id,"Code"',
      )
    ).rows,
    [
      { empresa_id: 1, Code: 7, Name: 'Mayorista' },
      { empresa_id: 1, Code: 8, Name: 'Nuevo' },
      { empresa_id: 1, Code: 9, Name: 'Plural' },
      { empresa_id: 2, Code: 7, Name: 'Empresa dos' },
    ],
  );
  assert.equal(
    (await db.query('SELECT "Name" FROM tbl_jsubcanales')).rows[0].Name,
    'Subcanal',
  );
  assert.deepEqual(
    (await db.query('SELECT * FROM tbl_ocrd ORDER BY id')).rows,
    before,
  );
  assert.deepEqual(
    (await db.query('SELECT * FROM tbl_crd1 ORDER BY id')).rows,
    addresses,
  );
  const resolved = await db.query(
    `SELECT p."Name" FROM tbl_ocrd s JOIN tbl_jcanales p ON p.empresa_id=s.empresa_id AND p."Code"=s."U_jCANAL"::integer ORDER BY s.id`,
  );
  assert.deepEqual(resolved.rows, [
    { Name: 'Mayorista' },
    { Name: 'Empresa dos' },
  ]);
  await db.exec(
    `INSERT INTO tbl_jcanales(empresa_id,"Name") VALUES(1,'Automático')`,
  );
  assert.equal(
    (await db.query('SELECT max("Code") AS code FROM tbl_jcanales')).rows[0]
      .code,
    10,
  );
  console.log(
    'OK: migración a canales plurales, DROP de singulares, preservación de códigos/direcciones/empresas y rechazo atómico de conflictos',
  );
} finally {
  await db.close();
}
