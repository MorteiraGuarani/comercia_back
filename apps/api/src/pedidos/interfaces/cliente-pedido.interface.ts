import type { CreditoCliente } from './credito-cliente.interface';

/** Cliente de tbl_ocrd en el buscador de pedidos: el id es el CardCode. */
export interface ClientePedido {
  id: string;
  nombre: string;
  /** Sucursal (dirección de CRD1) y CardCode, para distinguir clientes con el mismo nombre. */
  descripcion: string;
}

/** Perfil del cliente (paso 1) con lo que Comercia tiene de OCRD. */
export interface PerfilClientePedido {
  id: string;
  nombre: string;
  direccion: string;
  alias: string;
  ruc: string;
  telefono: string;
  canal: string | null;
  condicionPago: string | null;
  listaPrecios: string | null;
  diasVisita: string[];
  /** false si está inactivo (validFor N) o congelado (frozenFor Y) en SAP: no se le carga pedido. */
  activo: boolean;
  /** Estado en SAP; null si no se pudo consultar. */
  credito: CreditoCliente | null;
}
