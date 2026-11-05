import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

const db = new PGlite();
try {
  // Estado previo de producción: tbl_oagp con datos y tbl_oslp con el formato viejo.
  await db.exec(`
    CREATE TABLE empresas(id INTEGER PRIMARY KEY); INSERT INTO empresas VALUES (1), (2);
    CREATE TABLE tbl_oagp (id BIGSERIAL PRIMARY KEY, empresa_id INTEGER NOT NULL REFERENCES empresas(id),
      "AgentCode" VARCHAR(200), "AgentName" VARCHAR(200), "Memo" VARCHAR(200));
    CREATE UNIQUE INDEX uq_tbl_oagp_empresa_clave ON tbl_oagp (empresa_id, "AgentCode");
    INSERT INTO tbl_oagp (empresa_id, "AgentCode", "AgentName") VALUES (2, 'SUP01', 'Ana');
    CREATE TABLE tbl_oslp (id BIGSERIAL PRIMARY KEY, empresa_id INTEGER NOT NULL REFERENCES empresas(id),
      "SlpCode" INTEGER, "SlpName" VARCHAR(200), "Memo" VARCHAR(200), "Active" VARCHAR(1) NOT NULL DEFAULT 'Y', "Fax" VARCHAR(200));
    INSERT INTO tbl_oslp (empresa_id, "SlpCode", "SlpName") VALUES (2, 1, 'Luis');
  `);
  await db.exec(
    await readFile(
      new URL(
        '../prisma/migrations/20261104120000_tablas_sap_vendedores_almacenes/migration.sql',
        import.meta.url,
      ),
      'utf8',
    ),
  );
  const { rows } = await db.query(
    `SELECT table_name, column_name, data_type, character_maximum_length AS largo, is_nullable
     FROM information_schema.columns WHERE table_schema='public'
     AND table_name IN ('tbl_oagp','tbl_oslp','tbl_owhs','tbl_oclp','tbl_jfdv')
     AND column_name NOT IN ('id','empresa_id') ORDER BY table_name, ordinal_position`,
  );
  const col = (t) =>
    rows
      .filter((r) => r.table_name === t)
      .map(
        (r) => `${r.column_name}:${r.largo ?? r.data_type}:${r.is_nullable}`,
      );
  assert.deepEqual(col('tbl_oagp'), [
    'AgentCode:150:NO',
    'AgentName:250:YES',
    'Memo:250:YES',
  ]);
  assert.deepEqual(col('tbl_oslp'), [
    'SalesEmployeeCode:integer:NO',
    'SalesEmployeeName:150:YES',
    'Remarks:150:YES',
    'CommissionForSalesEmployee:integer:YES',
    'CommissionGroup:integer:YES',
    'Locked:3:YES',
    'EmployeeID:integer:YES',
    'Active:3:YES',
    'Telephone:100:YES',
    'Mobile:100:YES',
    'Fax:100:YES',
    'Email:200:YES',
  ]);
  assert.deepEqual(col('tbl_owhs'), [
    'WarehouseCode:100:NO',
    'WarehouseName:300:YES',
    'Location:integer:YES',
    'GlobalLocationNumber:100:YES',
  ]);
  assert.deepEqual(col('tbl_oclp'), ['Code:integer:NO', 'Name:100:YES']);
  assert.deepEqual(col('tbl_jfdv'), [
    'Code:20:NO',
    'Name:150:YES',
    'U_ESACALA:100:YES',
    'U_TIPO:100:YES',
    'U_ACTIVO:100:YES',
  ]);
  // tbl_oagp conserva sus filas; tbl_oslp se recrea vacía.
  assert.equal(
    (await db.query(`SELECT "AgentName" FROM tbl_oagp`)).rows[0].AgentName,
    'Ana',
  );
  assert.equal(
    (await db.query(`SELECT count(*)::int n FROM tbl_oslp`)).rows[0].n,
    0,
  );
  // Clave única por empresa: la misma clave en otra empresa sí entra.
  for (const [tabla, columna, valor] of [
    ['tbl_oslp', 'SalesEmployeeCode', 1],
    ['tbl_owhs', 'WarehouseCode', "'01'"],
    ['tbl_oclp', 'Code', 1],
    ['tbl_jfdv', 'Code', "'001'"],
  ]) {
    await db.exec(
      `INSERT INTO ${tabla} (empresa_id, "${columna}") VALUES (1, ${valor}), (2, ${valor});`,
    );
    await assert.rejects(
      db.exec(
        `INSERT INTO ${tabla} (empresa_id, "${columna}") VALUES (1, ${valor});`,
      ),
    );
  }
  console.log(
    'OK: tbl_oagp ajustada sin perder filas, tbl_oslp recreada y tbl_owhs, tbl_oclp y tbl_jfdv creadas con clave única por empresa',
  );
} finally {
  await db.close();
}
