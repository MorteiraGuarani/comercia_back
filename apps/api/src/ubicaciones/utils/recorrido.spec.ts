import { calcularRecorrido } from './recorrido';
import { enJornada } from './jornada';

// ~0,000009° de latitud = 1 m.
const punto = (hora: string, metrosAlNorte: number, precisionMetros = 10) => ({
  latitud: -25.3 + metrosAlNorte * 0.000009,
  longitud: -57.6,
  precisionMetros,
  velocidadMps: null,
  capturadaEn: new Date(`2026-10-23T${hora}:00-03:00`),
});
const visita = {
  id: 7,
  local: { id: 'C001', nombre: 'Súper Centro' },
  latitud: -25.3,
  longitud: -57.6,
  entrada: new Date('2026-10-23T08:00:00-03:00'),
  salida: new Date('2026-10-23T08:20:00-03:00'),
};

describe('calcularRecorrido', () => {
  it('separa paradas y movimiento, suma la distancia sin el temblor de la parada y marca la visita', () => {
    const r = calcularRecorrido(
      [
        punto('08:00', 0),
        punto('08:10', 20),
        punto('08:20', 5),
        punto('08:25', 500),
        punto('08:30', 1000),
        punto('08:40', 1010),
        punto('08:50', 1000),
      ],
      [visita],
    );
    expect(r.tramos.map((t) => [t.tipo, t.minutos])).toEqual([
      ['parada', 20],
      ['movimiento', 10],
      ['parada', 20],
    ]);
    expect(r.tramos[0].visitaId).toBe(7);
    expect(r.tramos[2].visitaId).toBeNull();
    expect(r.resumen.metros).toBeGreaterThan(990);
    expect(r.resumen.metros).toBeLessThan(1010);
    expect(r.resumen).toMatchObject({
      puntos: 7,
      descartados: 0,
      minutosDetenido: 40,
      minutosEnMovimiento: 10,
      minutosSinDatos: 0,
    });
  });

  it('no cuenta como movimiento un hueco largo sin señal ni usa puntos imprecisos', () => {
    const r = calcularRecorrido(
      [
        punto('09:00', 0),
        punto('09:01', 300, 900),
        punto('09:02', 200),
        punto('10:00', 3000),
      ],
      [],
    );
    expect(r.resumen.descartados).toBe(1);
    expect(r.puntos).toHaveLength(3);
    expect(r.tramos.map((t) => t.tipo)).toEqual(['movimiento', 'sin_datos']);
    expect(r.resumen).toMatchObject({
      minutosEnMovimiento: 2,
      minutosSinDatos: 58,
      minutosDetenido: 0,
    });
  });

  it('un salto del GPS no parte la parada en dos', () => {
    const r = calcularRecorrido(
      [
        punto('11:00', 0),
        punto('11:06', 10),
        punto('11:07', 90),
        punto('11:08', 5),
        punto('11:15', 0),
      ],
      [],
    );
    expect(r.tramos.map((t) => [t.tipo, t.minutos])).toEqual([['parada', 15]]);
    expect(r.resumen.metros).toBe(0);
  });

  it('sin puntos devuelve un día vacío', () => {
    expect(calcularRecorrido([], []).resumen).toMatchObject({
      puntos: 0,
      metros: 0,
      inicio: null,
    });
  });
});

describe('enJornada', () => {
  const v = (entrada: string, salida: string | null) => ({
    fecha: new Date('2026-10-23T00:00:00.000Z'),
    entrada: new Date(`2026-10-23T${entrada}:00-03:00`),
    salida: salida ? new Date(`2026-10-23T${salida}:00-03:00`) : null,
  });
  const a = (hora: string) => new Date(`2026-10-23T${hora}:00-03:00`);

  it('va desde la entrada hasta una hora después de la salida', () => {
    const visitas = [v('08:00', '09:00')];
    expect(enJornada(a('07:59'), visitas)).toBe(false);
    expect(enJornada(a('08:30'), visitas)).toBe(true);
    expect(enJornada(a('09:59'), visitas)).toBe(true);
    expect(enJornada(a('10:01'), visitas)).toBe(false);
  });

  it('una visita abierta solo cuenta en su propio día', () => {
    const visitas = [v('08:00', null)];
    expect(enJornada(a('20:00'), visitas)).toBe(true);
    expect(enJornada(new Date('2026-10-24T08:30:00-03:00'), visitas)).toBe(
      false,
    );
  });
});
