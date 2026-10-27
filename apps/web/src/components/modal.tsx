"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useDestinoPortal } from "@/hooks/use-destino-portal";
import { useHojaDeslizable } from "@/hooks/use-hoja-deslizable";

// Las hojas móviles también se minimizan desde el fondo o arrastrando su cabecera.
// Usan el mismo cierre que la X para conservar las confirmaciones del formulario.
export function Modal({
  titulo,
  abierto,
  onCerrar,
  children,
  encabezado,
  pie,
  ancho = "md",
  hojaMovil = false,
}: {
  titulo: string;
  abierto: boolean;
  onCerrar: () => void;
  children: ReactNode;
  /** Controles compactos en lugar del título visible; el título sigue siendo accesible. */
  encabezado?: ReactNode;
  pie?: ReactNode;
  // "lg"/"xl" para formularios anchos; "md" es el default historico
  ancho?: "md" | "lg" | "xl";
  // En celular se abre como hoja que sube desde abajo y queda pegada al borde.
  // Desde `sm` se ve centrado como cualquier modal.
  hojaMovil?: boolean;
}) {
  // El portal sale de las capas de la cabecera, mapas y navegación inferior.
  // El snapshot del servidor mantiene el primer render de hidratación vacío.
  const destinoPortal = useDestinoPortal();
  const capaRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const fondoRef = useRef<HTMLDivElement>(null);
  const disparadorRef = useRef<HTMLElement | null>(null);
  const onCerrarRef = useRef(onCerrar);
  const anchoClase =
    ancho === "xl" ? "max-w-5xl" : ancho === "lg" ? "max-w-2xl" : "max-w-md";
  const hoja = useHojaDeslizable({ abierto, habilitada: hojaMovil, panelRef, fondoRef, onMinimizar: onCerrar });

  useEffect(() => {
    onCerrarRef.current = onCerrar;
  }, [onCerrar]);

  useEffect(() => {
    if (!abierto || !destinoPortal) {
      return;
    }
    // Foco: entra al modal al abrir, vuelve al disparador al cerrar
    disparadorRef.current = document.activeElement as HTMLElement | null;
    panelRef.current?.focus({ preventScroll: true });
    const overflowAnterior = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function alTeclear(e: KeyboardEvent) {
      if (e.key === "Escape") {
        onCerrarRef.current();
      }
    }
    document.addEventListener("keydown", alTeclear);
    return () => {
      document.removeEventListener("keydown", alTeclear);
      document.body.style.overflow = overflowAnterior;
      disparadorRef.current?.focus?.({ preventScroll: true });
    };
  }, [abierto, destinoPortal]);

  useEffect(() => {
    const viewport = window.visualViewport;
    const capa = capaRef.current;
    if (!abierto || !destinoPortal || !viewport || !capa) return;

    // Safari reduce el viewport visible al abrir el teclado, aunque 100dvh
    // pueda conservar la altura anterior. El diálogo usa el espacio visible.
    const ajustarViewport = () => {
      capa.style.setProperty("--modal-alto", `${viewport.height}px`);
      capa.style.setProperty("--modal-top", `${viewport.offsetTop}px`);
    };
    ajustarViewport();
    viewport.addEventListener("resize", ajustarViewport);
    viewport.addEventListener("scroll", ajustarViewport);
    return () => {
      viewport.removeEventListener("resize", ajustarViewport);
      viewport.removeEventListener("scroll", ajustarViewport);
    };
  }, [abierto, destinoPortal]);

  if (!destinoPortal || !abierto) return null;

  return createPortal(
    <div
      ref={capaRef}
      className={`campo-screen fixed inset-x-0 top-[var(--modal-top,0px)] z-[2000] flex h-[var(--modal-alto,100dvh)] min-w-0 justify-center pt-[max(1rem,env(safe-area-inset-top))] ${
        hojaMovil
          ? "items-end sm:items-center sm:pb-[max(1rem,env(safe-area-inset-bottom))] sm:pl-[max(1rem,env(safe-area-inset-left))] sm:pr-[max(1rem,env(safe-area-inset-right))]"
          : "items-center pb-[max(1rem,env(safe-area-inset-bottom))] pl-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))]"
      }`}
    >
      {/* Solo las hojas móviles responden al toque exterior. */}
      <div
        ref={fondoRef}
        aria-hidden
        onClick={hoja.minimizar}
        className="absolute inset-0 bg-[#0d1f19]/78"
      />
      <div
        ref={panelRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={titulo}
        className={`relative flex min-h-0 min-w-0 w-full ${anchoClase} flex-col overflow-hidden border border-line bg-surface-raised p-4 text-foreground shadow-[0_28px_80px_rgba(0,0,0,0.3)] outline-none sm:max-h-full sm:rounded-[1.4rem] sm:p-6 dark:border-line dark:bg-surface-raised dark:text-foreground ${
          hojaMovil
            ? "max-h-[88%] rounded-t-[1.4rem] border-b-0 pb-[max(1rem,env(safe-area-inset-bottom))] pt-2 max-sm:motion-safe:animate-hoja-subir sm:border-b"
            : "max-h-full rounded-[1.4rem]"
        }`}
      >
        <div
          {...hoja.arrastre}
          className={`shrink-0 ${hojaMovil ? "max-sm:touch-none max-sm:select-none max-sm:cursor-grab max-sm:active:cursor-grabbing" : ""}`}
        >
          {hojaMovil ? (
            <div aria-hidden className="mx-auto mb-1 h-1.5 w-10 shrink-0 rounded-full bg-line sm:hidden" />
          ) : null}
          <header className="flex shrink-0 items-start justify-between gap-2 sm:gap-4">
            <h2 className={encabezado ? "sr-only" : `min-w-0 flex-1 break-words font-extrabold tracking-[-0.025em] ${hojaMovil ? "self-center text-base sm:text-lg" : "text-lg"}`}>
              {titulo}
            </h2>
            {encabezado ? (
              <div className="min-w-0 flex-1 self-center">{encabezado}</div>
            ) : null}
            <button
              type="button"
              onClick={onCerrar}
              aria-label="Cerrar"
              className="grid h-11 w-11 shrink-0 cursor-pointer place-items-center rounded-xl text-muted transition-colors hover:bg-surface-soft hover:text-foreground active:bg-surface-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600/40 dark:text-muted dark:hover:bg-surface-soft dark:hover:text-foreground dark:active:bg-surface-soft"
            >
              <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5" aria-hidden>
                <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
              </svg>
            </button>
          </header>
        </div>
        <div className={`${hojaMovil ? "mt-2 sm:mt-4" : "mt-4"} min-h-0 min-w-0 w-full overflow-y-auto overscroll-contain`}>{children}</div>
        {pie ? <footer className="mt-3 shrink-0 border-t border-line dark:border-line">{pie}</footer> : null}
      </div>
    </div>,
    destinoPortal,
  );
}
