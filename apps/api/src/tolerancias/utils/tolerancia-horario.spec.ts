import {
  evaluarMarcaHorario,
  heredarTolerancias,
  minutosDentroHorario,
  TOLERANCIA_INICIAL,
  toleranciasCoherentes,
} from './tolerancia-horario';
describe('Tolerancias de horario', () => {
  it('mantiene coherentes los límites efectivos si cambia un nivel superior', () => {
    expect(
      heredarTolerancias(
        { toleranciaEntrada: 60, limiteEntrada: 80 },
        { limiteEntrada: 30 },
      ),
    ).toMatchObject({ toleranciaEntrada: 60, limiteEntrada: 60 });
  });
  const t = TOLERANCIA_INICIAL;
  const marca = (tipo: 'ENTRADA' | 'SALIDA', hora: string) =>
    evaluarMarcaHorario(
      tipo,
      new Date('2026-10-15T' + hora + ':00-03:00'),
      '2026-10-15',
      '08:00',
      '17:00',
      'America/Asuncion',
      t,
    ).color;
  it.each([
    ['07:00', 'VERDE'],
    ['06:59', 'ROJO'],
    ['08:14', 'VERDE'],
    ['08:15', 'AMARILLO'],
    ['08:30', 'AMARILLO'],
    ['08:31', 'ROJO'],
  ])('clasifica entrada %s', (h, c) => expect(marca('ENTRADA', h)).toBe(c));
  it.each([
    ['16:46', 'VERDE'],
    ['16:45', 'ROJO'],
    ['17:14', 'VERDE'],
    ['17:15', 'AMARILLO'],
    ['17:59', 'AMARILLO'],
    ['18:00', 'ROJO'],
  ])('clasifica salida %s', (h, c) => expect(marca('SALIDA', h)).toBe(c));
  it('hereda por campo y respeta cero y null', () => {
    expect(
      heredarTolerancias(
        { toleranciaEntrada: 5 },
        { anticipoEntrada: 20 },
        { toleranciaEntrada: 0 },
        { anticipoEntrada: null },
      ),
    ).toMatchObject({ toleranciaEntrada: 0, anticipoEntrada: 20 });
  });
  it('rechaza límites invertidos', () =>
    expect(toleranciasCoherentes({ ...t, limiteSalida: 0 })).toBe(false));
  it('no computa anticipos ni permanencia posterior', () => {
    expect(
      minutosDentroHorario(
        new Date('2026-10-15T07:00:00-03:00'),
        new Date('2026-10-15T18:00:00-03:00'),
        '2026-10-15',
        '08:00',
        '17:00',
        'America/Asuncion',
      ),
    ).toBe(540);
    expect(
      minutosDentroHorario(
        new Date('2026-10-15T06:00:00-03:00'),
        new Date('2026-10-15T07:00:00-03:00'),
        '2026-10-15',
        '08:00',
        '17:00',
        'America/Asuncion',
      ),
    ).toBe(0);
  });
  it('evalúa fechas y turnos que cruzan medianoche', () => {
    expect(
      evaluarMarcaHorario(
        'SALIDA',
        new Date('2026-10-16T02:14:00-03:00'),
        '2026-10-15',
        '22:00',
        '02:00',
        'America/Asuncion',
        t,
      ).color,
    ).toBe('VERDE');
  });
});
