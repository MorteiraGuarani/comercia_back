/** Orden de venta para el Service Layer de SAP B1 (POST /Orders). */
export interface PedidoSap {
  DocDate: string;
  DocDueDate: string;
  CardCode: string;
  /** AddressName2 del almacén (tbl_owhs). */
  NumAtCard: string;
  DocCurrency: string;
  DocRate: number;
  Comments: string;
  JournalMemo: string;
  /** Pendiente de definir. */
  Series: number | null;
  /** Usuario de Comercia. */
  U_beas_pers_id: string;
  /** «C|celular|AAAAMMDDHHMMSS|id de campo_documento». */
  U_beas_version: string;
  /** WarehouseName del almacén (tbl_owhs). */
  U_par: string;
  DocumentLines: {
    LineNum: number;
    ItemCode: string;
    Quantity: number;
    WarehouseCode: string;
  }[];
}

/** Fila de campo_documento: el JSON para SAP y si ya se envió. */
export interface DocumentoSap {
  id: number;
  enviadoSap: boolean;
  /** Número que le asignó SAP. */
  docNum: number | null;
  /** Motivo por el que no llegó a SAP al enviarlo junto con el pedido. */
  errorSap?: string;
  sap: PedidoSap;
}

/** Fila de tbl_owhs que usa el armado de los documentos. */
export interface AlmacenSap {
  WarehouseCode: string;
  WarehouseName: string | null;
  AddressName2: string | null;
  Location: number | null;
  GlobalLocationNumber: string | null;
}

/** Datos SAP del usuario que deciden el almacén de cada producto. */
export interface DatosAlmacenUsuario {
  /** ERP_CanalVenta del usuario (Code de tbl_jcanales). */
  canal: string | null;
  /** ERP_Sucursal del usuario (Code de tbl_oclp). */
  sucursal: number | null;
  /** ERP_CodigoAlmacen del usuario. */
  almacenUsuario: string | null;
  /** Almacenes del usuario y de los productos. */
  almacenes: AlmacenSap[];
}

/** Lo que hace falta para armar los pedidos SAP de una carga. */
export interface DatosPedidoSap extends DatosAlmacenUsuario {
  cardCode: string;
  /** AAAA-MM-DD, en hora de campo. */
  hoy: string;
  /** Día de entrega elegido en el pedido (AAAA-MM-DD). */
  fechaEntrega: string;
  /** HH:MM, en hora de campo. */
  hora: string;
  /** Comentario del usuario; va debajo de «Migrado por Comercia…». */
  observaciones: string;
  /** AAAAMMDDHHMMSS, en hora de campo. */
  sello: string;
  usuarioLogin: string;
  celular: string;
  /** almacen: DfltWH de tbl_oitm. */
  lineas: { itemCode: string; cantidad: number; almacen: string | null }[];
}
