import React from "react";

export interface TabItem<T extends string = string> {
  key: T;
  label: string;
  icon?: React.ComponentType<{ size?: number; color?: string; className?: string }>;
  count?: number;
}

interface SegTabsProps<T extends string = string> {
  tabs: TabItem<T>[];
  active: T;
  onChange: (key: T) => void;
  className?: string;
}

export function SegTabs<T extends string = string>({
  tabs,
  active,
  onChange,
  className = "",
}: SegTabsProps<T>) {
  return (
    <div role="group" aria-label="Secciones" className={`flex min-w-0 gap-1 border-b border-line ${className}`}>
      {tabs.map((tab) => {
        const isActive = active === tab.key;
        const Icon = tab.icon;

        return (
          <button
            key={tab.key}
            type="button"
            aria-pressed={isActive}
            onClick={() => onChange(tab.key)}
            className={`ft-body flex min-h-11 min-w-0 flex-1 items-center justify-center gap-2 border-b-2 px-2 py-2 text-sm font-medium whitespace-nowrap transition-colors hover:bg-surface-soft ${isActive ? "border-accent-ink text-foreground" : "border-transparent text-muted"}`}
          >
            {Icon && <span aria-hidden="true"><Icon size={16} color="currentColor" /></span>}
            <span>
              {tab.label} {tab.count !== undefined ? `(${tab.count})` : ""}
            </span>
          </button>
        );
      })}
    </div>
  );
}
