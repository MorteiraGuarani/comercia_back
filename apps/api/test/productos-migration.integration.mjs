import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

const db = new PGlite();
try {
  await db.exec(`
    CREATE TABLE empresas(id INT PRIMARY KEY);
    INSERT INTO empresas VALUES(10),(20);
    CREATE TABLE modulos(id INT PRIMARY KEY,ruta TEXT);
    INSERT INTO modulos VALUES(1,'gestion-campo'),(2,'otro');
    CREATE TABLE paginas(id INT PRIMARY KEY,modulo_id INT REFERENCES modulos,ruta TEXT);
    INSERT INTO paginas VALUES(1,1,'seguimiento'),(2,1,'visitas'),(3,2,'seguimiento');
    CREATE TABLE empresa_paginas(id INT PRIMARY KEY,pagina_id INT REFERENCES paginas ON DELETE CASCADE);
    INSERT INTO empresa_paginas VALUES(1,1),(2,2);
    CREATE TABLE roles(id INT PRIMARY KEY,puede_ver_seguimiento BOOLEAN);
    INSERT INTO roles VALUES(1,true),(2,false);
  `);
  await db.exec(await readFile(new URL('../prisma/migrations/20261014203000_productos_precios_retirar_seguimiento/migration.sql', import.meta.url), 'utf8'));
  const rows = async (sql) => (await db.query(sql)).rows;
  assert.deepEqual(await rows('SELECT id FROM paginas ORDER BY id'), [{id:2},{id:3}]);
  assert.deepEqual(await rows('SELECT id FROM empresa_paginas'), [{id:2}]);
  assert.equal((await rows('SELECT count(*)::int AS n FROM roles WHERE puede_ver_seguimiento'))[0].n, 0);
  await db.exec(`INSERT INTO productos VALUES
    (10,'0001','Producto A',10,1,'Grupo A',true,'Articulo'),
    (20,'0001','Producto B',5,2,'Grupo B',false,'Servicio'),
    (10,'EXCLUSIVO','Solo A',0,1,'Grupo A',true,'Articulo');
    INSERT INTO precios(empresa_id,cardcode,nro_lista_precio,lista_precio,precio) VALUES
      (10,'0001',1,'Mayorista','999999999999999.123456'),
      (10,'0001',1,'Otra tarifa','10.000001'),
      (20,'0001',1,'Mayorista','20.999999');
  `);
  assert.equal((await rows('SELECT count(*)::int AS n FROM precios'))[0].n, 3);
  assert.equal((await rows("SELECT precio::text AS valor FROM precios WHERE empresa_id=10 ORDER BY id LIMIT 1"))[0].valor, '999999999999999.123456');
  await assert.rejects(db.exec("INSERT INTO precios(empresa_id,cardcode,nro_lista_precio,lista_precio,precio) VALUES(20,'EXCLUSIVO',1,'Ajena',10)"), /precios_empresa_id_cardcode_fkey/);
  await assert.rejects(db.exec("INSERT INTO productos VALUES(10,'0001','Duplicado',10,1,'Grupo',true,'Articulo')"), /productos_pkey/);
  await assert.rejects(db.exec("INSERT INTO precios(empresa_id,cardcode,nro_lista_precio,lista_precio,precio) VALUES(10,'0001',1,'Negativo',-1)"), /check/);
  await db.exec("DELETE FROM productos WHERE empresa_id=10 AND cardcode='0001'");
  assert.deepEqual(await rows('SELECT empresa_id FROM precios'), [{empresa_id:20}]);
  assert.equal((await rows("SELECT descripcion FROM productos WHERE empresa_id=20 AND cardcode='0001'"))[0].descripcion, 'Producto B');
  const migration = await readFile(new URL('../prisma/migrations/20261015160000_catalogo_tbl_itm1/migration.sql', import.meta.url), 'utf8');
  // Precios repetidos eran válidos en el esquema anterior. No se descartan al
  // agregar la clave única: el ALTER debe fallar de manera atómica.
  await db.exec("INSERT INTO precios(empresa_id,cardcode,nro_lista_precio,lista_precio,precio) VALUES(20,'0001',1,'Duplicada',30)");
  await assert.rejects(db.exec(migration), /hay precios duplicados/);
  await db.exec('ROLLBACK');
  assert.equal((await rows('SELECT count(*)::int n FROM precios'))[0].n, 2);
  assert.equal((await rows("SELECT to_regclass('tbl_itm1')::text tabla"))[0].tabla, null);
  await db.exec("DELETE FROM precios WHERE lista_precio='Duplicada'");
  await db.exec("UPDATE precios SET nro_lista_precio=32768");
  await assert.rejects(db.exec(migration), /fuera del rango SMALLINT/);
  await db.exec('ROLLBACK');
  await db.exec("UPDATE precios SET nro_lista_precio=1");
  await db.exec("UPDATE productos SET tipo=repeat('x',51) WHERE empresa_id=20");
  await assert.rejects(db.exec(migration), /tipo con más de 50 caracteres/);
  await db.exec('ROLLBACK');
  await db.exec(`
    UPDATE productos SET tipo='Servicio' WHERE empresa_id=20;
    INSERT INTO productos VALUES(10,'0001','Producto A',10,1,'Grupo A',true,'Articulo');
    INSERT INTO precios(empresa_id,cardcode,nro_lista_precio,lista_precio,precio) VALUES
      (10,'0001',1,'Mayorista','999999999999999.123456'),
      (10,'0001',2,'Minorista','12.500001');
  `);
  const ids = await rows('SELECT id::text id FROM precios ORDER BY id');
  await db.exec(migration);
  assert.deepEqual(await rows('SELECT id::text id FROM tbl_itm1 WHERE itemcode=\'0001\' ORDER BY id'), ids);
  assert.deepEqual(await rows("SELECT itemname,inventory,pricelist,price::text price FROM tbl_itm1 WHERE empresa_id=10 AND itemcode='0001' ORDER BY pricelist"), [
    { itemname: 'Producto A', inventory: 'Y', pricelist: 1, price: '999999999999999.123456' },
    { itemname: 'Producto A', inventory: 'Y', pricelist: 2, price: '12.500001' },
  ]);
  assert.deepEqual(await rows("SELECT itemname,inventory,pricelist FROM tbl_itm1 WHERE empresa_id=20"), [
    { itemname: 'Producto B', inventory: 'N', pricelist: 1 },
  ]);
  assert.deepEqual(await rows("SELECT itemcode,pricelist,price,pricelistname FROM tbl_itm1 WHERE itemcode='EXCLUSIVO'"), [
    { itemcode: 'EXCLUSIVO', pricelist: 0, price: null, pricelistname: null },
  ]);
  assert.deepEqual(await rows("SELECT to_regclass('productos')::text productos,to_regclass('precios')::text precios"), [{ productos: null, precios: null }]);
  const columnas = await rows("SELECT column_name,data_type,is_nullable,character_maximum_length,numeric_precision,numeric_scale FROM information_schema.columns WHERE table_name='tbl_itm1'");
  const columna = (nombre) => columnas.find((c) => c.column_name === nombre);
  assert.deepEqual(columnas.map((c) => c.column_name).sort(), [
    'id','empresa_id','itemcode','itemname','iva','itmsgrpcode','itmsgrpnam','inventory','pricelist','pricelistname','price','tipo',
  ].sort());
  assert.equal(columna('id').data_type, 'bigint');
  assert.equal(columna('iva').data_type, 'smallint');
  assert.equal(columna('pricelist').data_type, 'smallint');
  assert.equal(columna('inventory').data_type, 'character');
  assert.equal(columna('inventory').character_maximum_length, 1);
  assert.equal(columna('tipo').character_maximum_length, 50);
  assert.equal(columna('price').numeric_precision, 21);
  assert.equal(columna('price').numeric_scale, 6);
  for (const nombre of ['itmsgrpnam','inventory','pricelistname','price','tipo']) assert.equal(columna(nombre).is_nullable, 'YES');
  const indices = (await rows("SELECT indexname FROM pg_indexes WHERE tablename='tbl_itm1'")).map((i) => i.indexname).sort();
  assert.deepEqual(indices, ['tbl_itm1_pkey','uq_tbl_itm1_item_pricelist','idx_tbl_itm1_itemcode','idx_tbl_itm1_itemname','idx_tbl_itm1_itmsgrpcode','idx_tbl_itm1_pricelist','idx_tbl_itm1_tipo'].sort());
  const insertar = "INSERT INTO tbl_itm1(empresa_id,itemcode,itemname,iva,itmsgrpcode,pricelist) VALUES";
  await assert.rejects(db.exec(`${insertar}(10,'0001','Duplicado',10,1,1)`), /uq_tbl_itm1_item_pricelist/);
  await assert.rejects(db.exec(`${insertar}(99,'0001','Empresa ajena',10,1,1)`), /tbl_itm1_empresa_id_fkey/);
  await assert.rejects(db.exec(`${insertar}(10,'RANGO','Inválido',32768,1,1)`), /out of range/);
  await assert.rejects(db.exec(`${insertar}(10,'RANGO','Inválido',1,1,32768)`), /out of range/);
  await db.exec(`${insertar}(20,'NUEVO','Sin precio',10,1,1)`);
  assert.deepEqual(await rows("SELECT inventory,price,tipo FROM tbl_itm1 WHERE itemcode='NUEVO'"), [{ inventory: 'Y', price: null, tipo: null }]);
  // La secuencia ya no queda limitada a SERIAL/INT4 y los IDs no pasan por JS Number.
  await db.exec("SELECT setval('tbl_itm1_id_seq',9007199254740992)");
  await db.exec(`${insertar}(20,'BIGINT','ID grande',10,1,1)`);
  assert.equal((await rows("SELECT id::text id FROM tbl_itm1 WHERE itemcode='BIGINT'"))[0].id, '9007199254740993');
  await db.exec("UPDATE tbl_itm1 SET inventory=NULL,price=-1.123456 WHERE itemcode='BIGINT'");
  assert.deepEqual(await rows("SELECT inventory,price::text price FROM tbl_itm1 WHERE itemcode='BIGINT'"), [{ inventory: null, price: '-1.123456' }]);
  await db.exec("DELETE FROM tbl_itm1 WHERE empresa_id=10 AND itemcode='0001' AND pricelist=1");
  assert.equal((await rows("SELECT count(*)::int n FROM tbl_itm1 WHERE itemcode='0001'"))[0].n, 2);
  const antesClave = await rows('SELECT * FROM tbl_itm1 ORDER BY id');
  await db.exec(await readFile(new URL('../prisma/migrations/20261015200000_tbl_itm1_clave_compuesta/migration.sql', import.meta.url), 'utf8'));
  assert.deepEqual(await rows('SELECT * FROM tbl_itm1 ORDER BY id'), antesClave, 'Cambiar la PK conserva todas las filas e IDs');
  assert.deepEqual(await rows(`
    SELECT a.attname AS columna FROM pg_constraint c
    CROSS JOIN LATERAL unnest(c.conkey) WITH ORDINALITY AS k(attnum,orden)
    JOIN pg_attribute a ON a.attrelid=c.conrelid AND a.attnum=k.attnum
    WHERE c.conrelid='tbl_itm1'::regclass AND c.contype='p' ORDER BY k.orden
  `), [{ columna: 'empresa_id' }, { columna: 'itemcode' }, { columna: 'pricelist' }]);
  await db.exec(`${insertar}(10,'COMPUESTO','Lista uno',10,1,1),(10,'COMPUESTO','Lista dos',10,1,2),(20,'COMPUESTO','Otra empresa',10,1,1)`);
  await assert.rejects(db.exec(`${insertar}(10,'COMPUESTO','Duplicado',10,1,1)`), /tbl_itm1_pkey/);
  await assert.rejects(db.exec("UPDATE tbl_itm1 SET pricelist=1 WHERE empresa_id=10 AND itemcode='COMPUESTO' AND pricelist=2"), /tbl_itm1_pkey/);
  await assert.rejects(db.exec("INSERT INTO tbl_itm1(id,empresa_id,itemcode,itemname,iva,itmsgrpcode,pricelist) SELECT id,empresa_id,'OTRO ID','ID repetido',iva,itmsgrpcode,pricelist FROM tbl_itm1 WHERE itemcode='COMPUESTO' LIMIT 1"), /uq_tbl_itm1_id/);
  await db.exec("UPDATE tbl_itm1 SET price=123.123456 WHERE id=(SELECT id FROM tbl_itm1 WHERE empresa_id=10 AND itemcode='COMPUESTO' AND pricelist=2)");
  assert.deepEqual(await rows("SELECT pricelist,price::text price FROM tbl_itm1 WHERE empresa_id=10 AND itemcode='COMPUESTO' ORDER BY pricelist"), [
    { pricelist: 1, price: null }, { pricelist: 2, price: '123.123456' },
  ]);
  await db.exec("DELETE FROM tbl_itm1 WHERE id=(SELECT id FROM tbl_itm1 WHERE empresa_id=10 AND itemcode='COMPUESTO' AND pricelist=1)");
  assert.equal((await rows("SELECT count(*)::int n FROM tbl_itm1 WHERE itemcode='COMPUESTO'"))[0].n, 2);
  const nuevosIndices = (await rows("SELECT indexname FROM pg_indexes WHERE tablename='tbl_itm1'")).map((i) => i.indexname).sort();
  assert.deepEqual(nuevosIndices, ['tbl_itm1_pkey','uq_tbl_itm1_id','idx_tbl_itm1_itemcode','idx_tbl_itm1_itemname','idx_tbl_itm1_itmsgrpcode','idx_tbl_itm1_pricelist','idx_tbl_itm1_tipo'].sort());
  console.log('OK: clave primaria compuesta por empresa, itemcode repetible entre listas, duplicados rechazados, IDs y datos conservados, CRUD por ID y tipos exactos');
} finally { await db.close(); }
