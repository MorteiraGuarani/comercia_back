import { Prisma } from '../../../generated/prisma/client';

function condicionHorario(diaSql: Prisma.Sql) {
  return Prisma.sql`
    NOT EXISTS (SELECT 1 FROM campo_horarios h WHERE h.local_id = l.id AND h.activo)
    OR EXISTS (
      SELECT 1 FROM campo_horarios h WHERE h.local_id = l.id AND h.activo
      AND h.fecha_desde <= ${diaSql} AND (h.fecha_hasta IS NULL OR h.fecha_hasta >= ${diaSql})
      AND (
        (h.frecuencia = 'DIARIA' AND (${diaSql} - h.fecha_desde) % h.intervalo = 0)
        OR (h.frecuencia = 'SEMANAL' AND EXTRACT(ISODOW FROM ${diaSql})::int = ANY(h.dias_semana)
          AND ((${diaSql} - h.fecha_desde + EXTRACT(ISODOW FROM h.fecha_desde)::int - 1) / 7) % h.intervalo = 0)
        OR (h.frecuencia = 'MENSUAL' AND EXTRACT(DAY FROM ${diaSql})::int = ANY(h.dias_mes)
          AND ((EXTRACT(YEAR FROM ${diaSql})::int - EXTRACT(YEAR FROM h.fecha_desde)::int) * 12
            + EXTRACT(MONTH FROM ${diaSql})::int - EXTRACT(MONTH FROM h.fecha_desde)::int) % h.intervalo = 0)
      )
    )`;
}

// Alias fijos de tablas; todos los valores externos se parametrizan.
// Un solo día usa date (entero de días). El rango castea generate_series a date
// porque el interval de series no admite `% intervalo`.
export function condicionAgenda(
  empresaId: number,
  usuarioId: number,
  fecha: string,
  fechaFin = fecha,
) {
  if (fecha === fechaFin) {
    const dia = Prisma.sql`${fecha}::date`;
    return Prisma.sql`
      c.empresa_id = ${empresaId} AND c.activo AND l.activo AND a.activo
      AND a.fecha_desde <= ${dia} AND (a.fecha_hasta IS NULL OR a.fecha_hasta >= ${dia})
      AND (
        (a.usuario_id = ${usuarioId} AND NOT EXISTS (
          SELECT 1 FROM campo_backups b WHERE b.asignacion_id = a.id AND b.activo
          AND ${dia} BETWEEN b.fecha_desde AND b.fecha_hasta
        )) OR EXISTS (
          SELECT 1 FROM campo_backups b WHERE b.asignacion_id = a.id AND b.activo AND b.usuario_id = ${usuarioId}
          AND ${dia} BETWEEN b.fecha_desde AND b.fecha_hasta
        )
      ) AND (${condicionHorario(dia)})`;
  }

  const dia = Prisma.sql`(d.dia::date)`;
  return Prisma.sql`
    c.empresa_id = ${empresaId} AND c.activo AND l.activo AND a.activo
    AND a.fecha_desde <= ${fechaFin}::date AND (a.fecha_hasta IS NULL OR a.fecha_hasta >= ${fecha}::date)
    AND (
      (a.usuario_id = ${usuarioId} AND NOT EXISTS (
        SELECT 1 FROM campo_backups b WHERE b.asignacion_id = a.id AND b.activo
        AND b.fecha_desde <= ${fechaFin}::date AND b.fecha_hasta >= ${fecha}::date
      )) OR EXISTS (
        SELECT 1 FROM campo_backups b WHERE b.asignacion_id = a.id AND b.activo AND b.usuario_id = ${usuarioId}
        AND b.fecha_desde <= ${fechaFin}::date AND b.fecha_hasta >= ${fecha}::date
      )
    ) AND (
      NOT EXISTS (SELECT 1 FROM campo_horarios h WHERE h.local_id = l.id AND h.activo)
      OR EXISTS (
        SELECT 1 FROM campo_horarios h
        CROSS JOIN generate_series(${fecha}::date, ${fechaFin}::date, interval '1 day') AS d(dia)
        WHERE h.local_id = l.id AND h.activo
        AND h.fecha_desde <= ${dia} AND (h.fecha_hasta IS NULL OR h.fecha_hasta >= ${dia})
        AND (
          (h.frecuencia = 'DIARIA' AND (${dia} - h.fecha_desde) % h.intervalo = 0)
          OR (h.frecuencia = 'SEMANAL' AND EXTRACT(ISODOW FROM ${dia})::int = ANY(h.dias_semana)
            AND ((${dia} - h.fecha_desde + EXTRACT(ISODOW FROM h.fecha_desde)::int - 1) / 7) % h.intervalo = 0)
          OR (h.frecuencia = 'MENSUAL' AND EXTRACT(DAY FROM ${dia})::int = ANY(h.dias_mes)
            AND ((EXTRACT(YEAR FROM ${dia})::int - EXTRACT(YEAR FROM h.fecha_desde)::int) * 12
              + EXTRACT(MONTH FROM ${dia})::int - EXTRACT(MONTH FROM h.fecha_desde)::int) % h.intervalo = 0)
        )
      )
    )`;
}
