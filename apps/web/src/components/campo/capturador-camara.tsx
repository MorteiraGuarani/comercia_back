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
      if (evento.key === "Escape") {
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
    <div className="fixed inset-0 z-[5500] grid place-items-center overflow-y-auto bg-black/85 p-3 sm:p-6" role="presentation">
      <div ref={dialogoRef} tabIndex={-1} role="dialog" aria-modal="true" aria-label="Tomar foto" className="max-h-[calc(100dvh-1.5rem)] w-full max-w-xl min-w-0 overflow-y-auto rounded-2xl border border-line bg-surface-raised p-3 text-foreground shadow-2xl outline-none sm:p-5">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-base font-semibold">Tomar foto</h2>
          <button type="button" onClick={onCerrar} aria-label="Cerrar cámara" className="grid h-11 w-11 shrink-0 place-items-center rounded-lg text-xl text-foreground hover:bg-surface-soft focus-visible:ring-2 focus-visible:ring-brand-600">×</button>
        </div>
        <div className="mt-3 overflow-hidden rounded-xl bg-black">
          <video ref={videoRef} autoPlay playsInline muted onLoadedMetadata={() => setLista(true)} className="aspect-[4/3] max-h-[60dvh] w-full object-contain" />
        </div>
        {error && <p role="alert" className="mt-3 break-words text-sm text-red-700 dark:text-red-300">{error}</p>}
        <div className="mt-4 grid grid-cols-2 gap-2 sm:flex sm:justify-end">
          <button type="button" onClick={onCerrar} className="min-h-11 min-w-0 rounded-lg border border-line bg-surface-raised px-4 text-sm font-semibold text-foreground hover:bg-surface-soft">Cancelar</button>
          <button type="button" onClick={capturar} disabled={!lista || capturando || !!error} className="min-h-11 min-w-0 rounded-lg bg-brand-700 px-4 text-sm font-semibold text-white hover:bg-brand-800 disabled:cursor-not-allowed disabled:bg-surface-soft disabled:text-foreground disabled:opacity-100 dark:bg-brand-200 dark:text-brand-950 dark:hover:bg-brand-100 dark:disabled:bg-surface-soft dark:disabled:text-foreground">{capturando ? "Guardando…" : "Tomar foto"}</button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
