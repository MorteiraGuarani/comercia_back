import { useState } from "react";

/**
 * Lista larga en tandas: muestra las primeras `tanda` y crece de a `tanda`.
 * Para volver al inicio al cambiar de filtro, montar la lista con `key` del filtro.
 */
export function usePorTandas<T>(items: T[], tanda = 5) {
  const [cantidad, setCantidad] = useState(tanda);
  return {
    visibles: items.slice(0, cantidad),
    restantes: Math.max(0, items.length - cantidad),
    expandida: cantidad > tanda,
    verMas: () => setCantidad((c) => c + tanda),
    ocultar: () => setCantidad(tanda),
  };
}
