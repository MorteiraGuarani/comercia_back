export interface EmpresaCatalogo {
  id: number;
  nombre: string;
}

export interface ProductoAdmin {
  id: string;
  itemcode: string;
  itemname: string | null;
  iva: number | null;
  itmsgrpcode: number | null;
  itmsgrpnam: string | null;
  inventory: string | null;
  pricelist: number;
  pricelistname: string | null;
  price: string | null;
  tipo: string | null;
}

export interface FormProducto {
  itemcode: string;
  itemname: string;
  iva: string;
  itmsgrpcode: string;
  itmsgrpnam: string;
  inventory: string;
  pricelist: string;
  pricelistname: string;
  price: string;
  tipo: string;
}
