"use client";

import { useState, useEffect } from "react";
import { Filter } from "lucide-react";
import {
  Drawer,
  DrawerContent,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { CatalogFilters, type CatalogFiltersData } from "./catalog-filters";
import type { CatalogFilters as CatalogFiltersState } from "@/hooks/use-catalog-filters";

interface CatalogMobileFilterSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  filters: CatalogFiltersState;
  data: CatalogFiltersData | null;
  onFilterChange: <K extends keyof CatalogFiltersState>(
    key: K,
    value: CatalogFiltersState[K],
  ) => void;
  hideBrandFilter?: boolean;
  totalCount: number;
}

export function CatalogMobileFilterSheet({
  open,
  onOpenChange,
  filters,
  data,
  onFilterChange,
  hideBrandFilter,
  totalCount,
}: CatalogMobileFilterSheetProps) {
  const [snapshot, setSnapshot] = useState<CatalogFiltersState | null>(null);

  useEffect(() => {
    if (open && !snapshot) setSnapshot(filters);
    if (!open) setSnapshot(null);
  }, [open]);

  function handleCancel() {
    if (snapshot) {
      (Object.keys(snapshot) as Array<keyof CatalogFiltersState>).forEach(
        (k) => {
          onFilterChange(k, snapshot[k] as CatalogFiltersState[typeof k]);
        },
      );
    }
    onOpenChange(false);
  }

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent
        data-testid="catalog-mobile-filter-sheet"
        className="max-h-[90vh] border-t border-purple/40 bg-[rgba(10,4,24,0.98)] backdrop-blur-xl"
      >
        <DrawerHeader className="flex flex-row items-center justify-between border-b border-white/10 px-5 py-3">
          <DrawerTitle className="flex items-center gap-2 text-sm font-bold uppercase tracking-[0.06em] text-white [font-family:var(--font-orbitron)]">
            <Filter className="h-4 w-4 text-cyan" />
            Bộ lọc
          </DrawerTitle>
          <button
            type="button"
            onClick={handleCancel}
            className="text-[11px] [font-family:var(--font-mono)] text-white/45 hover:text-magenta"
          >
            Xóa
          </button>
        </DrawerHeader>
        <div className="flex-1 overflow-y-auto px-5 py-4">
          <CatalogFilters
            filters={filters}
            data={data}
            onFilterChange={onFilterChange}
            hideBrandFilter={hideBrandFilter}
          />
        </div>
        <DrawerFooter className="flex flex-row gap-2.5 border-t border-white/10 px-4 pb-6 pt-3">
          <Button
            variant="ghost-neon"
            className="flex-1 rounded-xl"
            onClick={handleCancel}
          >
            Hủy
          </Button>
          <Button
            variant="neon"
            className="flex-[2] rounded-xl"
            onClick={() => onOpenChange(false)}
          >
            Áp dụng ({totalCount})
          </Button>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}
