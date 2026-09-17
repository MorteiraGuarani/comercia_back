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
      className={`ft-display inline-flex items-center justify-center border-2 rounded-full whitespace-nowrap select-none ${
        size === "sm" ? "px-2.5 py-0.5 text-[11px]" : "px-3.5 py-1 text-xs"
      } ${className}`}
      style={{
        borderColor: color,
        color: color,
        borderStyle: "dashed",
        transform: "rotate(-3deg)",
        letterSpacing: "0.03em",
        fontWeight: 600,
      }}
    >
      {children}
    </span>
  );
}
