import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

// PostgreSQL en memoria; no toca servicios ni bases de desarrollo/producción.
const db = new PGlite();
try {
  await db.exec(`CREATE TABLE campo_visitas (id SERIAL PRIMARY KEY, usuario_id INT, fecha DATE, salida TIMESTAMP);
    CREATE UNIQUE INDEX campo_visita_abierta_usuario ON campo_visitas(usuario_id) WHERE salida IS NULL;
    INSERT INTO campo_visitas(usuario_id, fecha) VALUES (1, '2026-10-09');`);
  await db.exec(await readFile(new URL('../prisma/migrations/20261014120000_visita_abierta_por_fecha/migration.sql', import.meta.url), 'utf8'));
  await db.query('INSERT INTO campo_visitas(usuario_id, fecha) VALUES ($1, $2)', [1, '2026-10-10']);
  await assert.rejects(db.query('INSERT INTO campo_visitas(usuario_id, fecha) VALUES ($1, $2)', [1, '2026-10-10']), error => error.code === '23505');
  assert.equal((await db.query('SELECT COUNT(*)::int AS total FROM campo_visitas WHERE salida IS NULL')).rows[0].total, 2);
  await db.exec("UPDATE campo_visitas SET salida = '2026-10-10 15:00' WHERE fecha = '2026-10-10'");
  await db.query('INSERT INTO campo_visitas(usuario_id, fecha) VALUES ($1, $2)', [1, '2026-10-10']);
  assert.equal((await db.query("SELECT salida FROM campo_visitas WHERE fecha = '2026-10-09'")).rows[0].salida, null);
  console.log('OK: jornada vencida preservada, nueva entrada habilitada y concurrencia protegida por fecha.');
} finally { await db.close(); }
