import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

// Migración de jefaturas (roles que supervisan varios equipos) sobre datos
// existentes, en PostgreSQL aislado.
const db = new PGlite();
await db.exec(`
  CREATE TABLE empresas (id INTEGER PRIMARY KEY);
  CREATE TABLE campo_equipos_operativos (id INTEGER PRIMARY KEY, empresa_id INTEGER NOT NULL, UNIQUE (id, empresa_id));
  CREATE TABLE roles (id INTEGER PRIMARY KEY, empresa_id INTEGER NOT NULL, equipo_campo_id INTEGER, UNIQUE (id, empresa_id));
  CREATE TABLE usuarios (id INTEGER PRIMARY KEY, empresa_id INTEGER NOT NULL);
  INSERT INTO empresas VALUES (1), (2);
  INSERT INTO campo_equipos_operativos VALUES (10, 1), (11, 1), (20, 2);
  INSERT INTO roles VALUES (1, 1, 10), (2, 1, NULL), (3, 2, 20);
  INSERT INTO usuarios VALUES (1, 1), (2, 2);
`);
await db.exec(
  await readFile(
    new URL('../prisma/migrations/20261029130000_equipos_gestion/migration.sql', import.meta.url),
    'utf8',
  ),
);

// Los datos existentes quedan como estaban.
assert.deepEqual(
  (await db.query('SELECT id, gestiona_todos_equipos FROM roles ORDER BY id')).rows,
  [1, 2, 3].map((id) => ({ id, gestiona_todos_equipos: false })),
);
assert.equal((await db.query('SELECT equipo_gestion_id FROM usuarios WHERE id = 1')).rows[0].equipo_gestion_id, null);

const falla = (sql) => db.query(sql).then(() => assert.fail(`Debió fallar: ${sql}`), () => undefined);
// Jefatura de la empresa 1 con sus dos equipos; nunca equipos de otra empresa.
await db.query('INSERT INTO roles_equipos_gestion VALUES (2, 10, 1), (2, 11, 1)');
await falla('INSERT INTO roles_equipos_gestion VALUES (2, 20, 1)');
await falla('INSERT INTO roles_equipos_gestion VALUES (2, 20, 2)');
// "Todos los equipos" excluye tener equipo propio.
await db.query('UPDATE roles SET gestiona_todos_equipos = true WHERE id = 2');
await falla('UPDATE roles SET gestiona_todos_equipos = true WHERE id = 1');
// El equipo elegido por un usuario es de su empresa.
await db.query('UPDATE usuarios SET equipo_gestion_id = 11 WHERE id = 1');
await falla('UPDATE usuarios SET equipo_gestion_id = 10 WHERE id = 2');
// Borrar el rol borra sus equipos supervisados.
await db.query('DELETE FROM roles WHERE id = 2');
assert.equal((await db.query('SELECT count(*)::int n FROM roles_equipos_gestion')).rows[0].n, 0);

console.log('OK: migración de jefaturas sobre datos existentes, empresa y equipo propio validados');
await db.close();
