import type { FormProducto, ProductoAdmin } from "@/types/producto";

export function normalizarPrecio(texto: string): string {
  return texto
    .trim()
    .replace(",", ".")
    .replace(/^(-?)0+(?=\d)/, "$1");
}

// Quita los ceros decimales sobrantes de un precio de la API ("12.500000" → "12.5").
export function recortarPrecio(texto: string): string {
  return texto.includes(".") ? texto.replace(/\.?0+$/, "") : texto;
}

// Formato es-PY (miles con punto, decimales con coma) trabajando sobre el
// texto: pasar por Number pierde precisión con 15 enteros y 6 decimales.
export function formatearPrecio(texto: string): string {
  const [entero, decimales] = recortarPrecio(texto).split(".");
  const miles = entero.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return decimales ? `${miles},${decimales}` : miles;
}
export function formularioProducto(producto: ProductoAdmin): FormProducto {
  return {
    itemcode: producto.itemcode,
    itemname: producto.itemname ?? "",
    iva: producto.iva === null ? "" : String(producto.iva),
    itmsgrpcode: producto.itmsgrpcode === null ? "" : String(producto.itmsgrpcode),
    itmsgrpnam: "",
    inventory: producto.inventory ?? "",
    pricelist: String(producto.pricelist),
    pricelistname: producto.pricelistname ?? "",
    price: producto.price === null ? "" : recortarPrecio(producto.price),
    tipo: producto.tipo ?? "",
  };
}

export function datosProducto(form: FormProducto) {
  return {
    itemcode: form.itemcode.trim(),
    itemname: form.itemname.trim() || null,
    iva: form.iva.trim() === "" ? null : Number(form.iva),
    itmsgrpcode: form.itmsgrpcode.trim() === "" ? null : Number(form.itmsgrpcode),
    itmsgrpnam: null,
    inventory: form.inventory || null,
    pricelist: Number(form.pricelist),
    pricelistname: form.pricelistname || null,
    price: form.price.trim() === "" ? null : normalizarPrecio(form.price),
    tipo: form.tipo || null,
  };
}
