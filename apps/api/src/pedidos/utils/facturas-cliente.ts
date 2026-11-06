import type {
  FacturaCliente,
  FilaDetalleFactura,
  FilaFacturaCliente,
  LineaFacturaCliente,
} from '../interfaces/factura-cliente.interface';

export function aFacturaCliente(f: FilaFacturaCliente): FacturaCliente {
  return {
    docEntry: Number(f.DocEntry),
    docNum: Number(f.DocNum),
    fecha: String(f.Fecha ?? ''),
    montoTotal: String(f.MontoTotal ?? ''),
  };
}

export function aLineaFactura(f: FilaDetalleFactura): LineaFacturaCliente {
  return {
    itemCode: String(f['ID Articulo'] ?? ''),
    nombre:
      String(f['Nombre Articulo'] ?? '').trim() ||
      String(f['ID Articulo'] ?? ''),
    cantidad: Number(f.Cantidad) || 0,
    precioUnitario: String(f['Precio Unitario'] ?? ''),
    precioTotal: String(f['Precio Total'] ?? ''),
  };
}
