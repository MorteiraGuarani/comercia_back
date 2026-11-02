import type {
  ColaboradorResumen,
  PersonaEstructura,
  SupervisionResumenData,
} from "@/types/campo";
import { pct } from "@/utils/hoy-en-campo";

/** Una persona del organigrama del jefe con quienes dependen de ella. */
export interface NodoDesempeno {
  persona: ColaboradorResumen;
  hijos: NodoDesempeno[];
  /** Mando intermedio sin trabajo de campo (jefe, gerente): no suma a los números. */
  estructural?: boolean;
}

// Un mando no trabaja en campo: sus números quedan en cero y no se cuentan.
const comoColaborador = (p: PersonaEstructura): ColaboradorResumen => ({
  ...p,
  telefono: "",
  asistencia: "sin_iniciar",
  estadoPresentismo: "SIN_REGISTRO",
  inicioJornada: null,
  finJornada: null,
  ruta: { total: 0, completadas: 0, enCurso: 0, incompletas: 0, ausentes: 0, pct: 0 },
  tareas: { total: 0, completadas: 0, obligPendientes: 0, pct: 0 },
  novedadesCount: 0,
});

/**
 * Cascada del organigrama: gerentes, jefes, supervisores, TeamLeaders y su
 * personal. Arriba queda quien no depende de nadie de la lista (los que
 * dependen de quien consulta). Un mando sin personal de campo debajo no se muestra.
 */
export function arbolDesempeno(
  colaboradores: ColaboradorResumen[],
  estructura: PersonaEstructura[] = [],
): NodoDesempeno[] {
  const nodos = new Map<number, NodoDesempeno>(
    colaboradores.map((c) => [c.id, { persona: c, hijos: [] }]),
  );
  for (const p of estructura)
    if (!nodos.has(p.id))
      nodos.set(p.id, { persona: comoColaborador(p), hijos: [], estructural: true });
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
  const conCampo = (nodo: NodoDesempeno): NodoDesempeno | null => {
    const hijos = nodo.hijos.map(conCampo).filter((n): n is NodoDesempeno => n !== null);
    return nodo.estructural && !hijos.length ? null : { ...nodo, hijos };
  };
  return raices.map(conCampo).filter((n): n is NodoDesempeno => n !== null);
}

/** La gente de campo del nodo y de todo lo que tiene debajo (sin los mandos). */
export function personasRama(nodo: NodoDesempeno): ColaboradorResumen[] {
  return [...(nodo.estructural ? [] : [nodo.persona]), ...nodo.hijos.flatMap(personasRama)];
}

/** Gente de campo que depende de la persona, sin contarla a ella. */
export function aCargo(nodo: NodoDesempeno): number {
  return personasRama(nodo).filter((p) => p.id !== nodo.persona.id).length;
}

/** Quienes tienen gente a cargo, en el orden de la cascada y con su nivel. */
export function responsablesCascada(
  nodos: NodoDesempeno[],
  nivel = 0,
): { nodo: NodoDesempeno; nivel: number }[] {
  return nodos
    .filter((n) => n.hijos.length)
    .flatMap((n) => [{ nodo: n, nivel }, ...responsablesCascada(n.hijos, nivel + 1)]);
}

/** Ids desde la raíz hasta la persona; vacío si ya no está en el organigrama. */
export function caminoHasta(nodos: NodoDesempeno[], id: number): number[] {
  for (const n of nodos) {
    if (n.persona.id === id) return [id];
    const resto = caminoHasta(n.hijos, id);
    if (resto.length) return [n.persona.id, ...resto];
  }
  return [];
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
  const lideres = nodo.hijos
    .filter((h) => !h.estructural)
    .map((h) => h.persona)
    .filter(esTeamLeader);
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
