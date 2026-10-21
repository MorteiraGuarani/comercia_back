import type { DatosProductoDto } from '../dto/catalogo.dto';
export function datosMaestroLegacy(d: DatosProductoDto) {
  return {
    itemcode: d.itemcode,
    itemname: d.itemname,
    iva: d.iva,
    itmsgrpcode: d.itmsgrpcode,
    inventory: d.inventory,
    tipo: d.tipo,
  };
}
