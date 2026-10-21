export const RUTAS_LOTE_TABLAS_PRODUCTOS = [
  'tbl_oitm',
  'tbl_itm1',
  'tbl_ospp',
  'tbl_spp1',
  'tbl_spp2',
  'precios-especiales',
  'precios-especiales-detalle',
].map((t) => '/api/v1/admin/catalogo/empresas/:empresaId/' + t);
