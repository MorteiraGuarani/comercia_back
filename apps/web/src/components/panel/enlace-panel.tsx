import Link from "next/link";
import type { ComponentProps } from "react";

/** Conserva el acceso visible cuando no hay tareas, sin enlace navegable. */
export function EnlacePanel({ disabled, children, className, ...props }: ComponentProps<typeof Link> & { disabled?: boolean }) {
  if (disabled)
    return (
      <button
        type="button"
        disabled
        aria-disabled="true"
        role={props.role}
        title="Sin tareas asignadas"
        className={`${className ?? ""} disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0 disabled:hover:border-line disabled:hover:bg-transparent disabled:hover:text-current`}
      >
        {children}
      </button>
    );
  return <Link {...props} className={className}>{children}</Link>;
}
