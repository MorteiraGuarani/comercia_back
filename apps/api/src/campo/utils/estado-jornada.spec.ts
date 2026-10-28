import {
  ausenciasAgenda,
  asistenciaCampo,
  conEstadoVisita,
  estadoAgenda,
  estadoVisita,
  evaluarPresentismo,
} from './estado-jornada';

const fecha = new Date('2026-10-09T00:00:00Z');
const hora = (h: string) => new Date(`2026-10-09T${h}:00-03:00`);

it('la hora de llegada no cambia el estado: no existe Tarde', () => {
  const base = {
    fecha,
    horaDesde: '10:30',
    horaHasta: '18:00',
    zonaHoraria: 'America/Asuncion',
    entrada: hora('10:44'),
    salida: hora('17:46'),
  };
  expect(evaluarPresentismo(base)).toBe('PRESENTE');
  expect(
    evaluarPresentismo({
      ...base,
      toleranciasAplicadas: { toleranciaEntrada: 5 },
    }),
  ).toBe('PRESENTE');
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

describe('Estados de las visitas de campo en Comercia', () => {
  it('sin marcas es Pendiente hasta que termina la jornada y luego Ausente', () => {
    expect(evaluarPresentismo(turno, hora('10:00'))).toBe('SIN_REGISTRO');
    expect(evaluarPresentismo(turno, hora('17:59'))).toBe('SIN_REGISTRO');
    expect(evaluarPresentismo(turno, hora('18:00'))).toBe('AUSENTE');
  });
  it('con entrada y salida es Visitado, llegue a la hora que llegue', () => {
    for (const [entrada, salida] of [
      ['10:30', '10:45'],
      ['11:00', '11:30'],
      ['18:30', '19:00'],
    ])
      expect(
        evaluarPresentismo(
          { ...turno, entrada: hora(entrada), salida: hora(salida) },
          hora('19:30'),
        ),
      ).toBe('PRESENTE');
  });
  it('con entrada sin salida es En curso hasta que termina la jornada del local y después Incompleto', () => {
    const abierta = { ...turno, entrada: hora('10:30') };
    expect(evaluarPresentismo(abierta, hora('17:59'))).toBe('EN_CURSO');
    expect(evaluarPresentismo(abierta, hora('18:00'))).toBe('INCOMPLETO');
    const visita = {
      fecha,
      entrada: hora('17:50'),
      salida: null,
      horarioId: 2,
      horario: { entrada: '10:30', salida: '18:00' },
    };
    const ruta = (ahora: Date) =>
      estadoAgenda(
        [visita],
        [horario],
        'America/Asuncion',
        '2026-10-09',
        '2026-10-09',
        ahora,
      );
    expect(ruta(hora('17:55'))).toEqual({
      estado: 'en_curso',
      estadoPresentismo: 'EN_CURSO',
    });
    // Itinerario y Presentismo dicen lo mismo.
    expect(ruta(hora('18:30'))).toEqual({
      estado: 'incompleto',
      estadoPresentismo: 'INCOMPLETO',
    });
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
  it('sin horario no deduce ausencia y conserva jornadas cerradas', () => {
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
  it('en un período cuenta los turnos sin visita aunque el local tenga visitas', () => {
    const ahora = new Date('2026-10-12T10:00:00-03:00');
    const visitas = [
      {
        fecha: new Date('2026-10-10'),
        entrada: hora('11:10'),
        salida: hora('11:26'),
        horarioId: 2,
        horario: { entrada: '10:30', salida: '18:00' },
      },
    ];
    // Del 9 al 12: visitó el 10, faltó el 9 y el 11; el 12 todavía no venció.
    expect(
      ausenciasAgenda(
        visitas,
        [horario],
        'America/Asuncion',
        '2026-10-09',
        '2026-10-12',
        ahora,
      ),
    ).toBe(2);
    expect(
      ausenciasAgenda(
        visitas,
        [horario],
        'America/Asuncion',
        '2026-10-10',
        '2026-10-10',
        ahora,
      ),
    ).toBe(0);
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
    // Lo que está en curso hoy manda sobre lo de días anteriores.
    expect(ruta).toEqual({
      estado: 'en_curso',
      estadoPresentismo: 'EN_CURSO',
    });
    expect(asistenciaCampo([ruta.estado])).toBe('en_curso');
  });
});
