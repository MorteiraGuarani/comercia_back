import {
  fechaCampo,
  ocurreHorario,
  rangoConsulta,
  validarHorario,
  vigenciaCampo,
} from './calendario';
import type { ReglaHorario } from '../interfaces/calendario.interface';

const regla: ReglaHorario = {
  frecuencia: 'SEMANAL',
  intervalo: 2,
  diasSemana: [1, 3],
  diasMes: [],
  fechaDesde: fechaCampo('2026-09-07'),
  fechaHasta: null,
  entrada: '08:00',
  salida: '12:00',
};
describe('Calendario de campo', () => {
  it('resuelve semanas alternas y sus días', () => {
    expect(ocurreHorario(regla, fechaCampo('2026-09-09'))).toBe(true);
    expect(ocurreHorario(regla, fechaCampo('2026-09-14'))).toBe(false);
    expect(ocurreHorario(regla, fechaCampo('2026-09-21'))).toBe(true);
  });
  it('respeta vigencias y meses sin día 31', () => {
    const mensual = {
      ...regla,
      frecuencia: 'MENSUAL' as const,
      intervalo: 1,
      diasMes: [31],
    };
    expect(ocurreHorario(mensual, fechaCampo('2026-09-30'))).toBe(false);
    expect(ocurreHorario(mensual, fechaCampo('2026-10-31'))).toBe(true);
    expect(
      ocurreHorario(
        { ...mensual, fechaHasta: fechaCampo('2026-10-01') },
        fechaCampo('2026-10-31'),
      ),
    ).toBe(false);
  });
  it('rechaza fechas imposibles, rangos invertidos y franjas vacías', () => {
    expect(() => fechaCampo('2026-02-30')).toThrow();
    expect(() => vigenciaCampo('2026-10-01', '2026-09-01')).toThrow();
    expect(() => validarHorario({ ...regla, salida: '07:00' })).toThrow();
    expect(() => validarHorario({ ...regla, diasSemana: [] })).toThrow();
  });
  it('conserva lunes a domingo de la semana pasada como rango', () => {
    expect(
      rangoConsulta({
        fechaInicio: '2026-09-14',
        fechaFin: '2026-09-20',
      }),
    ).toEqual({ desde: '2026-09-14', hasta: '2026-09-20' });
  });
});
