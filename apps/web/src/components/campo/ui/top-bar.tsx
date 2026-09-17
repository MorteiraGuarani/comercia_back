import React from "react";

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
      className={`flex min-w-0 flex-wrap items-start justify-between gap-3 border-b border-line bg-surface-raised px-4 py-3 sm:items-center sm:px-6 sm:py-4 lg:px-8 ${className}`}
    >
      <div className="flex flex-1 items-center gap-3 min-w-[min(100%,12rem)]">
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            className="-ml-2 grid h-11 w-11 shrink-0 place-items-center rounded-md text-foreground transition-colors hover:bg-surface-soft active:bg-surface-soft"
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
              aria-hidden="true"
            >
              <line x1="19" y1="12" x2="5" y2="12" />
              <polyline points="11 6 5 12 11 18" />
            </svg>
          </button>
        )}
        <div className="min-w-0">
          <h1 className="ft-display text-2xl font-semibold leading-tight text-foreground sm:text-3xl">
            {title}
          </h1>
          {subtitle && (
            <p className="ft-body mt-1 hidden max-w-2xl text-sm leading-normal text-muted sm:block">
              {subtitle}
            </p>
          )}
        </div>
      </div>
      {right && (
        <div className="flex min-w-0 flex-wrap items-center gap-2 self-start sm:self-auto">{right}</div>
      )}
    </div>
  );
}
