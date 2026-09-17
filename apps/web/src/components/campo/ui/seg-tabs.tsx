import React from "react";
import { TOKENS } from "../tokens";

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
    <div className={`flex gap-1.5 shrink-0 ${className}`}>
      {tabs.map((tab) => {
        const isActive = active === tab.key;
        const Icon = tab.icon;

        return (
          <button
            key={tab.key}
            type="button"
            onClick={() => onChange(tab.key)}
            className="flex-1 ft-body text-[11px] font-medium py-2 px-2.5 rounded-md flex flex-col items-center justify-center gap-1 transition-all cursor-pointer select-none"
            style={{
              background: isActive ? TOKENS.ink : "transparent",
              color: isActive ? "#ffffff" : TOKENS.sub,
              border: `1px solid ${isActive ? TOKENS.ink : TOKENS.line}`,
            }}
          >
            {Icon && <Icon size={14} color={isActive ? "#ffffff" : TOKENS.sub} />}
            <span className="truncate">
              {tab.label} {tab.count !== undefined ? `(${tab.count})` : ""}
            </span>
          </button>
        );
      })}
    </div>
  );
}
