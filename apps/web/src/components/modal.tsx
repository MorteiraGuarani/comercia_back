"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useDestinoPortal } from "@/hooks/use-destino-portal";

// Modal de comercIA — sigue las reglas de apps/web/AGENTS.md:
// se cierra SOLO con la X, con Escape o con el botón Cancelar/Cerrar.
// El clic en el fondo NO cierra (evita perder formularios por accidente).
export function Modal({
  titulo,
  abierto,
  onCerrar,
  children,
  pie,
  ancho = "md",
}: {
  titulo: string;
  abierto: boolean;
  onCerrar: () => void;
  children: ReactNode;
  pie?: ReactNode;
  // "lg"/"xl" para formularios anchos; "md" es el default historico
  ancho?: "md" | "lg" | "xl";
}) {
  // El portal sale de las capas de la cabecera, mapas y navegación inferior.
  // El snapshot del servidor mantiene el primer render de hidratación vacío.
  const destinoPortal = useDestinoPortal();
  const capaRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const disparadorRef = useRef<HTMLElement | null>(null);
  const onCerrarRef = useRef(onCerrar);
  const anchoClase =
    ancho === "xl" ? "max-w-5xl" : ancho === "lg" ? "max-w-2xl" : "max-w-md";

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
      className="campo-screen fixed inset-x-0 top-[var(--modal-top,0px)] z-[2000] flex h-[var(--modal-alto,100dvh)] min-w-0 items-center justify-center pb-[max(1rem,env(safe-area-inset-bottom))] pl-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))] pt-[max(1rem,env(safe-area-inset-top))]"
    >
      {/* Fondo oscurecido: NO cierra el modal a propósito */}
      <div
        aria-hidden
        className="absolute inset-0 bg-[#0d1f19]/78"
      />
      <div
        ref={panelRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={titulo}
        className={`relative flex min-h-0 min-w-0 w-full ${anchoClase} max-h-full flex-col overflow-hidden rounded-[1.4rem] border border-line bg-surface-raised p-4 text-foreground shadow-[0_28px_80px_rgba(0,0,0,0.3)] outline-none sm:p-6 dark:border-line dark:bg-surface-raised dark:text-foreground`}
      >
        <header className="flex shrink-0 items-start justify-between gap-2 sm:gap-4">
          <h2 className="min-w-0 flex-1 break-words text-lg font-extrabold tracking-[-0.025em]">{titulo}</h2>
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
        <div className="mt-4 min-h-0 min-w-0 w-full overflow-y-auto overscroll-contain">{children}</div>
        {pie ? <footer className="mt-3 shrink-0 border-t border-line dark:border-line">{pie}</footer> : null}
      </div>
    </div>,
    destinoPortal,
  );
}
