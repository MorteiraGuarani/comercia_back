import React from "react";
import { TOKENS, type TokenColor } from "../tokens";

interface StatusStampProps {
  children: React.ReactNode;
  tone?: TokenColor | "fresco" | "alerta" | "critico" | "frio" | "ink" | "carne";
  size?: "sm" | "md";
  className?: string;
}

export function StatusStamp({
  children,
  tone = "ink",
  size = "sm",
  className = "",
}: StatusStampProps) {
  const color = TOKENS[tone as TokenColor] ?? TOKENS.ink;

  return (
    <span
      className={`ft-body inline-flex shrink-0 items-center justify-center rounded border whitespace-nowrap font-medium ${
        size === "sm" ? "px-2 py-0.5 text-[11px]" : "px-2.5 py-1 text-xs"
      } ${className}`}
      style={{
        borderColor: `color-mix(in srgb, ${color} 30%, transparent)`,
        background: `color-mix(in srgb, ${color} 8%, transparent)`,
        color: color,
      }}
    >
      {children}
    </span>
  );
}
