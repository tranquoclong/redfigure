"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

export interface ProductTab {
  id: string;
  label: string;
  count?: number;
  content: React.ReactNode;
}

export interface ProductTabsProps {
  tabs: ProductTab[];
}

export function ProductTabs({ tabs }: ProductTabsProps) {
  const [activeId, setActiveId] = useState(tabs[0]?.id ?? "");

  if (tabs.length === 0) return null;

  return (
    <div className="mt-12">
      <div
        role="tablist"
        className="sticky top-[76px] z-30 -mx-4 flex gap-1 overflow-x-auto border-b border-white/10 bg-ink/85 px-4 backdrop-blur-md sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8"
      >
        {tabs.map((tab) => {
          const isActive = activeId === tab.id;
          return (
            <button
              key={tab.id}
              role="tab"
              aria-selected={isActive}
              aria-controls={`panel-${tab.id}`}
              onClick={() => setActiveId(tab.id)}
              className={cn(
                "relative whitespace-nowrap border-b-2 px-5 py-3.5 text-xs uppercase tracking-[0.1em] transition-colors",
                isActive
                  ? "border-magenta text-white [box-shadow:0_2px_12px_rgba(184,41,255,.4)]"
                  : "border-transparent text-white/55 hover:text-white",
              )}
            >
              {tab.label}
              {tab.count !== undefined && tab.count > 0 && (
                <span
                  className={cn(
                    "ml-2 font-mono text-[10px]",
                    isActive ? "text-cyan" : "text-white/40",
                  )}
                >
                  {tab.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {tabs.map((tab) => {
        const isActive = activeId === tab.id;
        return (
          <section
            key={tab.id}
            id={`panel-${tab.id}`}
            role="tabpanel"
            aria-labelledby={tab.id}
            hidden={!isActive}
            className={isActive ? "animate-tab-fade py-10" : ""}
          >
            {tab.content}
          </section>
        );
      })}
    </div>
  );
}
