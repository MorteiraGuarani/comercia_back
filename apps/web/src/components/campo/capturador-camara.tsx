"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

export function CapturadorCamara({
  onCapturar,
  onCerrar,
}: {
  onCapturar: (archivo: File) => void;
  onCerrar: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const activoRef = useRef(true);
  const dialogoRef = useRef<HTMLDivElement>(null);
  const [lista, setLista] = useState(false);
  const [capturando, setCapturando] = useState(false);
  const [error, setError] = useState(() =>
    typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia
      ? "La cámara del navegador requiere HTTPS y un dispositivo compatible. Podés usar la galería."
      : "",
  );

  useEffect(() => {
    let vigente = true;
    activoRef.current = true;
    const video = videoRef.current;
    const disparador = document.activeElement as HTMLElement | null;
    const scrollAnterior = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialogoRef.current?.focus();

    if (!navigator.mediaDevices?.getUserMedia) {
      return () => {
        activoRef.current = false;
        document.body.style.overflow = scrollAnterior;
        disparador?.focus();
      };
    }

    navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" } }, audio: false })
      .then((stream) => {
        if (!vigente) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        streamRef.current = stream;
        if (video) {
          video.srcObject = stream;
          void video.play().catch(() => {
            if (vigente) setError("No se pudo iniciar la vista previa de la cámara.");
          });
        }
      })
      .catch((problema: unknown) => {
        if (!vigente) return;
        const nombre = problema instanceof DOMException ? problema.name : "";
        setError(nombre === "NotAllowedError"
          ? "Permití el acceso a la cámara en el navegador y volvé a intentarlo."
          : nombre === "NotFoundError"
            ? "No se detectó una cámara en este dispositivo."
            : "No se pudo abrir la cámara. Revisá los permisos o usá la galería.");
      });

    return () => {
      vigente = false;
      activoRef.current = false;
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
      if (video) video.srcObject = null;
      document.body.style.overflow = scrollAnterior;
      disparador?.focus();
    };
  }, []);

  useEffect(() => {
    const alTeclado = (evento: KeyboardEvent) => {
      if (evento.key === "Tab") {
        const botones = dialogoRef.current?.querySelectorAll<HTMLButtonElement>("button:not([disabled])");
        const primero = botones?.[0];
        const ultimo = botones?.[botones.length - 1];
        if (evento.shiftKey && (document.activeElement === primero || document.activeElement === dialogoRef.current)) {
          evento.preventDefault();
          ultimo?.focus();
        } else if (!evento.shiftKey && document.activeElement === ultimo) {
          evento.preventDefault();
          primero?.focus();
        }
      } else if (evento.key === "Escape") {
        evento.preventDefault();
        evento.stopPropagation();
        onCerrar();
      }
    };
    window.addEventListener("keydown", alTeclado, true);
    return () => window.removeEventListener("keydown", alTeclado, true);
  }, [onCerrar]);

  const capturar = () => {
    const video = videoRef.current;
    if (!video?.videoWidth || !video.videoHeight || capturando) return;
    setCapturando(true);
    setError("");
    const escala = Math.min(1, 1920 / Math.max(video.videoWidth, video.videoHeight));
    const lienzo = document.createElement("canvas");
    lienzo.width = Math.round(video.videoWidth * escala);
    lienzo.height = Math.round(video.videoHeight * escala);
    const contexto = lienzo.getContext("2d");
    if (!contexto) {
      setError("No se pudo capturar la foto.");
      setCapturando(false);
      return;
    }
    contexto.drawImage(video, 0, 0, lienzo.width, lienzo.height);
    lienzo.toBlob((blob) => {
      if (!activoRef.current) return;
      setCapturando(false);
      if (!blob) {
        setError("No se pudo guardar la foto de la cámara.");
        return;
      }
      onCapturar(new File([blob], `camara-${Date.now()}.jpg`, { type: "image/jpeg" }));
      onCerrar();
    }, "image/jpeg", 0.84);
  };

  return createPortal(
    <div className="fixed inset-0 z-[5500] grid place-items-center bg-black/85 sm:p-6" role="presentation">
      <div ref={dialogoRef} tabIndex={-1} role="dialog" aria-modal="true" aria-label="Tomar foto" className="flex h-dvh max-h-dvh w-full min-w-0 flex-col overflow-hidden bg-surface-raised text-foreground shadow-2xl outline-none sm:h-[min(90dvh,48rem)] sm:max-h-[calc(100dvh-3rem)] sm:max-w-3xl sm:rounded-2xl sm:border sm:border-line">
        <div className="flex shrink-0 items-center justify-between gap-3 px-4 pb-2 pt-[max(0.5rem,env(safe-area-inset-top))] sm:px-5 sm:pt-3">
          <h2 className="text-base font-semibold">Tomar foto</h2>
          <button type="button" onClick={onCerrar} aria-label="Cerrar cámara" className="grid h-11 w-11 shrink-0 place-items-center rounded-lg text-xl text-foreground hover:bg-surface-soft focus-visible:ring-2 focus-visible:ring-brand-600">×</button>
        </div>
        <div className="relative min-h-0 flex-1 overflow-hidden bg-black sm:mx-5 sm:rounded-xl">
          <video ref={videoRef} autoPlay playsInline muted aria-label="Vista previa de la cámara" onLoadedMetadata={() => setLista(true)} className="h-full w-full object-contain" />
          {!lista && !error && <p role="status" className="absolute inset-0 grid place-items-center text-sm text-white">Abriendo cámara…</p>}
        </div>
        {error && <p role="alert" className="shrink-0 break-words px-4 pt-3 text-sm text-red-700 dark:text-red-300">{error}</p>}
        <div className="grid shrink-0 grid-cols-2 gap-3 px-4 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))] sm:flex sm:justify-end sm:p-5">
          <button type="button" onClick={onCerrar} className="min-h-12 min-w-0 whitespace-nowrap rounded-xl border border-line bg-surface-raised px-4 text-sm font-semibold text-foreground hover:bg-surface-soft focus-visible:ring-2 focus-visible:ring-focus">Cancelar</button>
          <button type="button" onClick={capturar} disabled={!lista || capturando || !!error} className="min-h-12 min-w-0 whitespace-nowrap rounded-xl bg-brand-700 px-4 text-sm font-semibold text-white hover:bg-brand-800 focus-visible:ring-2 focus-visible:ring-focus disabled:cursor-not-allowed disabled:bg-surface-soft disabled:text-foreground disabled:opacity-100 dark:bg-brand-200 dark:text-brand-950 dark:hover:bg-brand-100 dark:disabled:bg-surface-soft dark:disabled:text-foreground">{capturando ? "Guardando…" : "Tomar foto"}</button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
