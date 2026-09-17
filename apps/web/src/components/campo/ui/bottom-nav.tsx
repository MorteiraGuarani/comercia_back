import React from "react";
import { TOKENS } from "../tokens";

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
      aria-label="Navegación principal"
      className={`flex items-stretch shrink-0 ${className}`}
      style={{
        background: TOKENS.ink,
        borderTop: "1px solid #33362F",
      }}
    >
      {items.map((it) => {
        const isActive = active === it.key;
        const Icon = it.icon;
        const activeColor = "#C9A54A";
        const inactiveColor = "#8B8A7E";

        return (
          <button
            key={it.key}
            type="button"
            onClick={() => onChange(it.key)}
            className="flex-1 flex flex-col items-center justify-center gap-1 py-2.5 px-1 relative transition-colors cursor-pointer select-none"
          >
            <div className="relative">
              <Icon size={18} color={isActive ? activeColor : inactiveColor} />
              {it.badge && it.badge > 0 ? (
                <span className="absolute -top-1.5 -right-2 min-w-4 h-4 rounded-full bg-red-600 text-white text-[9px] font-bold flex items-center justify-center px-1">
                  {it.badge > 99 ? "99+" : it.badge}
                </span>
              ) : null}
            </div>
            <span
              className="ft-body text-[9px] font-medium transition-colors truncate max-w-full"
              style={{
                color: isActive ? activeColor : inactiveColor,
              }}
            >
              {it.label}
            </span>
          </button>
        );
      })}
    </nav>
  );
}
