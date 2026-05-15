"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Search, X, Loader2 } from "lucide-react";
import Image from "next/image";
import { api } from "@/lib/api-client";
import { formatCurrency } from "@/lib/constants";
import { trackSearch } from "@/lib/ga4-events";
import { trackSearch as trackMetaSearch } from "@/lib/meta-pixel";

interface SearchResult {
  id: string;
  name: string;
  slug: string;
  basePrice: number;
  salePrice?: number;
  image?: string;
}

export function SearchDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const close = useCallback(() => {
    setOpen(false);
    setQuery("");
    setResults([]);
  }, []);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, close]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        close();
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open, close]);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  function handleSearch(value: string) {
    setQuery(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (value.trim().length < 2) {
      setResults([]);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const { data } = await api.get("/search/autocomplete", {
          params: { q: value },
        });
        setResults(data.data ?? []);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 300);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const term = query.trim();
    if (term) {
      trackSearch(term);
      trackMetaSearch(term);
      close();
      router.push(`/search?q=${encodeURIComponent(term)}`);
    }
  }

  function handleSelectProduct(slug: string) {
    close();
    router.push(`/p/${slug}`);
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 hover:bg-accent hover:text-accent-foreground h-10 w-10"
        aria-label="Tìm kiếm"
      >
        <Search className="h-5 w-5" />
      </button>
    );
  }

  return (
    <div className="fixed inset-0 z-[100] bg-black/50" onClick={close}>
      <div
        ref={containerRef}
        className="mx-auto max-w-2xl mt-20 bg-background rounded-xl shadow-2xl border overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <form
          onSubmit={handleSubmit}
          className="flex items-center border-b px-4"
        >
          <Search className="h-5 w-5 text-muted-foreground shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => handleSearch(e.target.value)}
            placeholder="Tìm kiếm sản phẩm..."
            className="flex-1 h-14 px-3 bg-transparent text-base outline-none"
          />
          {loading && (
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          )}
          <button
            type="button"
            onClick={close}
            className="p-1 hover:bg-muted rounded"
          >
            <X className="h-5 w-5 text-muted-foreground" />
          </button>
        </form>

        {results.length > 0 && (
          <div className="max-h-[60vh] overflow-y-auto">
            {results.map((item) => {
              const price = item.salePrice ?? item.basePrice;
              return (
                <button
                  key={item.id}
                  onClick={() => handleSelectProduct(item.slug)}
                  className="flex items-center gap-3 w-full px-4 py-3 hover:bg-muted/50 transition-colors text-left"
                >
                  {item.image ? (
                    <div className="relative w-10 h-10 rounded overflow-hidden shrink-0 bg-muted">
                      <Image
                        src={item.image}
                        alt={item.name}
                        fill
                        className="object-cover"
                        sizes="40px"
                      />
                    </div>
                  ) : (
                    <div className="w-10 h-10 rounded bg-muted shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{item.name}</p>
                  </div>
                  <span className="text-sm font-bold text-primary shrink-0">
                    {formatCurrency(price)}
                  </span>
                </button>
              );
            })}
            <button
              onClick={handleSubmit}
              className="w-full px-4 py-3 text-sm text-center text-primary font-medium hover:bg-muted/50 border-t"
            >
              Xem tất cả kết quả cho &quot;{query}&quot;
            </button>
          </div>
        )}

        {query.trim().length >= 2 && !loading && results.length === 0 && (
          <div className="px-4 py-8 text-center text-sm text-muted-foreground">
            Không tìm thấy sản phẩm nào cho &quot;{query}&quot;
          </div>
        )}
      </div>
    </div>
  );
}
