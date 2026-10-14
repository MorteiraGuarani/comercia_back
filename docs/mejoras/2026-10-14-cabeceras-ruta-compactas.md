# Cabeceras compactas de ruta

## Brief

Priorizar el listado de locales para impulsadores y repositores que trabajan
desde el teléfono. Tono operativo: el recorrido es lo principal, los indicadores
orientan y los detalles se consultan cuando hacen falta. Se mantienen Barlow
Condensed, IBM Plex Sans/Mono, los tokens de Comercia, la escala de espacio y
los componentes existentes. Controles táctiles de 44 px, Next.js y Tailwind,
sin nuevas dependencias ni consultas adicionales.

## Cambios

- Impulsador: visita activa, búsqueda y acciones comparten una fila desde `lg`.
  En móvil se distribuyen con controles de 44 px, espacios menores y fecha de
  entrada conservada. Los botones tienen ancho natural en escritorio.
- Los cuatro contadores usan un resumen compartido en una franja. Las jornadas
  incompletas y ausentes se indican cuando hay registros de esos estados.
- Repositor: título y período comparten cabecera. El texto instructivo extenso
  se consulta en la marcación; el listado conserva sus acciones y paginación.
- UCheck: estado breve siempre visible, comprobación manual con botón de
  actualización, y mensaje/última ubicación en un detalle plegado por defecto.
  Se conserva la consulta automática y el feedback de la comprobación manual.

## Revisión por código

1. Jerarquía: se reducen bloques antes de la ruta y textos repetidos.
2. Responsive: cuatro columnas compactas en móvil; controles de ruta se adaptan
   sin forzar todos en una fila estrecha. Búsqueda ocupa su ancho en teléfono.
3. Accesibilidad: etiquetas de búsqueda y botones, foco visible, aviso de estado
   y detalle con `aria-expanded`/`aria-controls`.
4. Claro/oscuro: los componentes compactos usan el ámbito `campo-screen` para
   heredar los colores de estado adecuados a cada tema.
5. Verificación visual pendiente por preferencia del usuario. Validación con
   TypeScript y ESLint puntuales, sin abrir navegador.
