"use client";

// Recarga completa de la pantalla que se pidió: sin señal, una navegación
// interna de Next fallaría sin mostrar nada.
export function BotonReintentar() {
  return (
    <button
      type="button"
      onClick={() => window.location.reload()}
      className="inline-flex min-h-11 cursor-pointer items-center rounded-lg bg-foreground px-5 text-sm font-semibold text-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
    >
      Reintentar
    </button>
  );
}
