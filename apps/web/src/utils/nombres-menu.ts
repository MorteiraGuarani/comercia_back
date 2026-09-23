export function etiquetaPaginaMenu(
  moduloRuta: string,
  paginaRuta: string,
  nombre: string,
) {
  if (moduloRuta === "mi-jornada" && paginaRuta === "locales") return "Mi Ruta";
  if (moduloRuta === "gestion-campo" && paginaRuta === "locales") return "PDV y rutas";
  if (moduloRuta === "gestion-campo" && paginaRuta === "visitas") return "Presentismo";
  if (paginaRuta === "novedades") return "Novedades";
  if (paginaRuta === "avisos") return "Avisos";
  return nombre;
}

export function rutaInicialImpulsador(
  modulos: Array<{
    ruta: string;
    paginas: Array<{ ruta: string }>;
  }>,
) {
  const miJornada = modulos.find((modulo) => modulo.ruta === "mi-jornada");
  const esLider = modulos.some((modulo) => modulo.ruta === "gestion-campo");
  if (!miJornada || esLider) return null;
  const ruta =
    miJornada.paginas.find((pagina) => pagina.ruta === "locales") ??
    miJornada.paginas[0];
  return ruta ? `/panel/mi-jornada/${ruta.ruta}` : null;
}
