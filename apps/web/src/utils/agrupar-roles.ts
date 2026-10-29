import type { EquipoCampo, RolAdmin } from "@/types/rol";

export interface FilaRol {
  rol: RolAdmin;
  /** Profundidad dentro del grupo según el rol superior (0 = arriba). */
  nivel: number;
  /** El superior es de otro grupo: se muestra para no perder la relación. */
  superiorFuera: boolean;
}

export interface GrupoRoles {
  clave: string;
  titulo: string;
  /** Para equipos: tipo de trabajo. */
  equipo: EquipoCampo | null;
  /** Para equipos: jefaturas que lo supervisan. */
  supervisadoPor: string[];
  filas: FilaRol[];
}

export interface EmpresaRoles {
  empresa: { id: number; nombre: string };
  grupos: GrupoRoles[];
}

export const esJefatura = (rol: RolAdmin) =>
  rol.gestionaTodosEquipos || rol.equiposGestion.length > 0;

const porNombre = (a: RolAdmin, b: RolAdmin) =>
  a.descripcion.localeCompare(b.descripcion, "es");

/** Ordena como árbol por rol superior; un ciclo no pierde roles. */
function enArbol(roles: RolAdmin[]): FilaRol[] {
  const ids = new Set(roles.map((r) => r.id));
  const hijos = new Map<number, RolAdmin[]>();
  for (const r of roles)
    if (r.padre && ids.has(r.padre.id))
      hijos.set(r.padre.id, [...(hijos.get(r.padre.id) ?? []), r]);
  const filas: FilaRol[] = [];
  const vistos = new Set<number>();
  const visitar = (rol: RolAdmin, nivel: number) => {
    if (vistos.has(rol.id)) return;
    vistos.add(rol.id);
    filas.push({
      rol,
      nivel,
      superiorFuera: nivel === 0 && rol.padre !== null,
    });
    for (const h of (hijos.get(rol.id) ?? []).sort(porNombre))
      visitar(h, nivel + 1);
  };
  for (const r of [...roles].sort(porNombre))
    if (!r.padre || !ids.has(r.padre.id)) visitar(r, 0);
  for (const r of [...roles].sort(porNombre)) visitar(r, 0);
  return filas;
}

/**
 * Empresa → jefaturas, un grupo por equipo operativo y los roles sin equipo.
 * Cada grupo muestra su jerarquía y quién lo supervisa.
 */
export function agruparRoles(roles: RolAdmin[]): EmpresaRoles[] {
  const empresas = new Map<number, RolAdmin[]>();
  for (const r of roles)
    empresas.set(r.empresa.id, [...(empresas.get(r.empresa.id) ?? []), r]);
  return [...empresas.values()]
    .map((delaEmpresa) => {
      const jefaturas = delaEmpresa.filter(esJefatura);
      const equipos = new Map<number, RolAdmin[]>();
      const sinEquipo: RolAdmin[] = [];
      for (const r of delaEmpresa) {
        if (esJefatura(r)) continue;
        if (r.equipoCampo)
          equipos.set(r.equipoCampo.id, [
            ...(equipos.get(r.equipoCampo.id) ?? []),
            r,
          ]);
        else sinEquipo.push(r);
      }
      // Un equipo solo supervisado (sin roles propios todavía) también se ve.
      const equiposConocidos = new Map<number, EquipoCampo>();
      for (const r of delaEmpresa) {
        if (r.equipoCampo)
          equiposConocidos.set(r.equipoCampo.id, r.equipoCampo);
        for (const e of r.equiposGestion) equiposConocidos.set(e.id, e);
      }
      const grupos: GrupoRoles[] = [];
      if (jefaturas.length)
        grupos.push({
          clave: "jefaturas",
          titulo: "Jefaturas y gerencia",
          equipo: null,
          supervisadoPor: [],
          filas: enArbol(jefaturas),
        });
      for (const equipo of [...equiposConocidos.values()].sort((a, b) =>
        a.nombre.localeCompare(b.nombre, "es"),
      ))
        grupos.push({
          clave: `equipo-${equipo.id}`,
          titulo: equipo.nombre,
          equipo,
          supervisadoPor: jefaturas
            .filter(
              (j) =>
                j.gestionaTodosEquipos ||
                j.equiposGestion.some((e) => e.id === equipo.id),
            )
            .map((j) => j.descripcion)
            .sort((a, b) => a.localeCompare(b, "es")),
          filas: enArbol(equipos.get(equipo.id) ?? []),
        });
      if (sinEquipo.length)
        grupos.push({
          clave: "sin-equipo",
          titulo: "Sin equipo operativo",
          equipo: null,
          supervisadoPor: [],
          filas: enArbol(sinEquipo),
        });
      return { empresa: delaEmpresa[0].empresa, grupos };
    })
    .sort((a, b) => a.empresa.nombre.localeCompare(b.empresa.nombre, "es"));
}
