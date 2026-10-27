"use client";

import { useCallback, useEffect, useRef, useSyncExternalStore, type HTMLAttributes, type RefObject } from "react";
import type { ArrastreHoja } from "@/types/hoja-deslizable";
import { debeMinimizarHoja } from "@/utils/hoja-deslizable";

const MOVIL = "(max-width: 639px)";
const DURACION_MS = 220;
const esMovil = () => window.matchMedia(MOVIL).matches;
const noEsMovil = () => false;
const sinSuscripcion = () => () => {};
const suscribirMovil = (avisar: () => void) => {
  const media = window.matchMedia(MOVIL);
  media.addEventListener("change", avisar);
  return () => media.removeEventListener("change", avisar);
};

/** Arrastre directo sobre el DOM: los formularios no se renderizan con cada movimiento. */
export function useHojaDeslizable({
  abierto,
  habilitada = true,
  panelRef,
  fondoRef,
  onMinimizar,
}: {
  abierto: boolean;
  habilitada?: boolean;
  panelRef: RefObject<HTMLElement | null>;
  fondoRef: RefObject<HTMLElement | null>;
  onMinimizar: () => void;
}) {
  const activa = useSyncExternalStore(habilitada ? suscribirMovil : sinSuscripcion, habilitada ? esMovil : noEsMovil, noEsMovil);
  const gesto = useRef<ArrastreHoja | null>(null);
  const cerrando = useRef(false);
  const ignorarClick = useRef(false);
  const temporizador = useRef<ReturnType<typeof setTimeout> | null>(null);
  const temporizadorClick = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cerrarRef = useRef(onMinimizar);

  useEffect(() => { cerrarRef.current = onMinimizar; }, [onMinimizar]);

  const restaurar = useCallback(() => {
    for (const propiedad of ["transform", "transition", "will-change", "animation", "pointer-events"])
      panelRef.current?.style.removeProperty(propiedad);
    for (const propiedad of ["opacity", "transition"])
      fondoRef.current?.style.removeProperty(propiedad);
  }, [panelRef, fondoRef]);

  useEffect(() => {
    return () => {
      if (temporizador.current !== null) clearTimeout(temporizador.current);
      if (temporizadorClick.current !== null) clearTimeout(temporizadorClick.current);
      gesto.current = null;
      cerrando.current = false;
      ignorarClick.current = false;
      restaurar();
    };
  }, [abierto, activa, restaurar]);

  const animar = useCallback((desplazamiento: number, opacidad: number) => {
    const duracion = window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : DURACION_MS;
    const panel = panelRef.current;
    const fondo = fondoRef.current;
    if (panel) {
      panel.style.animation = "none";
      panel.style.transition = `transform ${duracion}ms ease-out`;
      panel.style.transform = `translate3d(0, ${desplazamiento}px, 0)`;
    }
    if (fondo) {
      fondo.style.transition = `opacity ${duracion}ms ease-out`;
      fondo.style.opacity = String(opacidad);
    }
    return duracion;
  }, [panelRef, fondoRef]);

  const minimizar = useCallback(() => {
    if (!activa || !abierto || cerrando.current || !panelRef.current) return;
    cerrando.current = true;
    gesto.current = null;
    const panel = panelRef.current;
    const duracion = animar(panel.getBoundingClientRect().height + 24, 0);
    panel.style.pointerEvents = "none";
    temporizador.current = setTimeout(() => {
      temporizador.current = null;
      try {
        cerrarRef.current();
      } finally {
        // Si el formulario canceló su cierre, vuelve a quedar visible e intacto.
        cerrando.current = false;
        restaurar();
      }
    }, duracion);
  }, [abierto, activa, animar, panelRef, restaurar]);

  const arrastre: HTMLAttributes<HTMLElement> = {
    onPointerDown(evento) {
      if (!activa || !abierto || cerrando.current || gesto.current || evento.button !== 0 || evento.isPrimary === false) return;
      // La cabecera puede contener pestañas y botones: siguen funcionando al tocar.
      if ((evento.target as Element).closest("button, a, input, select, textarea, [role='button'], [role='tab'], [contenteditable='true']")) return;
      const panel = panelRef.current;
      if (!panel) return;
      evento.preventDefault();
      evento.currentTarget.setPointerCapture(evento.pointerId);
      gesto.current = {
        pointerId: evento.pointerId, inicioY: evento.clientY,
        ultimoY: evento.clientY, ultimoTiempo: evento.timeStamp,
        velocidad: 0, alto: panel.getBoundingClientRect().height,
        desplazamiento: 0, recorridoMaximo: 0,
      };
      panel.style.animation = "none";
      panel.style.transition = "none";
      panel.style.willChange = "transform";
      if (fondoRef.current) fondoRef.current.style.transition = "none";
    },
    onPointerMove(evento) {
      const actual = gesto.current;
      if (!actual || actual.pointerId !== evento.pointerId) return;
      evento.preventDefault();
      const intervalo = evento.timeStamp - actual.ultimoTiempo;
      if (intervalo > 0) actual.velocidad = (evento.clientY - actual.ultimoY) / intervalo;
      actual.ultimoY = evento.clientY;
      actual.ultimoTiempo = evento.timeStamp;
      actual.desplazamiento = Math.max(0, Math.min(actual.alto, evento.clientY - actual.inicioY));
      actual.recorridoMaximo = Math.max(actual.recorridoMaximo, actual.desplazamiento);
      if (panelRef.current) panelRef.current.style.transform = `translate3d(0, ${actual.desplazamiento}px, 0)`;
      if (fondoRef.current) fondoRef.current.style.opacity = String(1 - (actual.desplazamiento / Math.max(1, actual.alto)) * 0.65);
    },
    onPointerUp(evento) {
      const actual = gesto.current;
      if (!actual || actual.pointerId !== evento.pointerId) return;
      gesto.current = null;
      if (evento.currentTarget.hasPointerCapture(evento.pointerId)) evento.currentTarget.releasePointerCapture(evento.pointerId);
      ignorarClick.current = actual.recorridoMaximo > 5;
      temporizadorClick.current = setTimeout(() => { ignorarClick.current = false; }, 0);
      const velocidad = evento.timeStamp - actual.ultimoTiempo > 100 ? 0 : actual.velocidad;
      if (debeMinimizarHoja(actual.desplazamiento, actual.alto, velocidad)) minimizar();
      else animar(0, 1);
    },
    onPointerCancel(evento) {
      if (gesto.current?.pointerId !== evento.pointerId) return;
      gesto.current = null;
      animar(0, 1);
    },
    onLostPointerCapture(evento) {
      if (gesto.current?.pointerId !== evento.pointerId) return;
      gesto.current = null;
      animar(0, 1);
    },
    onClickCapture(evento) {
      if (!ignorarClick.current) return;
      evento.preventDefault();
      evento.stopPropagation();
      ignorarClick.current = false;
    },
  };

  return { activa, minimizar, arrastre };
}
