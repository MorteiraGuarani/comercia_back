"use client";

import { useState } from "react";
import { colorCartelLocal, inicialesNombre } from "@/utils/foto-local";

/**
 * Logo del cliente; sin logo, o si la imagen no carga (archivo borrado o que
 * no está en este servidor), sus iniciales sobre un color propio y estable.
 */
export function LogoCliente({
  nombre,
  logoUrl,
  className = "h-14 w-14 rounded-xl",
  claseTexto = "text-lg",
}: {
  nombre: string;
  logoUrl?: string | null;
  /** Tamaño y bordes redondeados del recuadro. */
  className?: string;
  claseTexto?: string;
}) {
  const [logoRoto, setLogoRoto] = useState<string | null>(null);
  if (logoUrl && logoRoto !== logoUrl)
    return (
      <span className={`grid shrink-0 place-items-center overflow-hidden border border-line bg-white dark:bg-stone-100 ${className}`}>
        {/* eslint-disable-next-line @next/next/no-img-element -- logo subido por la empresa, sin optimizador de imágenes */}
        <img
          src={logoUrl}
          alt={`Logo de ${nombre}`}
          loading="lazy"
          decoding="async"
          onError={() => setLogoRoto(logoUrl)}
          className="h-full w-full object-contain p-1"
        />
      </span>
    );
  return (
    <span
      aria-hidden="true"
      className={`ft-display grid shrink-0 place-items-center font-bold text-white ${claseTexto} ${className}`}
      style={{ backgroundColor: colorCartelLocal(nombre) }}
    >
      {inicialesNombre(nombre)}
    </span>
  );
}
