import { X } from "lucide-react";
import type { CatalogChip } from "@/hooks/use-catalog-filters";

interface CatalogAppliedChipsProps {
  chips: CatalogChip[];
  onClearAll: () => void;
}

export function CatalogAppliedChips({
  chips,
  onClearAll,
}: CatalogAppliedChipsProps) {
  if (chips.length === 0) return null;
  return (
    <div
      data-testid="catalog-applied-chips"
      className="mb-5 flex items-center gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden md:flex-wrap md:overflow-x-visible md:pb-0"
    >
      <span className="mr-1 shrink-0 self-center text-[11px] uppercase tracking-[0.08em] [font-family:var(--font-mono)] text-white/40">
        <span className="md:hidden">Đã áp dụng:</span>
        <span className="hidden md:inline">Bộ lọc đã áp dụng:</span>
      </span>
      {chips.map((chip) => (
        <button
          key={chip.id}
          type="button"
          onClick={chip.onRemove}
          aria-label={`Remover filtro: ${chip.label}`}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-cyan/30 bg-cyan/[0.08] px-3 py-1 text-[11px] [font-family:var(--font-mono)] text-cyan transition-colors hover:bg-cyan/15"
        >
          <X className="h-3 w-3 text-white/70" />
          {chip.label}
        </button>
      ))}
      <button
        type="button"
        onClick={onClearAll}
        className="ml-1 shrink-0 text-[11px] [font-family:var(--font-mono)] text-magenta hover:underline"
      >
        Xóa tất cả
      </button>
    </div>
  );
}
