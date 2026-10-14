"use client";

import { useSyncExternalStore } from "react";

const suscribirPortal = () => () => {};

/** Mantiene la hidratación vacía y dibuja overlays fuera de las capas de la página. */
export function useDestinoPortal() {
  return useSyncExternalStore(suscribirPortal, () => document.body, () => null);
}
