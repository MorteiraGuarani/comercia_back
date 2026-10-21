import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

const expected = {
  tbl_ocrd: {
    CardCode: {
      type: 'character varying',
      nullable: false,
      length: 15,
    },
    CardName: {
      type: 'character varying',
      nullable: true,
      length: 200,
    },
    GroupCode: {
      type: 'smallint',
      nullable: true,
    },
    GroupNum: {
      type: 'smallint',
      nullable: true,
      default: -1,
    },
    LicTradNum: {
      type: 'character varying',
      nullable: true,
      length: 32,
    },
    ListNum: {
      type: 'smallint',
      nullable: true,
    },
    SlpCode: {
      type: 'integer',
      nullable: true,
      default: -1,
    },
    QryLunes: {
      type: 'character varying',
      nullable: true,
      length: 1,
      default: 'N',
    },
    QryMartes: {
      type: 'character varying',
      nullable: true,
      length: 1,
      default: 'N',
    },
    QryMiercoles: {
      type: 'character varying',
      nullable: true,
      length: 1,
      default: 'N',
    },
    QryJueves: {
      type: 'character varying',
      nullable: true,
      length: 1,
      default: 'N',
    },
    QryViernes: {
      type: 'character varying',
      nullable: true,
      length: 1,
      default: 'N',
    },
    AgentCode: {
      type: 'character varying',
      nullable: true,
      length: 32,
    },
    U_Latitud: {
      type: 'character varying',
      nullable: true,
      length: 30,
    },
    U_Longitud: {
      type: 'character varying',
      nullable: true,
      length: 30,
    },
    U_jCANAL: {
      type: 'character varying',
      nullable: true,
      length: 50,
    },
    U_jSUBCANAL: {
      type: 'character varying',
      nullable: true,
      length: 50,
    },
  },
  tbl_crd1: {
    CardCode: {
      type: 'character varying',
      nullable: true,
      length: 200,
    },
    Address: {
      type: 'character varying',
      nullable: true,
      length: 200,
    },
    Street: {
      type: 'character varying',
      nullable: true,
      length: 200,
    },
    AdresType: {
      type: 'character varying',
      nullable: true,
      length: 200,
      default: 'S',
    },
  },
  tbl_jcanal: {
    Code: {
      type: 'integer',
      nullable: false,
    },
    Name: {
      type: 'character varying',
      nullable: true,
      length: 100,
    },
  },
  tbl_jcanales: {
    Code: {
      type: 'integer',
      nullable: false,
    },
    Name: {
      type: 'character varying',
      nullable: true,
      length: 100,
    },
  },
  tbl_jsubcanal: {
    Code: {
      type: 'integer',
      nullable: false,
    },
    Name: {
      type: 'character varying',
      nullable: true,
      length: 100,
    },
  },
  tbl_jsubcanales: {
    Code: {
      type: 'integer',
      nullable: false,
    },
    Name: {
      type: 'character varying',
      nullable: true,
      length: 100,
    },
  },
  tbl_oagp: {
    AgentCode: {
      type: 'character varying',
      nullable: true,
      length: 200,
    },
    AgentName: {
      type: 'character varying',
      nullable: true,
      length: 200,
    },
  },
  tbl_oslp: {
    SlpCode: {
      type: 'integer',
      nullable: true,
    },
    SlpName: {
      type: 'character varying',
      nullable: true,
      length: 200,
    },
  },
  tbl_ocrg: {
    GroupCode: {
      type: 'integer',
      nullable: true,
    },
    GroupName: {
      type: 'character varying',
      nullable: true,
      length: 200,
    },
  },
  tbl_octg: {
    GroupNum: {
      type: 'integer',
      nullable: true,
    },
    PymntGroup: {
      type: 'character varying',
      nullable: true,
      length: 200,
    },
  },
  tbl_opln: {
    ListNum: {
      type: 'integer',
      nullable: true,
    },
    ListName: {
      type: 'character varying',
      nullable: true,
      length: 200,
    },
  },
};
const db = new PGlite();
try {
  await db.exec(
    'CREATE TABLE empresas(id INTEGER PRIMARY KEY); INSERT INTO empresas VALUES (1),(2);',
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
  for (const [table, fields] of Object.entries(expected)) {
    const foreignKeys = await db.query(
      `SELECT confrelid::regclass::text AS destino, confdeltype, confupdtype
       FROM pg_constraint WHERE contype='f' AND conrelid=$1::regclass`,
      [table],
    );
    assert.deepEqual(
      foreignKeys.rows,
      [{ destino: 'empresas', confdeltype: 'r', confupdtype: 'c' }],
      table + ' relación de empresa',
    );
    const { rows } = await db.query(
      "SELECT column_name,data_type,is_nullable,character_maximum_length,is_identity FROM information_schema.columns WHERE table_schema='public' AND table_name=$1",
      [table],
    );
    assert.deepEqual(
      rows.map((c) => c.column_name).sort(),
      ['id', 'empresa_id', ...Object.keys(fields)].sort(),
      table,
    );
    for (const [name, field] of Object.entries(fields)) {
      const column = rows.find((c) => c.column_name === name);
      assert.equal(column.data_type, field.type, table + '.' + name);
      assert.equal(
        column.is_nullable,
        field.nullable ? 'YES' : 'NO',
        table + '.' + name,
      );
      if (field.length)
        assert.equal(
          column.character_maximum_length,
          field.length,
          table + '.' + name,
        );
    }
    if (fields.Code)
      assert.equal(
        rows.find((c) => c.column_name === 'Code').is_identity,
        'YES',
      );
  }
  await db.exec(`INSERT INTO tbl_ocrd(empresa_id,"CardCode","CardName","U_Latitud","U_Longitud")
    VALUES (1,'C0001','Empresa uno','-25.300000','-57.600000'),(2,'C0001','Empresa dos',NULL,NULL);`);
  const socio = (await db.query('SELECT * FROM tbl_ocrd WHERE empresa_id=1'))
    .rows[0];
  assert.equal(socio.GroupNum, -1);
  assert.equal(socio.SlpCode, -1);
  for (const day of [
    'QryLunes',
    'QryMartes',
    'QryMiercoles',
    'QryJueves',
    'QryViernes',
  ])
    assert.equal(socio[day], 'N');
  assert.equal(socio.U_Latitud, '-25.300000');
  await assert.rejects(
    db.exec(`INSERT INTO tbl_ocrd(empresa_id,"CardCode") VALUES (1,'C0001')`),
    /unique/i,
  );
  await assert.rejects(
    db.exec(`INSERT INTO tbl_ocrd(empresa_id,"CardCode") VALUES (9,'C0002')`),
    /foreign key/i,
  );
  await assert.rejects(
    db.exec(
      `INSERT INTO tbl_ocrd(empresa_id,"CardCode","GroupCode") VALUES (1,'C0002',32768)`,
    ),
    /range/i,
  );
  await assert.rejects(
    db.exec(
      `INSERT INTO tbl_ocrd(empresa_id,"CardCode","LicTradNum") VALUES (1,'C0002',repeat('x',33))`,
    ),
    /long/i,
  );
  // Referencias ausentes son válidas en una carga parcial y conservan sus valores.
  await db.exec(`INSERT INTO tbl_ocrd(empresa_id,"CardCode","GroupCode","AgentCode","U_jCANAL")
    VALUES(1,'PARCIAL',99,'FUTURO','0001');`);
  await db.exec(`INSERT INTO tbl_crd1(empresa_id,"CardCode") VALUES(1,'C0001');
    INSERT INTO tbl_crd1(empresa_id,"CardCode") VALUES(1,'C0001') ON CONFLICT DO NOTHING;`);
  assert.equal(
    (await db.query('SELECT count(*)::int n FROM tbl_crd1')).rows[0].n,
    1,
  );
  await db.exec(`INSERT INTO tbl_crd1(empresa_id,"CardCode","Street") VALUES(1,'C0001','Otra dirección');
    INSERT INTO tbl_crd1(empresa_id,"CardCode") VALUES(2,'C0001');`);
  assert.equal(
    (await db.query('SELECT count(*)::int n FROM tbl_crd1')).rows[0].n,
    3,
  );
  // Bulk reintentado: ni modifica existentes ni aborta las filas nuevas.
  const result =
    await db.query(`INSERT INTO tbl_ocrd(empresa_id,"CardCode","CardName")
    VALUES(1,'C0001','No sobrescribir'),(1,'C0003','Nuevo'),(1,'C0003','Repetido')
    ON CONFLICT DO NOTHING RETURNING "CardCode"`);
  assert.deepEqual(result.rows, [{ CardCode: 'C0003' }]);
  assert.equal(
    (
      await db.query(
        `SELECT "CardName" FROM tbl_ocrd WHERE empresa_id=1 AND "CardCode"='C0001'`,
      )
    ).rows[0].CardName,
    'Empresa uno',
  );
  for (const table of [
    'tbl_jcanal',
    'tbl_jcanales',
    'tbl_jsubcanal',
    'tbl_jsubcanales',
  ]) {
    await db.exec(
      `INSERT INTO "${table}"(empresa_id,"Name") VALUES (1,'Primero');`,
    );
    await db.exec(
      `INSERT INTO "${table}"(empresa_id,"Code","Name") VALUES (2,1,'Otra empresa');`,
    );
    const before = (await db.query(`SELECT count(*)::int n FROM "${table}"`))
      .rows[0].n;
    await db.exec(
      `INSERT INTO "${table}"(empresa_id,"Code","Name") VALUES (1,1,'Duplicado') ON CONFLICT DO NOTHING;`,
    );
    assert.equal(
      (await db.query(`SELECT count(*)::int n FROM "${table}"`)).rows[0].n,
      before,
    );
  }
  for (const [table, key, name] of [
    ['tbl_oagp', 'AgentCode', 'AgentName'],
    ['tbl_oslp', 'SlpCode', 'SlpName'],
    ['tbl_ocrg', 'GroupCode', 'GroupName'],
    ['tbl_octg', 'GroupNum', 'PymntGroup'],
    ['tbl_opln', 'ListNum', 'ListName'],
  ]) {
    await db.exec(`INSERT INTO "${table}"(empresa_id,"${key}","${name}") VALUES (1,NULL,'Sin código');
      INSERT INTO "${table}"(empresa_id,"${key}","${name}") VALUES (1,NULL,'Repetido') ON CONFLICT DO NOTHING;`);
    assert.equal(
      (await db.query(`SELECT count(*)::int n FROM "${table}"`)).rows[0].n,
      1,
    );
  }
  const canalUsado = await db.query(
    `SELECT id FROM tbl_ocrd WHERE empresa_id=$1
    AND CASE WHEN "U_jCANAL" ~ '^-?[0-9]+$' THEN "U_jCANAL"::numeric END = $2::numeric LIMIT 1`,
    [1, 1],
  );
  assert.equal(canalUsado.rows.length, 1);
  console.log(
    'OK: once tablas, mayúsculas y tipos originales, defaults/identidades, empresa, NULL idempotente y bulk sin pérdida de datos',
  );
} finally {
  await db.close();
}
