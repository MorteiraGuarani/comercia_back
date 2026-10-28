import { minutosDentroHorario } from '../../tolerancias/utils/tolerancia-horario';
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

// Estados de una visita de campo (iguales en todos los módulos y roles):
// - Visitado (PRESENTE): tuvo entrada y salida.
// - En curso: entrada sin salida y la jornada del local todavía no terminó.
// - Incompleto: entrada sin salida y la jornada del local ya terminó.
// - Ausente: sin entrada y la jornada ya terminó.
// - Pendiente (SIN_REGISTRO): sin entrada y la jornada todavía no terminó.
// Sin horario, la jornada termina con el día y no se deduce ausencia.
export function evaluarPresentismo(
  r: RegistroPresentismoCampo,
  ahora = new Date(),
): EstadoPresentismo {
  const fecha =
    typeof r.fecha === 'string'
      ? r.fecha.slice(0, 10)
      : r.fecha.toISOString().slice(0, 10);
  const zona = r.zonaHoraria ?? ZONA_CAMPO;
  const reloj = relojCampo(ahora, zona);
  const conHorario = !!r.horaDesde && !!r.horaHasta;
  const terminoJornada = conHorario
    ? `${reloj.fecha}T${reloj.hora}` >= `${fecha}T${r.horaHasta}`
    : reloj.fecha > fecha;
  if (!r.entrada) {
    if (!conHorario) return 'SIN_REGISTRO';
    if (r.salida) return 'INCOMPLETO';
    return terminoJornada ? 'AUSENTE' : 'SIN_REGISTRO';
  }
  if (r.salida) return 'PRESENTE';
  return terminoJornada ? 'INCOMPLETO' : 'EN_CURSO';
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

const RUTA_POR_ESTADO: Record<EstadoPresentismo, EstadoRuta> = {
  PRESENTE: 'completado',
  EN_CURSO: 'en_curso',
  INCOMPLETO: 'incompleto',
  AUSENTE: 'ausente',
  SIN_REGISTRO: 'pendiente',
};

export function resumirPresentismo(
  estados: EstadoPresentismo[],
): EstadoPresentismo {
  return (
    (['EN_CURSO', 'INCOMPLETO', 'AUSENTE', 'PRESENTE'] as const).find((e) =>
      estados.includes(e),
    ) ?? 'SIN_REGISTRO'
  );
}

type ArgsAgenda = [
  visitas: VisitaParaEstado[],
  horarios: (ReglaHorario & { id: number; entrada: string; salida: string })[],
  zonaHoraria: string | undefined,
  desde: string,
  hasta: string,
  ahora?: Date,
  asignacion?: { fechaDesde: Date; fechaHasta: Date | null },
];

/** Estado de cada turno del período que no tuvo visita (Sin registro o Ausente). */
function turnosSinVisita(
  ...[
    visitas,
    horarios,
    zonaHoraria,
    desde,
    hasta,
    ahora = new Date(),
    asignacion,
  ]: ArgsAgenda
): EstadoPresentismo[] {
  const estados: EstadoPresentismo[] = [];
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
  return estados;
}

export function estadoAgenda(...args: ArgsAgenda) {
  const [visitas, , , , , ahora = new Date()] = args;
  const marcas = visitas.map((v) => conEstadoVisita(v, ahora));
  const estados = [
    ...marcas.map((v) => v.estadoPresentismo),
    ...turnosSinVisita(...args),
  ];
  const estadoPresentismo = resumirPresentismo(estados);
  // La ruta usa el mismo estado que Presentismo: no hay dos lecturas distintas.
  return { estado: RUTA_POR_ESTADO[estadoPresentismo], estadoPresentismo };
}

/**
 * Turnos vencidos sin visita en el período: en un rango de varios días un
 * local puede estar "Ausente" por días faltados aunque haya tenido visitas.
 */
export function ausenciasAgenda(...args: ArgsAgenda): number {
  return turnosSinVisita(...args).filter((e) => e === 'AUSENTE').length;
}

export function asistenciaCampo(estados: EstadoRuta[]): AsistenciaCampo {
  if (estados.includes('en_curso')) return 'en_curso';
  if (estados.includes('incompleto')) return 'incompleto';
  if (estados.includes('ausente')) return 'ausente';
  return estados.includes('completado') ? 'finalizado' : 'sin_iniciar';
}
