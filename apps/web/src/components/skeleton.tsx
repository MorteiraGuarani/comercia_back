/**
 * Esqueleto de carga: barras grises que ocupan el lugar de lo que va a llegar
 * (consultas a la API, procedimientos de SAP). Respeta reducir movimiento.
 */
export function Skeleton({ className = "" }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={`rounded-lg bg-surface-soft motion-safe:animate-pulse ${className}`}
    />
  );
}

/** Filas de una lista mientras carga: título y detalle, como el contenido real. */
export function SkeletonFilas({
  etiqueta,
  filas = 3,
  className = "",
}: {
  /** Lo que se está cargando, para lectores de pantalla (ej. «Cargando clientes»). */
  etiqueta: string;
  filas?: number;
  className?: string;
}) {
  return (
    <div role="status" className={`space-y-3 ${className}`}>
      <span className="sr-only">{etiqueta}</span>
      {Array.from({ length: filas }, (_, i) => (
        <div key={i} className="space-y-2">
          <Skeleton className={`h-4 ${i % 2 ? "w-2/3" : "w-3/4"}`} />
          <Skeleton className="h-3 w-1/3" />
        </div>
      ))}
    </div>
  );
}
