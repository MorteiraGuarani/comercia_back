import type { ModuloMenu } from "@/types/plataforma";

export function etiquetaPaginaMenu(
  moduloRuta: string,
  paginaRuta: string,
  nombre: string,
) {
  if (moduloRuta === "mi-jornada" && paginaRuta === "locales") return "Itinerario";
  if (moduloRuta === "mi-jornada" && paginaRuta === "tareas") return "Mis tareas";
  if (moduloRuta === "gestion-campo" && paginaRuta === "locales") return "Itinerario";
  if (moduloRuta === "gestion-campo" && paginaRuta === "visitas") return "Desempeño";
  if (paginaRuta === "novedades") return "Novedades";
  if (paginaRuta === "avisos") return "Avisos";
  return nombre;
}

// Las tareas se hacen desde el modal del local en Itinerario (fotos, comentarios
// y terminar): la página Mis tareas queda deshabilitada para todos.
export function sinMisTareas(modulos: ModuloMenu[]): ModuloMenu[] {
  return modulos.map((m) =>
    m.ruta === "mi-jornada"
      ? { ...m, paginas: m.paginas.filter((p) => p.ruta !== "tareas") }
      : m,
  );
}
