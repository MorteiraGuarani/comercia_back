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
  console.log('OK: productos por empresa, precios repetidos, decimal exacto, claves foraneas y retirada de Seguimiento en vivo');
} finally { await db.close(); }
