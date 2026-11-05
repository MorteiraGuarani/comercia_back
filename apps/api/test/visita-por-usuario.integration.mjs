import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

// PostgreSQL en memoria; no toca servicios ni bases de desarrollo/producción.
const db = new PGlite();
const insertar = (usuario, horario) =>
  db.query(
    'INSERT INTO campo_visitas(asignacion_id, horario_id, fecha, usuario_id) VALUES (117, $1, $2, $3)',
    [horario, '2026-11-05', usuario],
  );
try {
  await db.exec(`CREATE TABLE campo_visitas (id SERIAL PRIMARY KEY, asignacion_id INT, horario_id INT, fecha DATE, usuario_id INT);
    CREATE UNIQUE INDEX campo_visitas_asignacion_id_horario_id_fecha_key ON campo_visitas(asignacion_id, horario_id, fecha);
    CREATE UNIQUE INDEX campo_visita_sin_horario ON campo_visitas(asignacion_id, fecha) WHERE horario_id IS NULL;`);
  // Antes: el titular visitó y la entrada del supervisor rebotaba.
  await insertar(220, 59836);
  await insertar(220, null);
  await assert.rejects(insertar(217, 59836), (e) => e.code === '23505');
  await db.exec(
    await readFile(
      new URL('../prisma/migrations/20261105130000_visita_por_usuario/migration.sql', import.meta.url),
      'utf8',
    ),
  );
  await insertar(217, 59836);
  await insertar(217, null);
  // Sigue habiendo una sola por persona.
  await assert.rejects(insertar(217, 59836), (e) => e.code === '23505');
  await assert.rejects(insertar(217, null), (e) => e.code === '23505');
  assert.equal((await db.query('SELECT COUNT(*)::int AS n FROM campo_visitas')).rows[0].n, 4);
  console.log('OK: titular y supervisor visitan la misma asignación el mismo día.');
} finally {
  await db.close();
}
