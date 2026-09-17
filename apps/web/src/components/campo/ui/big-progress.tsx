import React from "react";
import { TOKENS } from "../tokens";

interface BigProgressProps {
  pct: number;
  color?: string;
  className?: string;
}

export function BigProgress({
  pct,
  color = TOKENS.frio,
  className = "",
}: BigProgressProps) {
  const safePct = Math.max(0, Math.min(100, isNaN(pct) ? 0 : pct));

  return (
    <div
      className={`w-full h-1.5 rounded-full overflow-hidden ${className}`}
      style={{
        background: TOKENS.line,
      }}
    >
      <div
        className="h-full rounded-full transition-all duration-300"
        style={{
          width: `${safePct}%`,
          background: color,
        }}
      />
    </div>
  );
}
