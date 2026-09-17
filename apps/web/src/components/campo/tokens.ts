/**
 * Sistema de diseño visual editorial para el módulo comercial de Comercia
 * Basado en la maqueta de referencia de supervisión comercial.
 */
export const TOKENS = {
  carne: "#8B2635",    // Borgoña / acción primaria / marcas de supervisión
  frio: "#2C4A6E",     // Azul pizarra / rutas / en curso
  fresco: "#4F7A52",   // Verde bosque / completado / éxito
  alerta: "#C1752B",   // Ámbar / atención / novedades abiertas
  critico: "#A32F2F",  // Rojo alerta / incidencias críticas / sin iniciar
  plum: "#5B4B7A",     // Morado suave / categorías de atención al cliente
  ink: "#1E2320",      // Carbón oscuro / encabezados / avatares / contrastes
  bone: "#ECE9E2",     // Fondo cálido lino / superficie base
  canvas: "#F8F7F4",   // Blanco cálido para tarjetas y modales
  line: "#DAD5C9",     // Bordes finos neutros
  sub: "#726C60",      // Texto secundario y leyendas
} as const;

export type TokenColor = keyof typeof TOKENS;
