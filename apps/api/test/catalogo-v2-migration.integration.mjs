import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
const migration = await readFile(
  new URL(
    '../prisma/migrations/20261021190000_catalogo_oitm_precios/migration.sql',
    import.meta.url,
  ),
  'utf8',
);
const db = new PGlite();
try {
  await db.exec(`CREATE TABLE empresas(id INTEGER PRIMARY KEY); INSERT INTO empresas VALUES(1),(2);
 CREATE TABLE tbl_opln(id BIGSERIAL PRIMARY KEY,empresa_id INT NOT NULL,"ListNum" INT,"ListName" VARCHAR(200));
 CREATE UNIQUE INDEX uq_opln ON tbl_opln(empresa_id,"ListNum") NULLS NOT DISTINCT;
 CREATE TABLE tbl_itm1(id BIGSERIAL UNIQUE NOT NULL,empresa_id INT NOT NULL REFERENCES empresas,
 itemcode VARCHAR(50) NOT NULL,itemname VARCHAR(200) NOT NULL,iva SMALLINT NOT NULL,itmsgrpcode INTEGER NOT NULL,
 itmsgrpnam VARCHAR(200),inventory CHAR(1) DEFAULT 'Y',pricelist SMALLINT NOT NULL,pricelistname VARCHAR(200),price NUMERIC(21,6),tipo VARCHAR(50),
 CONSTRAINT tbl_itm1_pkey PRIMARY KEY(empresa_id,itemcode,pricelist));
 ALTER INDEX tbl_itm1_id_key RENAME TO uq_tbl_itm1_id;
 CREATE INDEX idx_tbl_itm1_itemcode ON tbl_itm1(itemcode); CREATE INDEX idx_tbl_itm1_itemname ON tbl_itm1(itemname);
 CREATE INDEX idx_tbl_itm1_itmsgrpcode ON tbl_itm1(itmsgrpcode); CREATE INDEX idx_tbl_itm1_pricelist ON tbl_itm1(pricelist); CREATE INDEX idx_tbl_itm1_tipo ON tbl_itm1(tipo);`);
  await db.exec(
    await readFile(
      new URL(
        '../prisma/migrations/20261014230000_precios_especiales/migration.sql',
        import.meta.url,
      ),
      'utf8',
    ),
  );
  await db.exec(`INSERT INTO tbl_itm1(empresa_id,itemcode,itemname,iva,itmsgrpcode,itmsgrpnam,pricelist,pricelistname,price)
 VALUES(1,'A0001','Artículo',10,100,'Grupo retirado',1,'General',999999999999999.123456),
 (1,'A0001','Artículo',10,100,'Grupo retirado',2,'Mayorista',-1.000001),
 (2,'A0001','Otro artículo',5,1,NULL,1,'Otra empresa',NULL);
 INSERT INTO tbl_ospp(empresa_id,itemcode,cardcode,listpricecod,cardtype,price,cardname) VALUES(1,'A0001','C0001',1,'C',123.123456,'Nombre retirado');
 INSERT INTO tbl_spp1(empresa_id,itemcode,cardcode,linenum,listnum,price,currency,discount,fromdate,todate)
 VALUES(1,'A0001','C0001',0,1,100.000001,'PYG',-5.123456,'2026-10-01','2026-12-31');`);
  const rows = async (sql) => (await db.query(sql)).rows;
  const original = await rows(
    'SELECT id::text,empresa_id,itemcode,pricelist,price::text FROM tbl_itm1 ORDER BY id',
  );
  for (const [change, restore, pattern] of [
    [
      "UPDATE tbl_itm1 SET itemcode=repeat('x',16) WHERE id=1",
      "UPDATE tbl_itm1 SET itemcode='A0001' WHERE id=1",
      /incompatibles/,
    ],
    [
      'UPDATE tbl_itm1 SET itmsgrpcode=32768 WHERE id=1',
      'UPDATE tbl_itm1 SET itmsgrpcode=100 WHERE id=1',
      /incompatibles/,
    ],
    [
      "UPDATE tbl_itm1 SET itemname='Distinto' WHERE id=1",
      "UPDATE tbl_itm1 SET itemname='Artículo' WHERE id=1",
      /Datos generales distintos/,
    ],
    [
      'UPDATE tbl_ospp SET cardcode=NULL',
      "UPDATE tbl_ospp SET cardcode='C0001'",
      /claves o Valid nulos/,
    ],
    [
      'UPDATE tbl_spp1 SET linenum=NULL',
      'UPDATE tbl_spp1 SET linenum=0',
      /claves nulas/,
    ],
  ]) {
    await db.exec(change);
    await assert.rejects(db.exec(migration), pattern);
    await db.exec('ROLLBACK');
    assert.equal(
      (await rows("SELECT to_regclass('tbl_oitm')::text tabla"))[0].tabla,
      null,
    );
    await db.exec(restore);
  }
  await db.exec(migration);
  assert.deepEqual(
    await rows(
      'SELECT id::text,empresa_id,"ItemCode" itemcode,"PriceList" pricelist,"Price"::text price FROM tbl_itm1 ORDER BY id',
    ),
    original,
  );
  assert.equal((await rows('SELECT count(*)::int n FROM tbl_oitm'))[0].n, 2);
  assert.deepEqual(
    await rows(
      'SELECT "ItemName","QryInventario","validFor","frozenFor" FROM tbl_oitm WHERE empresa_id=1',
    ),
    [
      {
        ItemName: 'Artículo',
        QryInventario: 'Y',
        validFor: 'Y',
        frozenFor: 'N',
      },
    ],
  );
  const fields = {
    tbl_oitm: [
      'ItemCode',
      'ItemName',
      'TaxCodeAR',
      'ItmsGrpCod',
      'QryInventario',
      'validFor',
      'frozenFor',
      'TIPO',
    ],
    tbl_itm1: ['ItemCode', 'PriceList', 'Price'],
    tbl_ospp: [
      'ItemCode',
      'CardCode',
      'Price',
      'Currency',
      'Discount',
      'ListNum',
      'Valid',
    ],
    tbl_spp1: [
      'ItemCode',
      'CardCode',
      'LINENUM',
      'Price',
      'Currency',
      'Discount',
      'ListNum',
    ],
    tbl_spp2: [
      'ItemCode',
      'CardCode',
      'SPP1Lnum',
      'SPP2LNum',
      'Amount',
      'Price',
      'Discount',
    ],
  };
  for (const [table, names] of Object.entries(fields)) {
    const columns = (
      await db.query(
        "SELECT column_name,data_type,numeric_precision,numeric_scale,character_maximum_length FROM information_schema.columns WHERE table_schema='public' AND table_name=$1",
        [table],
      )
    ).rows;
    assert.deepEqual(
      columns.map((c) => c.column_name).sort(),
      ['id', 'empresa_id', ...names].sort(),
    );
    for (const c of columns.filter((c) =>
      ['Price', 'Discount', 'Amount'].includes(c.column_name),
    )) {
      assert.equal(c.numeric_precision, 21);
      assert.equal(c.numeric_scale, 6);
    }
    for (const c of columns.filter((c) =>
      ['PriceList', 'ListNum', 'LINENUM', 'SPP1Lnum', 'SPP2LNum'].includes(
        c.column_name,
      ),
    ))
      assert.equal(c.data_type, 'integer');
    if (table === 'tbl_oitm')
      assert.equal(
        columns.find((c) => c.column_name === 'ItemCode')
          .character_maximum_length,
        15,
      );
  }
  assert.equal(
    (
      await rows(
        'SELECT itmsgrpnam FROM respaldo_catalogo_20261021.tbl_itm1 WHERE id=1',
      )
    )[0].itmsgrpnam,
    'Grupo retirado',
  );
  assert.ok(
    (await rows('SELECT fromdate FROM respaldo_catalogo_20261021.tbl_spp1'))[0]
      .fromdate,
  );
  assert.equal(
    (
      await rows(
        'SELECT "ListName" FROM tbl_opln WHERE empresa_id=1 AND "ListNum"=2',
      )
    )[0].ListName,
    'Mayorista',
  );
  await assert.rejects(
    db.exec(
      `INSERT INTO tbl_itm1(empresa_id,"ItemCode","PriceList") VALUES(1,'AUSENTE',1)`,
    ),
    /foreign key/,
  );
  await assert.rejects(
    db.exec(`DELETE FROM tbl_oitm WHERE empresa_id=1`),
    /foreign key/,
  );
  await db.exec(`UPDATE tbl_oitm SET "ItemCode"='NUEVO' WHERE empresa_id=1`);
  assert.equal(
    (
      await rows(
        `SELECT count(*)::int n FROM tbl_itm1 WHERE "ItemCode"='NUEVO'`,
      )
    )[0].n,
    2,
  );
  await db.exec(
    `INSERT INTO tbl_itm1(empresa_id,"ItemCode","PriceList","Price") VALUES(1,'NUEVO',2147483647,1.123456) ON CONFLICT DO NOTHING`,
  );
  await db.exec(
    `INSERT INTO tbl_spp2(empresa_id,"ItemCode","CardCode","SPP1Lnum","SPP2LNum","Amount","Price","Discount") VALUES(1,'NUEVO','C0001',2147483647,NULL,999999999999999.123456,-1.123456,NULL)`,
  );
  await assert.rejects(
    db.exec(
      `INSERT INTO tbl_spp2(empresa_id,"ItemCode","CardCode") VALUES(1,'NUEVO','C0001')`,
    ),
    /unique/,
  );
  await db.exec(
    `INSERT INTO tbl_spp2(empresa_id,"ItemCode","CardCode") VALUES(2,'NUEVO','C0001')`,
  );
  await db.exec(
    `INSERT INTO tbl_oitm(empresa_id,"ItemCode") VALUES(1,'DEFAULTS')`,
  );
  assert.deepEqual(
    await rows(
      `SELECT "ItemName","TaxCodeAR","ItmsGrpCod","QryInventario","validFor","frozenFor" FROM tbl_oitm WHERE "ItemCode"='DEFAULTS'`,
    ),
    [
      {
        ItemName: null,
        TaxCodeAR: null,
        ItmsGrpCod: -1,
        QryInventario: 'N',
        validFor: 'Y',
        frozenFor: 'N',
      },
    ],
  );
  await assert.rejects(
    db.exec(
      `INSERT INTO tbl_ospp(empresa_id,"ItemCode","CardCode","ListNum","Valid") VALUES(1,'X','C',1,NULL)`,
    ),
    /null/,
  );
  await assert.rejects(
    db.exec(
      `INSERT INTO tbl_spp1(empresa_id,"ItemCode","CardCode","LINENUM","ListNum") VALUES(1,'X','C',NULL,1)`,
    ),
    /null/,
  );
  console.log(
    'OK: OITM maestro, precios e IDs exactos conservados, cinco estructuras, int4, defaults, FK, aislamiento y respaldo de columnas retiradas; incompatibilidades abortan sin pérdida.',
  );
} finally {
  await db.close();
}
