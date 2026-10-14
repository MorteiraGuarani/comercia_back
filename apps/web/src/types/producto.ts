export interface EmpresaCatalogo {
  id: number;
  nombre: string;
}
export interface ProductoAdmin {
  cardCode: string;
  descripcion: string;
  iva: number;
  grupo: number;
  nombreGrupo: string;
  inventario: boolean;
  tipo: string;
  _count: { precios: number };
}
export interface PrecioAdmin {
  id: number;
  cardCode: string;
  nroListaPrecio: number;
  listaPrecio: string;
  precio: string;
  producto: { descripcion: string };
}
export type RegistroCatalogo = ProductoAdmin | PrecioAdmin;
export interface FormProducto {
  cardCode: string;
  descripcion: string;
  iva: string;
  grupo: string;
  nombreGrupo: string;
  inventario: boolean;
  tipo: string;
}
export interface FormPrecio {
  cardCode: string;
  nroListaPrecio: string;
  listaPrecio: string;
  precio: string;
}
