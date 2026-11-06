/** Fila de SP_ULTIMAS_4_FACTURAS_CLIENTE. */
export interface FilaFacturaCliente {
  DocEntry: number;
  DocNum: number;
  Fecha: string;
  /** Ya formateado por SAP ("GS 191.780"). */
  MontoTotal: string;
}

/** Fila de SP_DETALLE_FACTURA_CLIENTE. */
export interface FilaDetalleFactura {
  'ID Articulo': string;
  'Nombre Articulo': string;
  'Precio Unitario': string;
  Cantidad: number | string;
  'Precio Total': string;
  Almacen: string;
}

/** Factura del cliente en SAP para el perfil del pedido. */
export interface FacturaCliente {
  docEntry: number;
  docNum: number;
  fecha: string;
  montoTotal: string;
}

export interface LineaFacturaCliente {
  itemCode: string;
  nombre: string;
  cantidad: number;
  precioUnitario: string;
  precioTotal: string;
}
