import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

const db = new PGlite();
try {
  await db.exec(`
    CREATE TABLE empresas (id integer PRIMARY KEY);
    INSERT INTO empresas VALUES (2);
    CREATE TABLE tbl_oitm (id bigint, empresa_id integer, "ItemCode" varchar(15), "TIPO" varchar(50), UNIQUE (empresa_id, "ItemCode"));
    CREATE TABLE tbl_itm1 (id bigserial UNIQUE, empresa_id integer NOT NULL, "ItemCode" varchar(50) NOT NULL, "PriceList" integer NOT NULL, "Price" numeric(21,6), PRIMARY KEY (empresa_id, "ItemCode", "PriceList"), FOREIGN KEY (empresa_id, "ItemCode") REFERENCES tbl_oitm(empresa_id, "ItemCode"));
    INSERT INTO tbl_oitm VALUES (1, 2, 'OLD', 'old');
    INSERT INTO tbl_itm1 (empresa_id, "ItemCode", "PriceList") VALUES (2, 'OLD', 1);
    CREATE TABLE _oitm_import_20261028 (empresa_id integer NOT NULL, oitm jsonb NOT NULL, itm1 jsonb NOT NULL);
  `);
  // Datos ficticios: la prueba debe funcionar en un checkout limpio, sin
  // depender de los archivos privados usados en el despliegue de producción.
  const articles = Array.from({ length: 1122 }, (_, i) => ({
    ItemCode: i === 0 ? 'AV0001' : `P${i}`,
    ItemName: `Artículo ${i}`,
    U_beas_vg: '2',
  }));
  const master = JSON.stringify(articles);
  const prices = JSON.stringify(
    articles.flatMap((article) =>
      Array.from({ length: 6 }, (_, i) => ({
        ItemCode: article.ItemCode,
        PriceList: i + 1,
        Price: '1.000000',
      })),
    ).slice(0, 6537),
  );
  await db.query(
    'INSERT INTO _oitm_import_20261028 VALUES (2, $1::jsonb, $2::jsonb)',
    [master, prices],
  );
  const sql = await readFile(
    new URL(
      '../prisma/migrations/20261028195000_oitm_global_u_beas_vg/migration.sql',
      import.meta.url,
    ),
    'utf8',
  );
  await db.exec(sql);
  assert.equal(
    (await db.query('SELECT count(*)::int n FROM tbl_oitm')).rows[0].n,
    1122,
  );
  assert.equal(
    (await db.query('SELECT count(*)::int n FROM tbl_itm1')).rows[0].n,
    6537,
  );
  assert.deepEqual(
    (
      await db.query('SELECT "U_beas_vg" FROM tbl_oitm WHERE "ItemCode"=$1', [
        'AV0001',
      ])
    ).rows,
    [{ U_beas_vg: '2' }],
  );
  assert.equal(
    (
      await db.query(
        "SELECT to_regclass('public._oitm_import_20261028') IS NULL AS removed",
      )
    ).rows[0].removed,
    true,
  );
  console.log(
    'OK: reemplazo atómico de 1.122 artículos y 6.537 precios de prueba.',
  );
} finally {
  await db.close();
}
