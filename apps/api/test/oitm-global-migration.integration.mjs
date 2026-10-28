import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

const db = new PGlite();
try {
  await db.exec(`
    CREATE TABLE tbl_oitm (id bigint, empresa_id integer, "ItemCode" varchar(15), "TIPO" varchar(50), UNIQUE (empresa_id, "ItemCode"));
    CREATE TABLE tbl_itm1 (empresa_id integer, "ItemCode" varchar(15), FOREIGN KEY (empresa_id, "ItemCode") REFERENCES tbl_oitm(empresa_id, "ItemCode"));
    CREATE TABLE campo_inventario_productos (empresa_id integer, "ItemCode" varchar(15), FOREIGN KEY (empresa_id, "ItemCode") REFERENCES tbl_oitm(empresa_id, "ItemCode"));
    CREATE TABLE campo_inventario_cargas (empresa_id integer, "ItemCode" varchar(15), FOREIGN KEY (empresa_id, "ItemCode") REFERENCES tbl_oitm(empresa_id, "ItemCode"));
    INSERT INTO tbl_oitm VALUES (1, 2, 'A', '2');
    INSERT INTO tbl_itm1 VALUES (2, 'A');
    INSERT INTO campo_inventario_productos VALUES (2, 'A');
    INSERT INTO campo_inventario_cargas VALUES (2, 'A');
  `);
  const sql = await readFile(
    new URL(
      '../prisma/migrations/20261028195000_oitm_global_u_beas_vg/migration.sql',
      import.meta.url,
    ),
    'utf8',
  );
  await db.exec(sql);
  const columns = await db.query(
    `SELECT column_name FROM information_schema.columns WHERE table_name='tbl_oitm' ORDER BY ordinal_position`,
  );
  assert.deepEqual(
    columns.rows.map((r) => r.column_name),
    [
      'ItemCode',
      'ItemName',
      'TaxCodeAR',
      'ItmsGrpCod',
      'QryInventario',
      'SWeight1',
      'DfltWH',
      'validFor',
      'frozenFor',
      'U_ItemQty',
      'U_beas_vg',
    ],
  );
  assert.equal(
    (await db.query('SELECT count(*)::int AS n FROM tbl_itm1')).rows[0].n,
    0,
  );
  assert.equal(
    (await db.query('SELECT count(*)::int AS n FROM campo_inventario_cargas'))
      .rows[0].n,
    1,
  );
  await db.exec(
    `INSERT INTO tbl_oitm ("ItemCode", "U_beas_vg") VALUES ('A', '2')`,
  );
  await assert.rejects(
    db.exec(`INSERT INTO tbl_oitm ("ItemCode") VALUES ('A')`),
  );
  console.log(
    'OK: OITM exacta, claves, reemplazo de precios y conservación de filas de inventario.',
  );
} finally {
  await db.close();
}
