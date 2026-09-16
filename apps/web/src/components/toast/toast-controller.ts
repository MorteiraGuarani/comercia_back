import type { TipoToast, ToastEntrada } from "@/types/toast";

type ToastListener = (toast: ToastEntrada) => void;
const listeners = new Set<ToastListener>();

export function registrarListenerToast(listener: ToastListener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function mostrarToast(
  tipo: TipoToast | string,
  mensaje: string,
  titulo?: string,
) {
  const t: TipoToast =
    tipo === "exito" || tipo === "error" || tipo === "alerta" || tipo === "info"
      ? tipo
      : "info";
  listeners.forEach((listener) => listener({ tipo: t, mensaje, titulo }));
}
