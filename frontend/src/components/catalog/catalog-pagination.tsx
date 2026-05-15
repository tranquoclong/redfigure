"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

interface CatalogPaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

function buildPageList(
  current: number,
  total: number,
): Array<number | "ellipsis"> {
  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }
  const pages: Array<number | "ellipsis"> = [1];
  const start = Math.max(2, current - 1);
  const end = Math.min(total - 1, current + 1);
  if (start > 2) pages.push("ellipsis");
  for (let i = start; i <= end; i++) pages.push(i);
  if (end < total - 1) pages.push("ellipsis");
  pages.push(total);
  return pages;
}

export function CatalogPagination({
  currentPage,
  totalPages,
  onPageChange,
}: CatalogPaginationProps) {
  if (totalPages <= 1) return null;
  const pages = buildPageList(currentPage, totalPages);

  return (
    <nav
      data-testid="catalog-pagination"
      aria-label="Phân trang"
      className="mt-10 flex items-center justify-center gap-2"
    >
      <Button
        variant="ghost-neon"
        size="icon-sm"
        disabled={currentPage === 1}
        onClick={() => onPageChange(currentPage - 1)}
        aria-label="Trang trước"
      >
        <ChevronLeft className="h-4 w-4" />
      </Button>
      {pages.map((p, idx) =>
        p === "ellipsis" ? (
          <span
            key={`e-${idx}`}
            className="px-1 text-sm text-white/40"
            aria-hidden
          >
            …
          </span>
        ) : (
          <Button
            key={p}
            variant={p === currentPage ? "neon" : "ghost-neon"}
            size="sm"
            onClick={() => onPageChange(p)}
            aria-current={p === currentPage ? "page" : undefined}
            aria-label={`Trang ${p}`}
            className="min-w-9 rounded-md"
          >
            {p}
          </Button>
        ),
      )}
      <Button
        variant="ghost-neon"
        size="icon-sm"
        disabled={currentPage === totalPages}
        onClick={() => onPageChange(currentPage + 1)}
        aria-label="Trang kế tiếp"
      >
        <ChevronRight className="h-4 w-4" />
      </Button>
    </nav>
  );
}
