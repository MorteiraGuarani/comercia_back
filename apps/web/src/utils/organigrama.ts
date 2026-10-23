// Reglas puras del organigrama: armado del árbol y textos de estado.
import type {
  AlertaOrganigrama,
  FiltrosOrganigrama,
  NodoOrganigrama,
  PersonaOrganigrama,
} from "@/types/organigrama";

export const ALERTAS_ORGANIGRAMA: Record<AlertaOrganigrama, { titulo: string; detalle: string }> = {
  SIN_ROL: {
    titulo: "Sin rol",
    detalle: "No tiene rol: no ve módulos ni aparece en el Presentismo de nadie.",
  },
  SIN_EQUIPO: {
    titulo: "Rol sin equipo operativo",
    detalle: "Su rol no pertenece a un equipo de campo: no aparece en Presentismo.",
  },
  SUPERIOR_INACTIVO: {
    titulo: "Superior inactivo",
    detalle: "Su superior está dado de baja: nadie lo ve en Presentismo.",
  },
  SUPERIOR_FUERA: {
    titulo: "Superior fuera de la empresa",
    detalle: "Su superior no es un usuario visible de esta empresa.",
  },
  OTRO_EQUIPO: {
    titulo: "Equipo distinto al de su superior",
    detalle: "Su superior es de otro equipo operativo: no lo ve en Presentismo.",
  },
  AISLADO: {
    titulo: "Sin superior ni personas a cargo",
    detalle: "Nadie lo tiene a cargo y no tiene a nadie: su Presentismo queda vacío.",
  },
};

/** Estado de hoy en pocas palabras. */
export function estadoHoy(p: PersonaOrganigrama): { texto: string; tono: "curso" | "marco" | "sin" | "baja" } {
  if (!p.activo) return { texto: "Inactivo", tono: "baja" };
  if (p.hoy.enCurso) return { texto: `En local desde ${p.hoy.entrada}`, tono: "curso" };
  if (p.hoy.entrada) return { texto: `Entrada ${p.hoy.entrada}`, tono: "marco" };
  return { texto: "Sin marcar hoy", tono: "sin" };
}

const orden = (a: NodoOrganigrama, b: NodoOrganigrama) =>
  Number(b.persona.activo) - Number(a.persona.activo) ||
  b.total - a.total ||
  a.persona.nombre.localeCompare(b.persona.nombre, "es");

/**
 * Árbol desde la raíz pedida o, en toda la empresa, desde quienes no tienen un
 * superior visible. Los ciclos (A jefe de B y B de A) se cortan.
 */
export function armarArbol(personas: PersonaOrganigrama[], raizId: number | null): NodoOrganigrama[] {
  const ids = new Set(personas.map((p) => p.id));
  const hijosDe = new Map<number, PersonaOrganigrama[]>();
  for (const p of personas)
    if (p.superiorId !== null && ids.has(p.superiorId))
      hijosDe.set(p.superiorId, [...(hijosDe.get(p.superiorId) ?? []), p]);
  const usados = new Set<number>();
  const nodo = (p: PersonaOrganigrama): NodoOrganigrama => {
    usados.add(p.id);
    const hijos = (hijosDe.get(p.id) ?? []).filter((h) => !usados.has(h.id)).map(nodo).sort(orden);
    return { persona: p, hijos, total: hijos.reduce((n, h) => n + 1 + h.total, 0) };
  };
  const raices = personas.filter((p) =>
    raizId !== null ? p.id === raizId : p.superiorId === null || !ids.has(p.superiorId),
  );
  const arbol = raices.map(nodo);
  // Quien quedó afuera es parte de un ciclo: se muestra como raíz para no perderlo.
  for (const p of personas) if (!usados.has(p.id) && raizId === null) arbol.push(nodo(p));
  return arbol.sort(orden);
}

/** Ids desde la raíz hasta la persona (incluida), para abrir sus ramas. */
export function caminoHasta(personas: PersonaOrganigrama[], id: number): number[] {
  const porId = new Map(personas.map((p) => [p.id, p]));
  const camino: number[] = [];
  for (let p = porId.get(id); p && !camino.includes(p.id); p = p.superiorId === null ? undefined : porId.get(p.superiorId))
    camino.unshift(p.id);
  return camino;
}

export const SIN_FILTROS: FiltrosOrganigrama = { equipo: "", rol: "", hoy: "", alertas: false };

export function cumpleFiltros(p: PersonaOrganigrama, f: FiltrosOrganigrama): boolean {
  const hoy =
    f.hoy === "marco"
      ? p.activo && p.hoy.entrada !== null
      : f.hoy === "curso"
        ? p.activo && p.hoy.enCurso
        : f.hoy === "sin"
          ? p.activo && p.equipo !== null && p.hoy.entrada === null
          : f.hoy === "baja"
            ? !p.activo
            : true;
  return (
    hoy &&
    (!f.equipo || (f.equipo === "-" ? p.equipo === null : p.equipo?.nombre === f.equipo)) &&
    (!f.rol || (p.rol ?? "") === f.rol) &&
    (!f.alertas || p.alertas.length > 0)
  );
}

/** Deja a quien coincide y su línea de mando, marcada como contexto. */
export function filtrarArbol(
  nodos: NodoOrganigrama[],
  coincide: (p: PersonaOrganigrama) => boolean,
): NodoOrganigrama[] {
  return nodos.flatMap((n) => {
    const hijos = filtrarArbol(n.hijos, coincide);
    const propio = coincide(n.persona);
    return propio || hijos.length ? [{ ...n, hijos, contexto: !propio }] : [];
  });
}
