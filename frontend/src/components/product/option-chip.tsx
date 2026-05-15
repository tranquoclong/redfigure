"use client";

import { cn } from "@/lib/utils";

export interface OptionChipProps {
  label: string;
  meta?: string;
  priceLabel?: string;
  selected?: boolean;
  disabled?: boolean;
  shaking?: boolean;
  onClick?: () => void;
  className?: string;
  ariaLabel?: string;
}

export function OptionChip({
  label,
  meta,
  priceLabel,
  selected = false,
  disabled = false,
  shaking = false,
  onClick,
  className,
  ariaLabel,
}: OptionChipProps) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      aria-label={ariaLabel ?? label}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "flex min-w-[90px] flex-col items-start gap-0.5 rounded-xl border bg-black/30 px-4 py-3 text-left transition-all duration-[var(--dur-base)] [transition-timing-function:var(--ease-out)]",
        "hover:border-cyan/45",
        selected
          ? "border-cyan bg-cyan/[0.1] [box-shadow:var(--glow-cyan-sm)]"
          : "border-white/10",
        disabled && "cursor-not-allowed opacity-40 hover:border-white/10",
        shaking && "animate-shake-x",
        className,
      )}
    >
      <span
        className={cn(
          " text-[13px] font-semibold uppercase tracking-[0.04em]",
          selected ? "text-white" : "text-white/95",
        )}
      >
        {label}
      </span>

      {meta && meta.toLowerCase() !== label.toLowerCase() && (
        <span
          className={cn(
            "font-mono text-[10px] tracking-[0.08em]",
            selected ? "text-cyan" : "text-white/55",
          )}
        >
          {meta}
        </span>
      )}
      {priceLabel && (
        <span className="mt-0.5 font-mono text-[10px] tracking-[0.08em] text-lime">
          {priceLabel}
        </span>
      )}
    </button>
  );
}
