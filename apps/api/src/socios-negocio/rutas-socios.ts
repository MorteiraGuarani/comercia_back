// Lista estática compartida por el registro de tablas y la política HTTP de bulk.
export const NOMBRES_TABLAS_SOCIOS = [
  'tbl_ocrd',
  'tbl_crd1',
  'tbl_jcanales',
  'tbl_jsubcanales',
  'tbl_oagp',
  'tbl_oslp',
  'tbl_ocrg',
  'tbl_octg',
  'tbl_opln',
  'tbl_omrc',
  'tbl_oscn',
  'tbl_oitb',
  'tbl_jtiposubcanales',
] as const;

const CATALOGOS_ARTICULOS = new Set<string>([
  'tbl_omrc',
  'tbl_oscn',
  'tbl_oitb',
]);
export const esCatalogoArticulos = (tabla: string) =>
  CATALOGOS_ARTICULOS.has(tabla);

export const RUTAS_LOTE_SOCIOS = NOMBRES_TABLAS_SOCIOS.map(
  (tabla) =>
    `/api/v1/admin/${esCatalogoArticulos(tabla) ? 'catalogo' : 'socios-negocio'}/empresas/:empresaId/${tabla}`,
);
