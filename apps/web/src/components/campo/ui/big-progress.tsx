import React from "react";
import { TOKENS } from "../tokens";

interface BigProgressProps {
  pct: number;
  color?: string;
  className?: string;
  label?: string;
}

export function BigProgress({
  pct,
  color = TOKENS.frio,
  className = "",
  label = "Avance",
}: BigProgressProps) {
  const safePct = Math.max(0, Math.min(100, isNaN(pct) ? 0 : pct));

  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={safePct}
      className={`w-full h-1.5 rounded-full overflow-hidden ${className}`}
      style={{
        background: TOKENS.line,
      }}
    >
      <div
        className="h-full rounded-full"
        style={{
          width: `${safePct}%`,
          background: color,
        }}
      />
    </div>
  );
}
