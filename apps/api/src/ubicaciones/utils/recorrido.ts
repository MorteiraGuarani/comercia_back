import { distanciaMetros } from '../../common/utils/geo';
import type {
  CalculoRecorrido,
  PuntoRecorrido,
  TramoRecorrido,
  VisitaRecorrido,
} from '../interfaces/recorrido.interface';

/** Peor precisión aceptada: más allá el punto agrega distancia falsa. */
export const MAX_PRECISION_METROS = 100;
export const RADIO_PARADA_METROS = 60;
export const MIN_PARADA_MS = 5 * 60_000;
/** Entre dos puntos más separados que esto no se sabe qué pasó. */
export const MAX_HUECO_MS = 20 * 60_000;

const metros = (a: PuntoRecorrido, b: PuntoRecorrido) =>
  distanciaMetros(a.latitud, a.longitud, b.latitud, b.longitud);
const ms = (a: PuntoRecorrido, b: PuntoRecorrido) =>
  b.capturadaEn.getTime() - a.capturadaEn.getTime();
const minutos = (valor: number) => Math.round(valor / 60_000);

/** Rangos de índices [desde, hasta] en los que la persona estuvo quieta. */
function rangosDetenido(p: PuntoRecorrido[]): [number, number][] {
  const rangos: [number, number][] = [];
  let i = 0;
  while (i < p.length) {
    let j = i;
    while (j + 1 < p.length && metros(p[i], p[j + 1]) <= RADIO_PARADA_METROS)
      j++;
    if (ms(p[i], p[j]) < MIN_PARADA_MS) {
      i++;
      continue;
    }
    const previo = rangos[rangos.length - 1];
    // Un salto del GPS corta la parada: si vuelve enseguida al mismo lugar,
    // es la misma parada.
    if (
      previo &&
      metros(p[previo[0]], p[i]) <= RADIO_PARADA_METROS &&
      ms(p[previo[1]], p[i]) < MIN_PARADA_MS
    )
      previo[1] = j;
    else rangos.push([i, j]);
    i = j + 1;
  }
  return rangos;
}

/**
 * Línea de tiempo del día a partir de los puntos ordenados por hora: paradas
 * (5 min o más dentro de 60 m), tramos en movimiento y huecos sin señal. La
 * distancia suma los tramos entre paradas, sin el temblor del GPS en cada una.
 */
export function calcularRecorrido(
  todos: PuntoRecorrido[],
  visitas: VisitaRecorrido[],
): CalculoRecorrido {
  const p = todos.filter((x) => x.precisionMetros <= MAX_PRECISION_METROS);
  const tramos: TramoRecorrido[] = [];
  const total = { metros: 0, detenido: 0, movimiento: 0, sinDatos: 0 };

  const moverse = (desde: number, hasta: number) => {
    for (let k = desde; k < hasta; k++) {
      const d = metros(p[k], p[k + 1]);
      const t = ms(p[k], p[k + 1]);
      const tipo = t > MAX_HUECO_MS ? 'sin_datos' : 'movimiento';
      total.metros += d;
      if (tipo === 'sin_datos') total.sinDatos += t;
      else total.movimiento += t;
      const ultimo = tramos[tramos.length - 1];
      if (k > desde && tipo === 'movimiento' && ultimo?.tipo === tipo) {
        ultimo.hasta = p[k + 1].capturadaEn;
        ultimo.metros += d;
      } else
        tramos.push({
          tipo,
          desde: p[k].capturadaEn,
          hasta: p[k + 1].capturadaEn,
          minutos: 0,
          metros: d,
        });
    }
  };

  let cursor = 0;
  for (const [a, b] of rangosDetenido(p)) {
    moverse(cursor, a);
    const lugar = p.slice(a, b + 1);
    const desde = p[a].capturadaEn;
    const hasta = p[b].capturadaEn;
    total.detenido += ms(p[a], p[b]);
    const visita = visitas.find(
      (v) => v.entrada <= hasta && (v.salida === null || v.salida >= desde),
    );
    tramos.push({
      tipo: 'parada',
      desde,
      hasta,
      minutos: 0,
      metros: 0,
      latitud: lugar.reduce((s, x) => s + x.latitud, 0) / lugar.length,
      longitud: lugar.reduce((s, x) => s + x.longitud, 0) / lugar.length,
      visitaId: visita?.id ?? null,
    });
    cursor = b;
  }
  moverse(cursor, p.length - 1);

  return {
    puntos: p,
    tramos: tramos.map((t) => ({
      ...t,
      minutos: minutos(t.hasta.getTime() - t.desde.getTime()),
      metros: Math.round(t.metros),
    })),
    resumen: {
      puntos: p.length,
      descartados: todos.length - p.length,
      metros: Math.round(total.metros),
      minutosDetenido: minutos(total.detenido),
      minutosEnMovimiento: minutos(total.movimiento),
      minutosSinDatos: minutos(total.sinDatos),
      inicio: p[0]?.capturadaEn ?? null,
      fin: p[p.length - 1]?.capturadaEn ?? null,
    },
  };
}
