// Lista estática compartida por el registro de tablas y la política HTTP de bulk.
export const NOMBRES_TABLAS_SOCIOS = [
  'tbl_ocrd',
  'tbl_crd1',
  'tbl_jcanal',
  'tbl_jcanales',
  'tbl_jsubcanal',
  'tbl_jsubcanales',
  'tbl_oagp',
  'tbl_oslp',
  'tbl_ocrg',
  'tbl_octg',
  'tbl_opln',
] as const;

export const RUTAS_LOTE_SOCIOS = NOMBRES_TABLAS_SOCIOS.map(
  (tabla) => `/api/v1/admin/socios-negocio/empresas/:empresaId/${tabla}`,
);
