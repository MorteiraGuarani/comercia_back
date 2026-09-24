import { siguienteAviso } from './programacion-aviso';

describe('siguienteAviso', () => {
  it('convierte la hora de Paraguay a UTC para un envío único', () => {
    const fecha = siguienteAviso(
      {
        frecuencia: 'UNA_VEZ',
        fechaInicio: '2026-09-24',
        hora: '09:30',
        diasSemana: [],
      },
      new Date('2026-09-23T00:00:00Z'),
    );
    const partes = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'America/Asuncion',
      hour: '2-digit',
      minute: '2-digit',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hourCycle: 'h23',
    }).format(fecha!);
    expect(partes).toContain('24/09/2026');
    expect(partes).toContain('09:30');
    expect(
      siguienteAviso(
        {
          frecuencia: 'UNA_VEZ',
          fechaInicio: '2026-09-24',
          hora: '09:30',
          diasSemana: [],
        },
        fecha!,
      ),
    ).toBeNull();
  });

  it('elige solo los días semanales seleccionados y respeta la fecha de fin', () => {
    const regla = {
      frecuencia: 'SEMANAL' as const,
      fechaInicio: '2026-09-21',
      hora: '08:00',
      diasSemana: [1, 3],
      fechaFin: '2026-09-30',
    };
    const primera = siguienteAviso(regla, new Date('2026-09-22T00:00:00Z'))!;
    expect(
      new Intl.DateTimeFormat('en-CA', {
        timeZone: 'America/Asuncion',
        weekday: 'long',
      }).format(primera),
    ).toBe('Wednesday');
    expect(siguienteAviso(regla, new Date('2026-10-01T00:00:00Z'))).toBeNull();
  });

  it('ajusta el día 31 al último día de febrero', () => {
    const fecha = siguienteAviso(
      {
        frecuencia: 'MENSUAL',
        fechaInicio: '2027-02-01',
        hora: '18:00',
        diasSemana: [],
        diaMes: 31,
      },
      new Date('2027-02-01T00:00:00Z'),
    )!;
    expect(
      new Intl.DateTimeFormat('en-GB', {
        timeZone: 'America/Asuncion',
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      }).format(fecha),
    ).toBe('28/02/2027');
  });

  it('programa intervalos horarios sin duplicar el instante ya enviado', () => {
    const regla = {
      frecuencia: 'HORARIA' as const,
      fechaInicio: '2026-09-24',
      hora: '08:00',
      intervaloHoras: 3,
      diasSemana: [],
    };
    const primera = siguienteAviso(regla, new Date('2026-09-24T00:00:00Z'))!;
    const segunda = siguienteAviso(regla, primera)!;
    expect(segunda.getTime() - primera.getTime()).toBe(3 * 3600000);
  });
});
