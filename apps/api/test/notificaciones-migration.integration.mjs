import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

const db = new PGlite();
try {
  await db.exec(`
    CREATE TABLE usuarios(id INT PRIMARY KEY, empresa_id INT, superior_id INT, is_active BOOLEAN);
    INSERT INTO usuarios VALUES
      (1,10,NULL,true),(2,10,1,true),(3,10,2,true),(4,10,2,true),
      (5,20,1,true),(6,10,5,true),(7,10,1,false),(8,10,7,true),
      (9,10,11,true),(11,10,9,true),(12,10,NULL,true),(13,10,12,true);
    CREATE TABLE campo_notificaciones(
      id SERIAL PRIMARY KEY, empresa_id INT, usuario_destinatario_id INT,
      usuario_emisor_id INT, tipo TEXT, referencia_id INT, titulo TEXT, mensaje TEXT,
      leido BOOLEAN DEFAULT false, creado_at TIMESTAMP DEFAULT now());
    INSERT INTO campo_notificaciones(empresa_id,usuario_destinatario_id,usuario_emisor_id,tipo,referencia_id,titulo,mensaje,leido) VALUES
      (10,3,3,'VENCIMIENTO_PROXIMO',100,'Vence hoy','Producto completo',true),
      (10,2,3,'VENCIMIENTO_PROXIMO',100,'Vence hoy','Producto completo',true),
      (10,13,3,'VENCIMIENTO_PROXIMO',100,'Vence hoy','Producto completo',false),
      (10,2,3,'COMENTARIO_TAREA',200,'Comentario','Texto',false),
      (10,6,6,'VENCIMIENTO_PROXIMO',300,'Ajeno','Texto',false),
      (10,8,8,'VENCIMIENTO_PROXIMO',400,'Inactivo','Texto',false),
      (10,9,9,'VENCIMIENTO_PROXIMO',500,'Ciclo','Texto',false),
      (10,3,2,'AVISO_RECIBIDO',600,'Aviso','Texto',false);
    CREATE TABLE campo_inventario_cargas(id INT PRIMARY KEY, empresa_id INT, avisado_en TIMESTAMP);
    INSERT INTO campo_inventario_cargas VALUES(100,10,now()),(700,10,now());
  `);
  const migration = await readFile(new URL('../prisma/migrations/20261027120000_notificaciones_superiores/migration.sql', import.meta.url), 'utf8');
  await db.exec(migration);
  const destinatarios = async (id) => (await db.query('SELECT usuario_destinatario_id id FROM campo_notificaciones WHERE referencia_id=$1 ORDER BY id', [id])).rows.map((r) => r.id);
  assert.deepEqual(await destinatarios(100), [1,2,3,12,13]);
  assert.deepEqual(await destinatarios(200), [1,2]);
  assert.deepEqual(await destinatarios(300), [6]);
  assert.deepEqual(await destinatarios(400), [1,8]);
  assert.deepEqual(await destinatarios(500), [9,11]);
  assert.deepEqual(await destinatarios(600), [3]);
  assert.deepEqual((await db.query('SELECT usuario_destinatario_id id,leido FROM campo_notificaciones WHERE referencia_id=100 AND usuario_destinatario_id IN(1,2) ORDER BY id')).rows, [{ id: 1, leido: false }, { id: 2, leido: true }]);
  assert.deepEqual((await db.query('SELECT id,avisado_en IS NULL pendiente FROM campo_inventario_cargas ORDER BY id')).rows, [{ id: 100, pendiente: false }, { id: 700, pendiente: true }]);
  const total = (await db.query('SELECT count(*)::int n FROM campo_notificaciones')).rows[0].n;
  await db.exec(migration);
  assert.equal((await db.query('SELECT count(*)::int n FROM campo_notificaciones')).rows[0].n, total);
  console.log('Recuperación de notificaciones: cadena, empresas, ciclos, lecturas e idempotencia OK');
} finally {
  await db.close();
}
