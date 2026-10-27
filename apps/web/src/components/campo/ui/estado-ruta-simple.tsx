import type { EstadoRuta } from "@/types/estado-jornada";
import { RUTA } from "@/utils/estado-jornada";

const COLOR: Record<EstadoRuta, string> = {
  pendiente: "bg-stone-500 dark:bg-stone-400",
  en_curso: "bg-sky-600 dark:bg-sky-400",
  completado: "bg-emerald-600 dark:bg-emerald-400",
  incompleto: "bg-amber-600 dark:bg-amber-400",
  ausente: "bg-red-600 dark:bg-red-400",
};

export function EstadoRutaSimple({ estado }: { estado: EstadoRuta }) {
  return (
    <span className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap text-xs font-medium text-foreground">
      <span
        aria-hidden="true"
        className={`h-2 w-2 shrink-0 rounded-full ${COLOR[estado]}`}
      />
      {RUTA[estado].etiqueta}
    </span>
  );
}
