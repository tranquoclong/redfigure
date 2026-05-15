"use client";

import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface PaginationProps {
  page: number;
  lastPage: number;
  onPageChange: (page: number) => void;
}

export function Pagination({ page, lastPage, onPageChange }: PaginationProps) {
  if (lastPage <= 1) return null;

  return (
    <div className="flex items-center justify-center gap-2 mt-8">
      <Button
        variant="outline"
        size="icon"
        disabled={page <= 1}
        onClick={() => onPageChange(page - 1)}
        aria-label="Trước"
      >
        <ChevronLeft className="h-4 w-4" />
      </Button>

      <span className="text-sm text-muted-foreground px-3">
        {page} / {lastPage}
      </span>

      <Button
        variant="outline"
        size="icon"
        disabled={page >= lastPage}
        onClick={() => onPageChange(page + 1)}
        aria-label="Sau"
      >
        <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  );
}
