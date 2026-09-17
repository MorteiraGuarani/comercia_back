import React from "react";

export interface NavItem<T extends string = string> {
  key: T;
  label: string;
  icon: React.ComponentType<{ size?: number; color?: string; className?: string }>;
  badge?: number;
}

interface BottomNavProps<T extends string = string> {
  items: NavItem<T>[];
  active: T;
  onChange: (key: T) => void;
  className?: string;
}

export function BottomNav<T extends string = string>({
  items,
  active,
  onChange,
  className = "",
}: BottomNavProps<T>) {
  return (
    <nav
      aria-label="Secciones de supervisión"
      className={`flex w-full min-w-0 shrink-0 items-stretch border-t border-line bg-surface-raised pb-[env(safe-area-inset-bottom)] ${className}`}
    >
      {items.map((it) => {
        const isActive = active === it.key;
        const Icon = it.icon;

        return (
          <button
            key={it.key}
            type="button"
            aria-pressed={isActive}
            onClick={() => onChange(it.key)}
            className={`relative flex min-h-14 min-w-0 flex-1 flex-col items-center justify-center gap-1 border-t-2 px-1 py-2 text-xs whitespace-nowrap transition-colors hover:bg-surface-soft ${isActive ? "border-accent-ink text-accent-ink" : "border-transparent text-muted"}`}
          >
            <div className="relative">
              <span aria-hidden="true"><Icon size={18} color="currentColor" /></span>
              {it.badge && it.badge > 0 ? (
                <span className="absolute -top-1.5 -right-2 min-w-4 h-4 rounded-full bg-red-600 text-white text-[9px] font-bold flex items-center justify-center px-1">
                  {it.badge > 99 ? "99+" : it.badge}
                </span>
              ) : null}
            </div>
            <span
              className="ft-body text-xs font-medium"
            >
              {it.label}
            </span>
          </button>
        );
      })}
    </nav>
  );
}
