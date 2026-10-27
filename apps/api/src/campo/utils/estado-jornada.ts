import {
  evaluarMarcaHorario,
  heredarTolerancias,
  minutosDentroHorario,
} from '../../tolerancias/utils/tolerancia-horario';
import type {
  AsistenciaCampo,
  EstadoPresentismo,
  EstadoRuta,
  EstadoVisita,
  RegistroPresentismoCampo,
  VisitaParaEstado,
} from '../interfaces/estado-jornada.interface';
import type { ReglaHorario } from '../interfaces/calendario.interface';
import {
  fechaCampo,
  ocurreHorario,
  relojCampo,
  ZONA_CAMPO,
} from './calendario';

// Visitas de campo: el horario del local es la ventana para llegar, no un turno
// que haya que cumplir entero como en UWeb. Iniciar y finalizar la visita nunca
// es Incompleto: salir antes del fin es normal (se visita 10 o 30 minutos) y
// llegar después del inicio, aun pasado el fin, es Tarde. Incompleto queda para
// la visita que no se finalizó en el día (o una salida sin entrada).
export function evaluarPresentismo(
  r: RegistroPresentismoCampo,
  ahora = new Date(),
): EstadoPresentismo {
  const fecha =
    typeof r.fecha === 'string'
      ? r.fecha.slice(0, 10)
      : r.fecha.toISOString().slice(0, 10);
  const zona = r.zonaHoraria ?? ZONA_CAMPO;
  const instante = (d: Date | string) => {
    const reloj = relojCampo(new Date(d), zona);
    return `${reloj.fecha}T${reloj.hora}`;
  };
  if (!r.entrada) {
    if (!r.horaDesde || !r.horaHasta) return 'SIN_REGISTRO';
    if (r.salida) return 'INCOMPLETO';
    return instante(ahora) >= `${fecha}T${r.horaHasta}`
      ? 'AUSENTE'
      : 'SIN_REGISTRO';
  }
  if (!r.salida && relojCampo(ahora, zona).fecha > fecha) return 'INCOMPLETO';
  if (!r.horaDesde || !r.horaHasta) return 'PRESENTE';
  const inicio = `${fecha}T${r.horaDesde}`;
  const t = r.toleranciasAplicadas
    ? heredarTolerancias(r.toleranciasAplicadas)
    : null;
  return (
    t
      ? evaluarMarcaHorario(
          'ENTRADA',
          new Date(r.entrada),
          fecha,
          r.horaDesde,
          r.horaHasta,
          zona,
          t,
        ).desvioMinutos > t.toleranciaEntrada
      : instante(r.entrada) > inicio
  )
    ? 'TARDE'
    : 'PRESENTE';
}

export function estadoVisita(
  v: Pick<VisitaParaEstado, 'fecha' | 'salida'>,
  ahora = new Date(),
): EstadoVisita {
  if (v.salida) return 'CERRADA';
  return v.fecha.toISOString().slice(0, 10) === relojCampo(ahora).fecha
    ? 'EN_CURSO'
    : 'INCOMPLETA';
}

export function conEstadoVisita<T extends VisitaParaEstado>(
  v: T,
  ahora = new Date(),
) {
  // El evento conserva el horario que tenía UCheck al aceptar la entrada.
  const evento = v.eventosUcheck?.[0];
  return {
    ...v,
    minutosComputables:
      v.toleranciasAplicadas &&
      v.salida &&
      (evento?.horaDesde ?? v.horario?.entrada) &&
      (evento?.horaHasta ?? v.horario?.salida)
        ? minutosDentroHorario(
            v.entrada,
            v.salida,
            v.fecha.toISOString().slice(0, 10),
            (evento?.horaDesde ?? v.horario?.entrada)!,
            (evento?.horaHasta ?? v.horario?.salida)!,
            ZONA_CAMPO,
          )
        : null,
    estado: estadoVisita(v, ahora),
    estadoPresentismo: evaluarPresentismo(
      {
        ...v,
        horaDesde: evento?.horaDesde ?? v.horario?.entrada,
        horaHasta: evento?.horaHasta ?? v.horario?.salida,
      },
      ahora,
    ),
  };
}

export function resumirPresentismo(
  estados: EstadoPresentismo[],
): EstadoPresentismo {
  return (
    (['INCOMPLETO', 'AUSENTE', 'TARDE', 'PRESENTE'] as const).find((e) =>
      estados.includes(e),
    ) ?? 'SIN_REGISTRO'
  );
}

export function estadoAgenda(
  visitas: VisitaParaEstado[],
  horarios: (ReglaHorario & { id: number; entrada: string; salida: string })[],
  zonaHoraria: string | undefined,
  desde: string,
  hasta: string,
  ahora = new Date(),
  asignacion?: { fechaDesde: Date; fechaHasta: Date | null },
) {
  const marcas = visitas.map((v) => conEstadoVisita(v, ahora));
  const estados = marcas.map((v) => v.estadoPresentismo);
  const inicio = Math.max(
    fechaCampo(desde).getTime(),
    asignacion?.fechaDesde.getTime() ?? -Infinity,
  );
  const fin = Math.min(
    fechaCampo(hasta).getTime(),
    asignacion?.fechaHasta?.getTime() ?? Infinity,
  );
  for (let t = inicio; t <= fin; t += 86_400_000) {
    const fecha = new Date(t);
    for (const h of horarios) {
      if (
        !ocurreHorario(h, fecha) ||
        visitas.some((v) => v.fecha.getTime() === t && v.horarioId === h.id)
      )
        continue;
      estados.push(
        evaluarPresentismo(
          {
            fecha,
            zonaHoraria,
            horaDesde: h.entrada,
            horaHasta: h.salida,
            entrada: null,
            salida: null,
          },
          ahora,
        ),
      );
    }
  }
  const estadoPresentismo = resumirPresentismo(estados);
  const estado: EstadoRuta = marcas.some((v) => v.estado === 'EN_CURSO')
    ? 'en_curso'
    : estadoPresentismo === 'INCOMPLETO'
      ? 'incompleto'
      : estadoPresentismo === 'AUSENTE'
        ? 'ausente'
        : marcas.length
          ? 'completado'
          : 'pendiente';
  return { estado, estadoPresentismo };
}

export function asistenciaCampo(estados: EstadoRuta[]): AsistenciaCampo {
  if (estados.includes('en_curso')) return 'en_curso';
  if (estados.includes('incompleto')) return 'incompleto';
  if (estados.includes('ausente')) return 'ausente';
  return estados.includes('completado') ? 'finalizado' : 'sin_iniciar';
}
