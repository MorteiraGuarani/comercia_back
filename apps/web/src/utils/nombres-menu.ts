export function etiquetaPaginaMenu(
  moduloRuta: string,
  paginaRuta: string,
  nombre: string,
) {
  if (moduloRuta === "mi-jornada" && paginaRuta === "locales") return "Mi Ruta";
  if (moduloRuta === "mi-jornada" && paginaRuta === "tareas") return "Mis tareas";
  if (moduloRuta === "gestion-campo" && paginaRuta === "locales") return "Itinerario";
  if (moduloRuta === "gestion-campo" && paginaRuta === "visitas") return "Presentismo";
  if (paginaRuta === "novedades") return "Novedades";
  if (paginaRuta === "avisos") return "Avisos";
  return nombre;
}
