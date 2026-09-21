import { BadRequestException } from '@nestjs/common';
import type { ReglaHorario } from '../interfaces/calendario.interface';

export const ZONA_CAMPO = 'America/Asuncion';
export function relojCampo(ahora = new Date()) {
  const partes = new Intl.DateTimeFormat('en-CA', {
    timeZone: ZONA_CAMPO,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(ahora);
  const p = (tipo: string) => partes.find((x) => x.type === tipo)!.value;
  return {
    fecha: `${p('year')}-${p('month')}-${p('day')}`,
    hora: `${p('hour')}:${p('minute')}`,
  };
}
export function fechaCampo(fecha: string): Date {
  const resultado = new Date(`${fecha}T00:00:00.000Z`);
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(fecha) ||
    Number.isNaN(resultado.getTime()) ||
    resultado.toISOString().slice(0, 10) !== fecha
  )
    throw new BadRequestException('Fecha inválida');
  return resultado;
}
export function vigenciaCampo(desde: string, hasta?: string | null) {
  const fechaDesde = fechaCampo(desde);
  const fechaHasta = hasta ? fechaCampo(hasta) : null;
  if (fechaHasta && fechaHasta < fechaDesde)
    throw new BadRequestException(
      'La fecha hasta debe ser igual o posterior a desde',
    );
  return { fechaDesde, fechaHasta };
}

export function rangoConsulta(query: {
  fecha?: string;
  fechaInicio?: string;
  fechaFin?: string;
}): { desde: string; hasta: string } {
  const desde = query.fechaInicio ?? query.fecha ?? relojCampo().fecha;
  const hasta = query.fechaFin ?? query.fecha ?? desde;
  if (hasta < desde)
    throw new BadRequestException(
      'La fecha hasta debe ser igual o posterior a desde',
    );
  fechaCampo(desde);
  fechaCampo(hasta);
  return { desde, hasta };
}

export function ocurreHorarioEnRango(
  h: ReglaHorario,
  desde: Date,
  hasta: Date,
): boolean {
  for (let t = desde.getTime(); t <= hasta.getTime(); t += 86_400_000) {
    if (ocurreHorario(h, new Date(t))) return true;
  }
  return false;
}
export function ocurreHorario(h: ReglaHorario, fecha: Date): boolean {
  if (fecha < h.fechaDesde || (h.fechaHasta && fecha > h.fechaHasta))
    return false;
  const dias = Math.floor(
    (fecha.getTime() - h.fechaDesde.getTime()) / 86400000,
  );
  if (h.frecuencia === 'DIARIA') return dias % h.intervalo === 0;
  if (h.frecuencia === 'SEMANAL') {
    const lunes = (h.fechaDesde.getUTCDay() + 6) % 7;
    return (
      Math.floor((dias + lunes) / 7) % h.intervalo === 0 &&
      h.diasSemana.includes(fecha.getUTCDay() || 7)
    );
  }
  const meses =
    (fecha.getUTCFullYear() - h.fechaDesde.getUTCFullYear()) * 12 +
    fecha.getUTCMonth() -
    h.fechaDesde.getUTCMonth();
  return meses % h.intervalo === 0 && h.diasMes.includes(fecha.getUTCDate());
}
export function validarHorario(h: ReglaHorario) {
  if (h.entrada >= h.salida)
    throw new BadRequestException(
      'La salida debe ser posterior a la entrada dentro del mismo día',
    );
  if (h.frecuencia === 'SEMANAL' && !h.diasSemana.length)
    throw new BadRequestException('Elegí al menos un día de semana');
  if (h.frecuencia === 'MENSUAL' && !h.diasMes.length)
    throw new BadRequestException('Elegí al menos un día del mes');
}
