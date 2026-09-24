import { BadRequestException } from '@nestjs/common';
import { FrecuenciaAvisoCampo } from '../../../generated/prisma/client';

const zona = 'America/Asuncion';
const formato = new Intl.DateTimeFormat('en-GB', {
  timeZone: zona,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

export interface ReglaAviso {
  frecuencia: FrecuenciaAvisoCampo;
  fechaInicio: string;
  hora: string;
  intervaloHoras?: number | null;
  diasSemana: number[];
  diaMes?: number | null;
  fechaFin?: string | null;
}

function partes(fecha: Date) {
  const p = Object.fromEntries(
    formato.formatToParts(fecha).map((item) => [item.type, Number(item.value)]),
  );
  return { y: p.year, m: p.month, d: p.day, h: p.hour, min: p.minute };
}

function fechaValida(valor: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(valor)) return false;
  const [y, m, d] = valor.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toISOString().slice(0, 10) === valor;
}

function instanteLocal(fecha: string, hora: string): Date {
  const [y, m, d] = fecha.split('-').map(Number);
  const [h, min] = hora.split(':').map(Number);
  const local = Date.UTC(y, m - 1, d, h, min);
  let utc = local;
  for (let i = 0; i < 4; i++) {
    const p = partes(new Date(utc));
    utc += local - Date.UTC(p.y, p.m - 1, p.d, p.h, p.min);
  }
  const p = partes(new Date(utc));
  if (p.y !== y || p.m !== m || p.d !== d || p.h !== h || p.min !== min) {
    throw new BadRequestException(
      'La hora indicada no existe en la zona horaria de Paraguay',
    );
  }
  return new Date(utc);
}

/** Siguiente disparo en horario de Paraguay; fechas omitidas no se recuperan en bloque. */
export function siguienteAviso(
  regla: ReglaAviso,
  despuesDe: Date,
): Date | null {
  if (
    !fechaValida(regla.fechaInicio) ||
    (regla.fechaFin &&
      (!fechaValida(regla.fechaFin) || regla.fechaFin < regla.fechaInicio))
  ) {
    throw new BadRequestException('Rango de fechas inválido');
  }
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(regla.hora)) {
    throw new BadRequestException('Hora inválida');
  }
  if (regla.frecuencia === 'HORARIA') {
    if (
      !Number.isInteger(regla.intervaloHoras) ||
      (regla.intervaloHoras ?? 0) < 1 ||
      (regla.intervaloHoras ?? 0) > 168
    ) {
      throw new BadRequestException('El intervalo debe ser de 1 a 168 horas');
    }
    const primero = instanteLocal(regla.fechaInicio, regla.hora);
    const salto = regla.intervaloHoras! * 3600000;
    const pasos = Math.max(
      0,
      Math.floor((despuesDe.getTime() - primero.getTime()) / salto) + 1,
    );
    const candidato = new Date(primero.getTime() + pasos * salto);
    const local = partes(candidato);
    const fechaLocal = `${local.y}-${String(local.m).padStart(2, '0')}-${String(local.d).padStart(2, '0')}`;
    return regla.fechaFin && fechaLocal > regla.fechaFin ? null : candidato;
  }
  if (
    regla.frecuencia === 'SEMANAL' &&
    (regla.diasSemana.length === 0 ||
      regla.diasSemana.some(
        (dia) => !Number.isInteger(dia) || dia < 1 || dia > 7,
      ))
  ) {
    throw new BadRequestException('Selecciona al menos un día de la semana');
  }
  if (
    regla.frecuencia === 'MENSUAL' &&
    (!Number.isInteger(regla.diaMes) ||
      (regla.diaMes ?? 0) < 1 ||
      (regla.diaMes ?? 0) > 31)
  ) {
    throw new BadRequestException('Día del mes inválido');
  }
  const inicio = Date.parse(`${regla.fechaInicio}T00:00:00Z`);
  const localAhora = partes(despuesDe);
  const hoy = Date.UTC(localAhora.y, localAhora.m - 1, localAhora.d);
  const desde = regla.frecuencia === 'UNA_VEZ' ? inicio : Math.max(inicio, hoy);
  for (let i = 0; i < 367; i++) {
    const dia = new Date(desde + i * 86400000);
    const fecha = dia.toISOString().slice(0, 10);
    if (regla.fechaFin && fecha > regla.fechaFin) return null;
    if (regla.frecuencia === 'UNA_VEZ' && fecha !== regla.fechaInicio)
      return null;
    if (
      regla.frecuencia === 'SEMANAL' &&
      !regla.diasSemana.includes(dia.getUTCDay() || 7)
    )
      continue;
    if (regla.frecuencia === 'MENSUAL') {
      const ultimo = new Date(
        Date.UTC(dia.getUTCFullYear(), dia.getUTCMonth() + 1, 0),
      ).getUTCDate();
      if (dia.getUTCDate() !== Math.min(regla.diaMes!, ultimo)) continue;
    }
    const instante = instanteLocal(fecha, regla.hora);
    if (instante > despuesDe) return instante;
    if (regla.frecuencia === 'UNA_VEZ') return null;
  }
  return null;
}
