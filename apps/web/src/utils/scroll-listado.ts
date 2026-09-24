/** Vuelve al inicio del listado que contiene el control de paginación. */
export function volverAlInicioDelListado(origen: HTMLElement): void {
  const listado = origen.closest<HTMLElement>("[data-inicio-listado]");
  if (!listado) return;

  const destino = listado.querySelector<HTMLElement>("[data-ancla-listado]") ?? listado;
  destino.scrollIntoView({
    behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
      ? "auto"
      : "smooth",
    block: "start",
  });
}
