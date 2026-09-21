import { Prisma } from '../../../generated/prisma/client';

// Alias fijos de tablas; todos los valores externos se parametrizan.
// `fechaFin` igual a `fecha` conserva el filtro de un solo día.
export function condicionAgenda(
  empresaId: number,
  usuarioId: number,
  fecha: string,
  fechaFin = fecha,
) {
  const dia = Prisma.sql`d.dia`;
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
