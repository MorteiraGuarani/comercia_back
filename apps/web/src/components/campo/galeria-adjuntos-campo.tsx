import { obtenerUrlAdjuntoCampo } from "@/lib/api-adjuntos-campo";
import type { AdjuntoCampoItem } from "@/types/campo";

export function GaleriaAdjuntosCampo({
  adjuntos,
}: {
  adjuntos?: AdjuntoCampoItem[];
}) {
  if (!adjuntos?.length) return null;

  return (
    <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
      {adjuntos.map((adjunto) => (
        <a
          key={adjunto.id}
          href={obtenerUrlAdjuntoCampo(adjunto.id)}
          target="_blank"
          rel="noreferrer"
          className="group block overflow-hidden rounded-lg border border-line bg-surface-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600/40"
          title={`Abrir ${adjunto.nombreOriginal}`}
        >
          {/* El endpoint exige la cookie de sesión, por eso se sirve sin optimización de Next. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={obtenerUrlAdjuntoCampo(adjunto.id)}
            alt={`Foto adjunta: ${adjunto.nombreOriginal}`}
            loading="lazy"
            className="h-28 w-full object-cover transition group-hover:scale-[1.02] sm:h-36"
          />
        </a>
      ))}
    </div>
  );
}
