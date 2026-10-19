import { colorCartelLocal, inicialesNombre } from "@/utils/foto-local";

/** Logo del cliente; sin logo, sus iniciales sobre un color propio y estable. */
export function LogoCliente({
  nombre,
  logoUrl,
  className = "h-14 w-14",
}: {
  nombre: string;
  logoUrl?: string | null;
  className?: string;
}) {
  if (logoUrl)
    return (
      <span className={`grid shrink-0 place-items-center overflow-hidden rounded-xl border border-line bg-white dark:bg-stone-100 ${className}`}>
        {/* eslint-disable-next-line @next/next/no-img-element -- logo subido por la empresa, sin optimizador de imágenes */}
        <img src={logoUrl} alt={`Logo de ${nombre}`} loading="lazy" decoding="async" className="h-full w-full object-contain p-1" />
      </span>
    );
  return (
    <span
      aria-hidden="true"
      className={`ft-display grid shrink-0 place-items-center rounded-xl text-lg font-bold text-white ${className}`}
      style={{ backgroundColor: colorCartelLocal(nombre) }}
    >
      {inicialesNombre(nombre)}
    </span>
  );
}
