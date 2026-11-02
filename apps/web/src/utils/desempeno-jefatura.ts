import type { ColaboradorResumen, SupervisionResumenData } from "@/types/campo";
import { pct } from "@/utils/hoy-en-campo";

/** Una persona del organigrama del jefe con quienes dependen de ella. */
export interface NodoDesempeno {
  persona: ColaboradorResumen;
  hijos: NodoDesempeno[];
}

/**
 * Cascada del organigrama: supervisores, TeamLeaders y su personal. Arriba
 * queda quien no depende de nadie de la lista (los que dependen del jefe).
 */
export function arbolDesempeno(colaboradores: ColaboradorResumen[]): NodoDesempeno[] {
  const nodos = new Map(
    colaboradores.map((c) => [c.id, { persona: c, hijos: [] as NodoDesempeno[] }]),
  );
  // Un superior en ciclo (A a cargo de B y B de A) no puede esconder a nadie.
  const enCiclo = (id: number) => {
    const vistos = new Set<number>();
    let actual = nodos.get(id)?.persona.superiorId ?? null;
    while (actual !== null && nodos.has(actual) && !vistos.has(actual)) {
      if (actual === id) return true;
      vistos.add(actual);
      actual = nodos.get(actual)?.persona.superiorId ?? null;
    }
    return false;
  };
  const raices: NodoDesempeno[] = [];
  for (const nodo of nodos.values()) {
    const padre =
      nodo.persona.superiorId === null ? undefined : nodos.get(nodo.persona.superiorId);
    (padre && !enCiclo(nodo.persona.id) ? padre.hijos : raices).push(nodo);
  }
  return raices;
}

/** La persona del nodo y todas las que tiene debajo. */
export function personasRama(nodo: NodoDesempeno): ColaboradorResumen[] {
  return [nodo.persona, ...nodo.hijos.flatMap(personasRama)];
}

// Igual que el servidor: TeamLeader por la descripción del rol.
const esTeamLeader = (c: ColaboradorResumen) =>
  ["teamleader", "teamleaderimpulsador"].includes(
    c.zona.toLowerCase().replace(/[^a-z]/g, ""),
  );

/**
 * Los indicadores del resumen sumados solo para una rama, con las mismas
 * cuentas que hace el servidor para todo el organigrama.
 */
export function resumenRama(
  fecha: string,
  nodo: NodoDesempeno,
): SupervisionResumenData {
  const personas = personasRama(nodo);
  const suma = (lista: ColaboradorResumen[], valor: (c: ColaboradorResumen) => number) =>
    lista.reduce((s, c) => s + valor(c), 0);
  const cuenta = (lista: ColaboradorResumen[], estado: ColaboradorResumen["asistencia"]) =>
    lista.filter((c) => c.asistencia === estado).length;
  const estados = { PRESENTE: 0, EN_CURSO: 0, INCOMPLETO: 0, AUSENTE: 0, SIN_REGISTRO: 0 };
  for (const c of personas) estados[c.estadoPresentismo]++;
  const rutas = {
    total: suma(personas, (c) => c.ruta.total),
    completadas: suma(personas, (c) => c.ruta.completadas),
    enCurso: suma(personas, (c) => c.ruta.enCurso),
    incompletas: suma(personas, (c) => c.ruta.incompletas),
    ausentes: suma(personas, (c) => c.ruta.ausentes),
  };
  const tareas = {
    total: suma(personas, (c) => c.tareas.total),
    completadas: suma(personas, (c) => c.tareas.completadas),
    obligatoriasPendientes: suma(personas, (c) => c.tareas.obligPendientes),
  };
  const lideres = nodo.hijos.map((h) => h.persona).filter(esTeamLeader);
  const visitasLideres = {
    completadas: suma(lideres, (c) => c.ruta.completadas),
    totales: suma(lideres, (c) => c.ruta.total),
  };
  const enRuta = cuenta(personas, "en_curso");
  const finalizados = cuenta(personas, "finalizado");
  const incompletos = cuenta(personas, "incompleto");
  const ausentes = cuenta(personas, "ausente");
  return {
    fecha,
    liderazgo: {
      totalTeamLeaders: lideres.length,
      enRuta: cuenta(lideres, "en_curso"),
      finalizados: cuenta(lideres, "finalizado"),
      incompletos: cuenta(lideres, "incompleto"),
      ausentes: cuenta(lideres, "ausente"),
      sinIniciar: cuenta(lideres, "sin_iniciar"),
      visitasCompletadas: visitasLideres.completadas,
      visitasTotales: visitasLideres.totales,
      pctVisitas: pct(visitasLideres.completadas, visitasLideres.totales),
    },
    presentismo: {
      enRuta,
      finalizados,
      incompletos,
      ausentes,
      sinIniciar: personas.length - enRuta - finalizados - incompletos - ausentes,
      estados,
      totalEquipo: personas.length,
    },
    rutas: {
      ...rutas,
      pendientes: Math.max(
        0,
        rutas.total - rutas.completadas - rutas.enCurso - rutas.incompletas - rutas.ausentes,
      ),
      pct: pct(rutas.completadas, rutas.total),
    },
    tareas: { ...tareas, pct: pct(tareas.completadas, tareas.total) },
    colaboradores: personas,
  };
}
