import React from "react";
import { TOKENS, type TokenColor } from "../tokens";

interface StatChipProps {
  label: string;
  value: number | string;
  tone?: TokenColor | "fresco" | "alerta" | "frio" | "critico" | "sub" | "ink";
  color?: TokenColor | "fresco" | "alerta" | "frio" | "critico" | "sub" | "ink" | string;
  sub?: string;
  className?: string;
}

export function StatChip({
  label,
  value,
  tone,
  color: colorProp,
  sub,
  className = "",
}: StatChipProps) {
  const chosenTone = tone ?? (colorProp as TokenColor) ?? "ink";
  const color = TOKENS[chosenTone as TokenColor] ?? TOKENS.ink;

  return (
    <div
      className={`min-w-0 flex-1 rounded-lg border border-line bg-surface-raised p-3 text-left sm:p-4 ${className}`}
    >
      <div
        className="ft-body text-xs font-medium leading-snug text-muted"
      >
        {label}
      </div>
      <div
        className="ft-display mt-1.5 text-3xl font-semibold leading-none tabular-nums sm:text-4xl"
        style={{ color }}
      >
        {value}
      </div>
      {sub && (
        <div className="ft-body mt-2 hidden text-xs leading-relaxed text-muted sm:block">
          {sub}
        </div>
      )}
    </div>
  );
}
