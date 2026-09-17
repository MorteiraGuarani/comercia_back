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
      className={`flex-1 rounded-xl py-2.5 px-3 text-center transition-all bg-white shadow-xs ${className}`}
      style={{
        border: `1px solid ${TOKENS.line}`,
      }}
    >
      <div
        className="ft-display text-2xl sm:text-3xl font-bold leading-tight tracking-tight"
        style={{ color }}
      >
        {value}
      </div>
      <div
        className="ft-body text-xs font-semibold text-zinc-700 mt-0.5 truncate uppercase tracking-wider"
      >
        {label}
      </div>
      {sub && (
        <div className="ft-mono text-[11px] text-zinc-500 font-normal mt-0.5 truncate">
          {sub}
        </div>
      )}
    </div>
  );
}
