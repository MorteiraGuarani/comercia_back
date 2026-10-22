import {
  asistenciaCampo,
  conEstadoVisita,
  estadoAgenda,
  estadoVisita,
  evaluarPresentismo,
} from './estado-jornada';

const fecha = new Date('2026-10-09T00:00:00Z');
const hora = (h: string) => new Date(`2026-10-09T${h}:00-03:00`);

it('respeta tolerancias guardadas y conserva el comportamiento histórico sin configuración', () => {
  const base = {
    fecha,
    horaDesde: '10:30',
    horaHasta: '18:00',
    zonaHoraria: 'America/Asuncion',
    entrada: hora('10:44'),
    salida: hora('17:46'),
  };
  expect(evaluarPresentismo(base)).toBe('INCOMPLETO');
  expect(
    evaluarPresentismo({
      ...base,
      toleranciasAplicadas: {
        toleranciaEntrada: 14,
        toleranciaSalidaAntes: 14,
      },
    }),
  ).toBe('PRESENTE');
  expect(
    evaluarPresentismo({
      ...base,
      entrada: hora('10:45'),
      salida: hora('18:00'),
      toleranciasAplicadas: { toleranciaEntrada: 14 },
    }),
  ).toBe('TARDE');
});
const turno = {
  fecha,
  horaDesde: '10:30',
  horaHasta: '18:00',
  zonaHoraria: 'America/Asuncion',
  entrada: null as Date | null,
  salida: null as Date | null,
};
const horario = {
  id: 2,
  frecuencia: 'DIARIA' as const,
  intervalo: 1,
  diasSemana: [],
  diasMes: [],
  fechaDesde: fecha,
  fechaHasta: null,
  entrada: '10:30',
  salida: '18:00',
};

describe('Estados de Comercia equivalentes a Presentismo UWeb', () => {
  it('sin marcas es Sin registro hasta finalizar el turno y luego Ausente', () => {
    expect(evaluarPresentismo(turno, hora('10:00'))).toBe('SIN_REGISTRO');
    expect(evaluarPresentismo(turno, hora('17:59'))).toBe('SIN_REGISTRO');
    expect(evaluarPresentismo(turno, hora('18:00'))).toBe('AUSENTE');
  });
  it('evalúa presente a las 10:30:59 y tarde desde las 10:31', () => {
    expect(
      evaluarPresentismo(
        { ...turno, entrada: new Date('2026-10-09T10:30:59-03:00') },
        hora('11:00'),
      ),
    ).toBe('PRESENTE');
    expect(
      evaluarPresentismo({ ...turno, entrada: hora('10:31') }, hora('11:00')),
    ).toBe('TARDE');
    expect(
      evaluarPresentismo(
        { ...turno, entrada: hora('10:31'), salida: hora('18:00') },
        hora('19:00'),
      ),
    ).toBe('TARDE');
  });
  it('sin salida al vencer o salida anticipada es Incompleto, aunque haya entrado tarde', () => {
    expect(
      evaluarPresentismo({ ...turno, entrada: hora('10:30') }, hora('18:00')),
    ).toBe('INCOMPLETO');
    expect(
      evaluarPresentismo(
        { ...turno, entrada: hora('11:00'), salida: hora('17:59') },
        hora('18:00'),
      ),
    ).toBe('INCOMPLETO');
  });
  it('la entrada del 9 deja de ser operable exactamente a medianoche del 10 sin inventar salida', () => {
    const visita = {
      fecha,
      entrada: new Date('2026-10-09T10:30:34-03:00'),
      salida: null,
    };
    expect(estadoVisita(visita, new Date('2026-10-09T23:59:59-03:00'))).toBe(
      'EN_CURSO',
    );
    const vencida = conEstadoVisita(
      visita,
      new Date('2026-10-10T00:00:00-03:00'),
    );
    expect(vencida.estado).toBe('INCOMPLETA');
    expect(vencida.estadoPresentismo).toBe('INCOMPLETO');
    expect(vencida.salida).toBeNull();
    expect(asistenciaCampo(['incompleto'])).toBe('incompleto');
  });
  it('no vence por el cambio de fecha UTC, sino por la fecha local', () => {
    expect(
      estadoVisita({ fecha, salida: null }, new Date('2026-10-10T02:59:59Z')),
    ).toBe('EN_CURSO');
  });
  it('sin horario no deduce tardanza ni ausencia y conserva jornadas cerradas', () => {
    const general = { ...turno, horaDesde: null, horaHasta: null };
    expect(evaluarPresentismo(general, hora('23:00'))).toBe('SIN_REGISTRO');
    expect(
      evaluarPresentismo({
        ...general,
        entrada: hora('15:00'),
        salida: hora('16:00'),
      }),
    ).toBe('PRESENTE');
    expect(estadoVisita({ fecha, salida: hora('16:00') })).toBe('CERRADA');
  });
  it('usa el horario histórico del evento UCheck antes del horario actual', () => {
    expect(
      conEstadoVisita({
        fecha,
        entrada: hora('10:30'),
        salida: hora('18:00'),
        horario: { entrada: '08:00', salida: '19:00' },
        eventosUcheck: [{ horaDesde: '10:30', horaHasta: '18:00' }],
      }).estadoPresentismo,
    ).toBe('PRESENTE');
  });
  it('Ruta conserva las visitas antiguas como incompletas y evalúa turnos sin marcas', () => {
    const ahora = new Date('2026-10-10T10:00:00-03:00');
    expect(
      estadoAgenda(
        [{ fecha, entrada: hora('10:30'), salida: null, horarioId: 2 }],
        [horario],
        'America/Asuncion',
        '2026-10-09',
        '2026-10-09',
        ahora,
      ),
    ).toEqual({ estado: 'incompleto', estadoPresentismo: 'INCOMPLETO' });
    expect(
      estadoAgenda(
        [],
        [horario],
        'America/Asuncion',
        '2026-10-09',
        '2026-10-09',
        ahora,
      ),
    ).toEqual({ estado: 'ausente', estadoPresentismo: 'AUSENTE' });
    expect(
      estadoAgenda(
        [],
        [],
        'America/Asuncion',
        '2026-10-09',
        '2026-10-09',
        ahora,
      ),
    ).toEqual({ estado: 'pendiente', estadoPresentismo: 'SIN_REGISTRO' });
  });
  it('no deduce ausencias antes del inicio de una asignación ni en turnos futuros', () => {
    const ahora = new Date('2026-10-10T10:00:00-03:00');
    expect(
      estadoAgenda(
        [],
        [horario],
        'America/Asuncion',
        '2026-10-09',
        '2026-10-10',
        ahora,
        { fechaDesde: new Date('2026-10-10'), fechaHasta: null },
      ),
    ).toEqual({ estado: 'pendiente', estadoPresentismo: 'SIN_REGISTRO' });
  });
  it('un período con una jornada incompleta y una actual distingue incidencia y actividad', () => {
    const ahora = new Date('2026-10-10T10:30:00-03:00');
    const ruta = estadoAgenda(
      [
        { fecha, entrada: hora('10:30'), salida: null },
        { fecha: new Date('2026-10-10'), entrada: ahora, salida: null },
      ],
      [],
      'America/Asuncion',
      '2026-10-09',
      '2026-10-10',
      ahora,
    );
    expect(ruta).toEqual({
      estado: 'en_curso',
      estadoPresentismo: 'INCOMPLETO',
    });
    expect(asistenciaCampo([ruta.estado])).toBe('en_curso');
  });
});
