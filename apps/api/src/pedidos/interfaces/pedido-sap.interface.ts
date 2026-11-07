/** Orden de venta para el Service Layer de SAP B1 (POST /Orders). */
export interface PedidoSap {
  DocDate: string;
  DocDueDate: string;
  CardCode: string;
  /** Pendiente de definir. */
  NumAtCard: string;
  DocCurrency: string;
  DocRate: number;
  Comments: string;
  JournalMemo: string;
  /** Pendiente de definir. */
  Series: number | null;
  /** Usuario de Comercia. */
  U_beas_pers_id: string;
  /** Número del pedido en Comercia: 4 números separados por «|» (por ahora aleatorio). */
  U_beas_version: string;
  /** WarehouseName del usuario (ERP_NombreAlmacen). */
  U_par: string;
  DocumentLines: {
    LineNum: number;
    ItemCode: string;
    Quantity: number;
    WarehouseCode: string;
  }[];
}

/** Lo que hace falta para armar los pedidos SAP de una carga. */
export interface DatosPedidoSap {
  cardCode: string;
  /** AAAA-MM-DD, en hora de campo. */
  hoy: string;
  /** DÃ­a de entrega elegido en el pedido (AAAA-MM-DD). */
  fechaEntrega: string;
  /** HH:MM, en hora de campo. */
  hora: string;
  usuarioLogin: string;
  /** ERP_CanalVenta del usuario (Code de tbl_jcanales). */
  canal: string | null;
  /** ERP_CodigoAlmacen y ERP_NombreAlmacen del usuario. */
  almacenUsuario: string | null;
  nombreAlmacenUsuario: string | null;
  /** tbl_owhs con Location = sucursal y GlobalLocationNumber = canal del usuario. */
  almacenesCanal: string[];
  /** almacen: DfltWH de tbl_oitm. */
  lineas: { itemCode: string; cantidad: number; almacen: string | null }[];
}
