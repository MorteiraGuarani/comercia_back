"use client";

import { useEffect, useRef, useState } from "react";

const UMBRAL = 160;

function desplazamientoDe(objetivo: EventTarget | null): {
  y: number;
  nodo: HTMLElement | Window | null;
} {
  if (
    objetivo === document ||
    objetivo === document.documentElement ||
    objetivo === document.body
  ) {
    return {
      y: window.scrollY || document.documentElement.scrollTop,
      nodo: window,
    };
  }
  if (objetivo instanceof HTMLElement) {
    return { y: objetivo.scrollTop, nodo: objetivo };
  }
  return { y: 0, nodo: null };
}

export function BotonSubir() {
  const [visible, setVisible] = useState(false);
  const visibleRef = useRef(false);
  const destino = useRef<HTMLElement | Window>(window);

  useEffect(() => {
    function onScroll(evento: Event) {
      const { y, nodo } = desplazamientoDe(evento.target);
      if (!nodo) return;
      const mostrar = y > UMBRAL;
      if (mostrar) destino.current = nodo;
      if (mostrar === visibleRef.current) return;
      visibleRef.current = mostrar;
      setVisible(mostrar);
    }
    document.addEventListener("scroll", onScroll, { capture: true, passive: true });
    return () => document.removeEventListener("scroll", onScroll, true);
  }, []);

  if (!visible) return null;

  return (
    <button
      type="button"
      aria-label="Volver al inicio de la lista"
      title="Volver arriba"
      onClick={() => {
        const nodo = destino.current;
        if (nodo === window) {
          window.scrollTo({ top: 0, behavior: "smooth" });
          return;
        }
        (nodo as HTMLElement).scrollTo({ top: 0, behavior: "smooth" });
      }}
      className="fixed z-30 grid h-12 w-12 place-items-center rounded-full bg-[#1E2320] text-white shadow-[0_10px_22px_rgba(13,31,25,0.28)] transition hover:bg-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600/50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white right-3 bottom-[calc(4.75rem+env(safe-area-inset-bottom))] lg:right-6 lg:bottom-6"
    >
      <svg
        viewBox="0 0 20 20"
        fill="currentColor"
        className="h-5 w-5"
        aria-hidden
      >
        <path
          fillRule="evenodd"
          d="M10 3.25a.75.75 0 01.53.22l5 5a.75.75 0 11-1.06 1.06L10.75 5.81V16a.75.75 0 01-1.5 0V5.81L5.53 9.53a.75.75 0 01-1.06-1.06l5-5a.75.75 0 01.53-.22z"
          clipRule="evenodd"
        />
      </svg>
    </button>
  );
}
