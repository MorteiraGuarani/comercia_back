"use client";

import { useState } from "react";

/**
 * Texto largo (nombre o dirección) en una sola línea con "…". Con el mouse
 * encima muestra el texto completo; en el celular se toca para verlo entero.
 */
export function TextoExpandible({
  texto,
  className = "",
}: {
  texto: string;
  className?: string;
}) {
  const [completo, setCompleto] = useState(false);
  return (
    <button
      type="button"
      title={texto}
      aria-expanded={completo}
      onClick={() => setCompleto(!completo)}
      className={`block w-full min-w-0 cursor-pointer rounded text-left decoration-dotted underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus ${completo ? "break-words" : "truncate"} ${className}`}
    >
      {texto}
    </button>
  );
}
