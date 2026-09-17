import React from "react";
import { TOKENS } from "../tokens";

interface TopBarProps {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  right?: React.ReactNode;
  className?: string;
}

export function TopBar({
  title,
  subtitle,
  onBack,
  right,
  className = "",
}: TopBarProps) {
  return (
    <div
      className={`flex flex-col sm:flex-row sm:items-center justify-between px-5 sm:px-8 py-3.5 sm:py-4 shrink-0 gap-3 border-b border-[#33362F] ${className}`}
      style={{
        background: TOKENS.ink,
      }}
    >
      <div className="flex items-center gap-3 min-w-0">
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            className="p-1.5 -ml-1 rounded-full text-white hover:bg-white/10 active:opacity-60 transition cursor-pointer shrink-0"
            aria-label="Volver atrás"
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="19" y1="12" x2="5" y2="12" />
              <polyline points="11 6 5 12 11 18" />
            </svg>
          </button>
        )}
        <div className="min-w-0">
          <h1 className="ft-display text-xl sm:text-2xl font-bold tracking-tight text-white leading-tight">
            {title}
          </h1>
          {subtitle && (
            <p className="ft-body text-xs sm:text-sm text-zinc-300 font-normal mt-0.5 leading-normal max-w-2xl">
              {subtitle}
            </p>
          )}
        </div>
      </div>
      {right && (
        <div className="flex items-center gap-2.5 shrink-0">{right}</div>
      )}
    </div>
  );
}
