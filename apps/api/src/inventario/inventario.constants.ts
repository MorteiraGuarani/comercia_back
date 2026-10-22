// Página de plataforma que habilita el inventario (menú y autorización).
export const MODULO_INVENTARIO = 'mi-jornada';
export const PAGINA_INVENTARIO = 'inventario';

// Topes de la copia sin conexión (se entrega sin paginar, por pedido explícito
// del usuario, para guardarla en el navegador): si se superan, 413 en vez de truncar.
export const LIMITE_PRODUCTOS_COPIA = 50_000;
export const LIMITE_LOCALES_COPIA = 2_000;

// Días hacia atrás que acepta una carga hecha sin conexión y enviada después.
export const DIAS_CARGA_DIFERIDA = 7;
