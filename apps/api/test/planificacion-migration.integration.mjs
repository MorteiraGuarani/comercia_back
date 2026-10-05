// PostgreSQL en memoria: no usa credenciales ni toca una base de datos real.
// npm run build --workspace=api && node apps/api/test/planificacion-migration.integration.mjs
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

const require = createRequire(import.meta.url);
const { condicionAgenda } = require('../dist/src/campo/utils/agenda-sql.js');
const db = new PGlite();
let fallo=false;
try {
  await db.exec(`
    CREATE TABLE empresas (id INT PRIMARY KEY, nombre TEXT);
    INSERT INTO empresas VALUES (10,'Empresa A'),(20,'Empresa B');
    CREATE TYPE "DestinatarioTareaCampo" AS ENUM ('IMPULSADOR','REPOSITOR','AMBOS');
    CREATE TABLE roles (id INT PRIMARY KEY, empresa_id INT, descripcion TEXT);
    CREATE TABLE usuarios (id INT PRIMARY KEY, empresa_id INT, rol_id INT REFERENCES roles,
      superior_id INT, is_active BOOLEAN DEFAULT true);
    CREATE TABLE campo_clientes (id INT PRIMARY KEY, empresa_id INT, activo BOOLEAN DEFAULT true);
    CREATE TABLE campo_locales (id INT PRIMARY KEY, cliente_id INT REFERENCES campo_clientes,
      activo BOOLEAN DEFAULT true);
    CREATE TABLE campo_asignaciones (id INT PRIMARY KEY, local_id INT REFERENCES campo_locales,
      usuario_id INT REFERENCES usuarios, activo BOOLEAN DEFAULT true,
      fecha_desde DATE DEFAULT '2026-01-01', fecha_hasta DATE);
    CREATE TABLE campo_backups (id INT PRIMARY KEY, asignacion_id INT REFERENCES campo_asignaciones,
      usuario_id INT REFERENCES usuarios, activo BOOLEAN DEFAULT true, fecha_desde DATE, fecha_hasta DATE);
    CREATE TABLE campo_horarios (id SERIAL PRIMARY KEY, local_id INT REFERENCES campo_locales,
      asignacion_id INT REFERENCES campo_asignaciones, frecuencia TEXT DEFAULT 'SEMANAL',
      intervalo INT DEFAULT 1, dias_semana INT[] DEFAULT '{1}', dias_mes INT[] DEFAULT '{}',
      fecha_desde DATE DEFAULT '2026-01-01', fecha_hasta DATE, entrada TEXT DEFAULT '08:00',
      salida TEXT DEFAULT '18:00', activo BOOLEAN DEFAULT true);
    CREATE TABLE campo_tareas (id SERIAL PRIMARY KEY, empresa_id INT, nombre TEXT,
      destinatario "DestinatarioTareaCampo" DEFAULT 'IMPULSADOR', descripcion TEXT DEFAULT '',
      todos_locales BOOLEAN DEFAULT false, fecha_desde DATE DEFAULT '2026-01-01', fecha_hasta DATE,
      activo BOOLEAN DEFAULT true, requiere_fotos BOOLEAN DEFAULT true,
      fotos_obligatorias BOOLEAN DEFAULT true, categoria TEXT DEFAULT 'Precios',
      estado TEXT DEFAULT 'ABIERTA', es_obligatoria BOOLEAN DEFAULT true);
    CREATE TABLE campo_tarea_locales (tarea_id INT REFERENCES campo_tareas,
      local_id INT REFERENCES campo_locales, PRIMARY KEY (tarea_id,local_id));
    CREATE TABLE campo_visitas (id INT PRIMARY KEY, usuario_id INT REFERENCES usuarios,
      local_id INT REFERENCES campo_locales, horario_id INT REFERENCES campo_horarios);
    CREATE TABLE campo_cumplimientos (visita_id INT REFERENCES campo_visitas,
      tarea_id INT REFERENCES campo_tareas, nombre_tarea TEXT, completada_at TIMESTAMP,
      fotos_validadas BOOLEAN, PRIMARY KEY (visita_id,tarea_id));
    CREATE TABLE campo_tarea_comentarios (id INT PRIMARY KEY, cumplimiento_visita_id INT,
      cumplimiento_tarea_id INT, comentario TEXT,
      FOREIGN KEY (cumplimiento_visita_id,cumplimiento_tarea_id)
        REFERENCES campo_cumplimientos ON DELETE CASCADE);
    CREATE TABLE campo_tarea_fotos (id INT PRIMARY KEY, cumplimiento_visita_id INT,
      cumplimiento_tarea_id INT, ruta_archivo TEXT,
      FOREIGN KEY (cumplimiento_visita_id,cumplimiento_tarea_id)
        REFERENCES campo_cumplimientos ON DELETE CASCADE);
    CREATE TABLE campo_novedades (id INT PRIMARY KEY, usuario_id INT REFERENCES usuarios,
      tarea_id INT REFERENCES campo_tareas);

    INSERT INTO roles VALUES (1,10,'Impulsador'),(2,10,'REPOSITOR'),(3,20,'REPOSITOR');
    INSERT INTO usuarios(id,empresa_id,rol_id) VALUES (1,10,1),(2,10,2),(3,20,3);
    INSERT INTO campo_clientes VALUES (1,10,true),(2,20,true);
    INSERT INTO campo_locales(id,cliente_id) VALUES (1,1),(2,1),(3,1),(4,1),(5,2);
    INSERT INTO campo_asignaciones(id,local_id,usuario_id) VALUES
      (1,1,1),(2,1,2),(3,2,1),(4,3,2),(5,5,3);
    INSERT INTO campo_horarios(local_id,asignacion_id,dias_semana) VALUES
      (1,NULL,'{1}'),(1,2,'{2}'),(2,NULL,'{4}'),(3,NULL,'{1}'),(5,5,'{1}');
    INSERT INTO campo_tareas(nombre,destinatario,empresa_id) VALUES
      ('Compartida','AMBOS',10),('Impulso','IMPULSADOR',10),('Reposición','REPOSITOR',10);
    INSERT INTO campo_tarea_locales VALUES (1,1),(1,3);
    INSERT INTO campo_visitas VALUES (1,1,1,1),(2,2,1,1),(3,2,1,2);
    INSERT INTO campo_cumplimientos VALUES
      (1,1,'Compartida','2026-10-05 09:00',true),
      (2,1,'Compartida','2026-10-05 10:00',true),(3,1,'Compartida',NULL,false);
    INSERT INTO campo_tarea_comentarios VALUES (7,2,1,'Histórico'),(8,3,1,'Borrador');
    INSERT INTO campo_tarea_fotos VALUES (9,2,1,'/foto-original.jpg'),(10,3,1,'/borrador.jpg');
    INSERT INTO campo_novedades VALUES (1,1,1),(2,2,1);
  `);
  const migration = await readFile(
    new URL(
      '../prisma/migrations/20261005120000_planificacion_por_equipo/migration.sql',
      import.meta.url,
    ),
    'utf8',
  );
  await db.exec(migration);
  const rows = async (sql) => (await db.query(sql)).rows;
  const tareas = await rows(
    'SELECT id,destinatario FROM campo_tareas ORDER BY id',
  );
  assert.deepEqual(
    tareas.map((t) => t.destinatario),
    ['IMPULSADOR', 'IMPULSADOR', 'REPOSITOR', 'REPOSITOR'],
  );
  const nuevaId = tareas[3].id;
  assert.equal(
    (await rows('SELECT COUNT(*)::int AS n FROM campo_locales'))[0].n,
    5,
  );
  assert.equal(
    (
      await rows(
        `SELECT COUNT(*)::int AS n FROM campo_tarea_locales WHERE tarea_id=${nuevaId}`,
      )
    )[0].n,
    2,
  );
  assert.deepEqual(
    await rows(
      'SELECT visita_id,tarea_id FROM campo_cumplimientos ORDER BY visita_id',
    ),
    [
      { visita_id: 1, tarea_id: 1 },
      { visita_id: 2, tarea_id: nuevaId },
      { visita_id: 3, tarea_id: nuevaId },
    ],
  );
  assert.equal(
    (
      await rows(
        'SELECT completada_at FROM campo_cumplimientos WHERE visita_id=3',
      )
    )[0].completada_at,
    null,
  );
  assert.deepEqual(
    await rows(
      'SELECT id,cumplimiento_tarea_id FROM campo_tarea_comentarios ORDER BY id',
    ),
    [
      { id: 7, cumplimiento_tarea_id: nuevaId },
      { id: 8, cumplimiento_tarea_id: nuevaId },
    ],
  );
  assert.deepEqual(
    await rows(
      'SELECT id,cumplimiento_tarea_id,ruta_archivo FROM campo_tarea_fotos ORDER BY id',
    ),
    [
      {
        id: 9,
        cumplimiento_tarea_id: nuevaId,
        ruta_archivo: '/foto-original.jpg',
      },
      { id: 10, cumplimiento_tarea_id: nuevaId, ruta_archivo: '/borrador.jpg' },
    ],
  );
  assert.deepEqual(
    await rows('SELECT id,tarea_id FROM campo_novedades ORDER BY id'),
    [
      { id: 1, tarea_id: 1 },
      { id: 2, tarea_id: nuevaId },
    ],
  );
  assert.deepEqual(
    await rows('SELECT id,horario_id FROM campo_visitas ORDER BY id'),
    [
      { id: 1, horario_id: 1 },
      { id: 2, horario_id: 1 },
      { id: 3, horario_id: 2 },
    ],
  );
  assert.equal(
    (await rows('SELECT destinatario FROM campo_horarios WHERE id=2'))[0]
      .destinatario,
    'REPOSITOR',
  );
  assert.equal(
    (await rows('SELECT destinatario FROM campo_horarios WHERE id=5'))[0]
      .destinatario,
    'REPOSITOR',
  );
  await assert.rejects(
    db.exec(
      "INSERT INTO campo_horarios(local_id,destinatario) VALUES(1,'AMBOS')",
    ),
    /equipo_check/,
  );
  await assert.rejects(
    db.exec(
      "INSERT INTO campo_tareas(nombre,destinatario,empresa_id) VALUES('Ajena','AMBOS',10)",
    ),
    /equipo_check/,
  );

  // Una franja del otro equipo nunca oculta un local ni reemplaza la franja propia.
  await db.exec(`
    INSERT INTO campo_asignaciones(id,local_id,usuario_id) VALUES (6,4,1);
    INSERT INTO campo_horarios(local_id,destinatario,dias_semana) VALUES (4,'REPOSITOR','{2}');
    INSERT INTO campo_backups VALUES (1,1,2,true,'2026-10-06','2026-10-06');
  `);
  await db.exec("INSERT INTO roles VALUES(4,10,'Cargo Nuevo')");
  await db.exec(
    await readFile(
      new URL(
        '../prisma/migrations/20261005160000_equipos_operativos_configurables/migration.sql',
        import.meta.url,
      ),
      'utf8',
    ),
  );
  assert.equal(
    (await rows('SELECT equipo_campo_id FROM roles WHERE id=4'))[0]
      .equipo_campo_id,
    null,
  );
  const grupoId = async (tipo) =>
    (
      await db.query(
        'SELECT id FROM campo_equipos_operativos WHERE empresa_id=10 AND tipo=$1',
        [tipo],
      )
    ).rows[0].id;
  const agenda = async (usuarioId, destinatario, hasta = '2026-10-05') => {
    const sql = condicionAgenda(
      10,
      usuarioId,
      '2026-10-05',
      hasta,
      typeof destinatario === 'number'
        ? destinatario
        : await grupoId(destinatario),
    );
    const result = await db.query(
      `SELECT DISTINCT l.id FROM campo_asignaciones a
      JOIN campo_locales l ON l.id=a.local_id JOIN campo_clientes c ON c.id=l.cliente_id
      WHERE ${sql.text} ORDER BY l.id`,
      sql.values,
    );
    return result.rows.map((x) => x.id);
  };
  assert.deepEqual(await agenda(1, 'IMPULSADOR'), [1, 4]);
  assert.deepEqual(await agenda(2, 'REPOSITOR'), [3]);
  assert.deepEqual(await agenda(2, 'REPOSITOR', '2026-10-06'), [1, 3]);
  assert.deepEqual(await agenda(3, 'REPOSITOR', '2026-10-06'), []);
  // Dos roles nuevos, mismo perfil de impulsador y mismo local, distintos equipos.
  const equipoA = (
    await db.query(
      "INSERT INTO campo_equipos_operativos(empresa_id,nombre,tipo) VALUES(10,'Promocion A','IMPULSADOR') RETURNING id",
    )
  ).rows[0].id;
  const equipoB = (
    await db.query(
      "INSERT INTO campo_equipos_operativos(empresa_id,nombre,tipo) VALUES(10,'Promocion B','IMPULSADOR') RETURNING id",
    )
  ).rows[0].id;
  await db.query('UPDATE roles SET equipo_campo_id=$1 WHERE id=4', [equipoA]);
  await db.query(
    "INSERT INTO roles(id,empresa_id,descripcion,equipo_campo_id) VALUES(5,10,'Otro Cargo Nuevo',$1)",
    [equipoB],
  );
  await db.exec(
    'INSERT INTO usuarios(id,empresa_id,rol_id) VALUES(4,10,4),(5,10,5); INSERT INTO campo_asignaciones(id,local_id,usuario_id) VALUES(7,4,4),(8,4,5)',
  );
  await db.query(
    "INSERT INTO campo_horarios(local_id,destinatario,equipo_campo_id,dias_semana) VALUES(4,'IMPULSADOR',$1,'{1}'),(4,'IMPULSADOR',$2,'{2}')",
    [equipoA, equipoB],
  );
  await db.query(
    "INSERT INTO campo_tareas(empresa_id,nombre,destinatario,equipo_campo_id) VALUES(10,'Solo A','IMPULSADOR',$1),(10,'Solo B','IMPULSADOR',$2)",
    [equipoA, equipoB],
  );
  assert.deepEqual(await agenda(4, equipoA), [4]);
  assert.deepEqual(await agenda(5, equipoB), []);
  assert.deepEqual(await agenda(5, equipoB, '2026-10-06'), [4]);
  assert.deepEqual(
    (
      await db.query(
        'SELECT nombre FROM campo_tareas WHERE empresa_id=10 AND equipo_campo_id=$1',
        [equipoA],
      )
    ).rows,
    [{ nombre: 'Solo A' }],
  );
  assert.deepEqual(
    (
      await db.query(
        'SELECT nombre FROM campo_tareas WHERE empresa_id=10 AND equipo_campo_id=$1',
        [equipoB],
      )
    ).rows,
    [{ nombre: 'Solo B' }],
  );
  await assert.rejects(
    db.query('UPDATE roles SET equipo_campo_id=$1 WHERE id=3', [equipoA]),
    /fkey/,
  );
  await assert.rejects(
    db.query(
      "INSERT INTO campo_tareas(empresa_id,nombre,destinatario,equipo_campo_id) VALUES(20,'Ajena','IMPULSADOR',$1)",
      [equipoA],
    ),
    /fkey/,
  );
  assert.equal(
    (await rows('SELECT COUNT(*)::int AS n FROM campo_locales'))[0].n,
    5,
  );
  const equipoImp=await grupoId('IMPULSADOR');
  await db.exec(`
    INSERT INTO roles(id,empresa_id,descripcion,equipo_campo_id) VALUES(90,10,'SUPERVISOR',${equipoImp}),(91,10,'TeamLeader',${equipoImp});
    CREATE TYPE "TipoEventoUcheck" AS ENUM('ENTRADA','SALIDA');
    CREATE TABLE modulos(id SERIAL PRIMARY KEY,ruta TEXT UNIQUE);
    CREATE TABLE paginas(id SERIAL PRIMARY KEY,modulo_id INTEGER,nombre TEXT,ruta TEXT,icono TEXT,orden INT,activo BOOLEAN,created_at TIMESTAMP,updated_at TIMESTAMP,UNIQUE(modulo_id,ruta));
    CREATE TABLE empresa_paginas(empresa_id INTEGER,pagina_id INTEGER,rol_ids INTEGER[],created_at TIMESTAMP,UNIQUE(empresa_id,pagina_id));
    INSERT INTO modulos(ruta)VALUES('gestion-campo');
  `);
  for(const nombre of ['20261006090000_confiabilidad_tareas','20261006092000_seguimiento_operativo']) {
    await db.exec(await readFile(new URL(`../prisma/migrations/${nombre}/migration.sql`,import.meta.url),'utf8'));
  }
  const permisos=await rows('SELECT id,permisos_tareas::text[] AS permisos_tareas,puede_ver_seguimiento FROM roles WHERE id IN (90,91) ORDER BY id');
  assert.deepEqual(permisos[0].permisos_tareas,['CONSULTAR','CREAR','EDITAR','ARCHIVAR']);
  assert.deepEqual(permisos[1].permisos_tareas,['CONSULTAR']);
  assert.equal(permisos[0].puede_ver_seguimiento,true);assert.equal(permisos[1].puede_ver_seguimiento,false);
  const original=(await db.query('SELECT contenido FROM campo_tarea_versiones WHERE tarea_id=$1 AND version=1',[nuevaId])).rows[0].contenido;
  await db.query("UPDATE campo_tareas SET nombre='Instrucciones nuevas',descripcion='Cambio posterior',version=2,activo=false,archivada_en=CURRENT_TIMESTAMP WHERE id=$1",[nuevaId]);
  assert.equal((await db.query('SELECT detalle_tarea FROM campo_cumplimientos WHERE visita_id=2 AND tarea_id=$1',[nuevaId])).rows[0].detalle_tarea.nombre,original.nombre);
  assert.equal((await rows('SELECT COUNT(*)::int AS n FROM campo_cumplimientos'))[0].n,3);
  assert.equal((await rows('SELECT COUNT(*)::int AS n FROM campo_tarea_fotos'))[0].n,2);
  assert.equal((await rows('SELECT COUNT(*)::int AS n FROM campo_tarea_comentarios'))[0].n,2);
  await assert.rejects(db.query('DELETE FROM campo_tareas WHERE id=$1',[nuevaId]),/fkey/);
  const paginaSeguimiento=(await rows("SELECT id FROM paginas WHERE ruta='seguimiento'"))[0].id;
  assert.deepEqual((await db.query('SELECT rol_ids FROM empresa_paginas WHERE empresa_id=10 AND pagina_id=$1',[paginaSeguimiento])).rows[0].rol_ids,[90]);
  console.log(
    'OK: migración, evidencias, locales compartidos y agendas separadas por equipo.',
  );
} catch (error) {
  console.error('Fallo de migracion/agenda:', error.message);
  fallo=true;
} finally {
  await db.close();
}
if(fallo)process.exitCode=1;
