"use client";

import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface CatalogLoadMoreProps {
  hasMore: boolean;
  onClick: () => void;
  loading?: boolean;
  remaining?: number;
}

export function CatalogLoadMore({
  hasMore,
  onClick,
  loading = false,
  remaining,
}: CatalogLoadMoreProps) {
  if (!hasMore) return null;
  return (
    <div data-testid="catalog-load-more" className="mt-8 flex justify-center">
      <Button
        variant="ghost-neon"
        size="lg"
        onClick={onClick}
        disabled={loading}
        className="rounded-full"
      >
        {loading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Đang tải...
          </>
        ) : (
          <>
            Tải thêm
            {remaining !== undefined && remaining > 0 && (
              <span className="ml-2 text-xs opacity-70">({remaining})</span>
            )}
          </>
        )}
      </Button>
    </div>
  );
}
