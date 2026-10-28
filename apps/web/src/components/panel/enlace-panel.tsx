import Link from "next/link";
import type { ComponentProps } from "react";

/** Conserva el acceso visible pero sin enlace navegable (sin tareas, o una página que todavía no está). */
export function EnlacePanel({ disabled, motivo = "Sin tareas asignadas", children, className, ...props }: ComponentProps<typeof Link> & { disabled?: boolean; motivo?: string }) {
  if (disabled)
    return (
      <button
        type="button"
        disabled
        aria-disabled="true"
        role={props.role}
        title={motivo}
        className={`${className ?? ""} disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0 disabled:hover:border-line disabled:hover:bg-transparent disabled:hover:text-current`}
      >
        {children}
      </button>
    );
  return <Link {...props} className={className}>{children}</Link>;
}
