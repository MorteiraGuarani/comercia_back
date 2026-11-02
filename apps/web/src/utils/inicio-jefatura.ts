import type { ModuloMenu } from "@/types/plataforma";

/** El Inicio del jefe o gerente (Jefatura · Desempeño) reemplaza al resto. */
export function esInicioJefatura(esSuperadmin: boolean, modulos: ModuloMenu[]) {
  return (
    !esSuperadmin &&
    modulos.some(
      (m) => m.ruta === "jefatura" && m.paginas.some((p) => p.ruta === "desempeno"),
    )
  );
}
