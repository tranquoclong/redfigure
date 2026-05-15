"use client";

import {
  useState,
  useEffect,
  useRef,
  useCallback,
  type FormEvent,
} from "react";
import { useRouter } from "next/navigation";
import { Search, Loader2 } from "lucide-react";
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

export function SearchInput() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const close = useCallback(() => {
    setOpen(false);
    setResults([]);
  }, []);

  useEffect(() => {
    if (!open) return;
    function handler(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        close();
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open, close]);

  useEffect(() => {
    if (!open) return;
    function handler(e: KeyboardEvent) {
      if (e.key === "Escape") close();
    }
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, close]);

  function handleChange(value: string) {
    setQuery(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (value.trim().length < 2) {
      setResults([]);
      setOpen(false);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const { data } = await api.get("/search/autocomplete", {
          params: { q: value },
        });
        const items = data.data ?? [];
        setResults(items);
        setOpen(items.length > 0 || value.trim().length >= 2);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 300);
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const q = query.trim();
    if (!q) return;
    trackSearch(q);
    trackMetaSearch(q);
    close();
    router.push(`/search?q=${encodeURIComponent(q)}`);
  }

  function handleSelect(slug: string) {
    close();
    setQuery("");
    router.push(`/p/${slug}`);
  }

  return (
    <div
      ref={containerRef}
      className="hidden max-w-[420px] flex-1 md:block relative"
    >
      <form onSubmit={handleSubmit} role="search">
        <label className="relative block">
          <span className="sr-only">Tìm kiếm sản phẩm</span>
          <Search
            className="absolute left-4 top-1/2 -translate-y-1/2 text-cyan/70"
            size={18}
          />
          <input
            type="search"
            value={query}
            onChange={(e) => handleChange(e.target.value)}
            onFocus={() => results.length > 0 && setOpen(true)}
            placeholder="Tìm kiếm mô hình, tỷ lệ, nghệ sĩ…"
            className="w-full rounded-full border border-white/10 bg-black/40 py-2.5 pl-11 pr-10 text-sm text-white placeholder:text-white/40 focus:border-cyan/70 focus:outline-none focus:shadow-[0_0_0_3px_rgba(0,240,255,0.15)]"
          />
          {loading && (
            <Loader2 className="absolute right-4 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-cyan/70" />
          )}
        </label>
      </form>

      {open && (
        <div className="absolute top-full left-0 right-0 mt-2 rounded-xl border border-purple/25 bg-ink/95 backdrop-blur-md shadow-[0_20px_60px_-10px_rgba(184,41,255,0.3)] overflow-hidden z-50">
          {results.length > 0 ? (
            <>
              {results.map((item) => {
                const price = item.salePrice ?? item.basePrice;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleSelect(item.slug)}
                    className="flex items-center gap-3 w-full px-4 py-2.5 hover:bg-white/5 transition-colors text-left"
                  >
                    {item.image ? (
                      <div className="relative w-9 h-9 rounded overflow-hidden shrink-0 bg-white/5">
                        <Image
                          src={item.image}
                          alt={item.name}
                          fill
                          className="object-cover"
                          sizes="36px"
                        />
                      </div>
                    ) : (
                      <div className="w-9 h-9 rounded bg-white/5 shrink-0" />
                    )}
                    <span className="flex-1 min-w-0 text-sm text-white/80 truncate">
                      {item.name}
                    </span>
                    <span className="text-sm font-bold text-cyan shrink-0">
                      {formatCurrency(price)}
                    </span>
                  </button>
                );
              })}
              <button
                type="button"
                onClick={handleSubmit as () => void}
                className="w-full px-4 py-2.5 text-sm text-center text-cyan/80 hover:text-cyan hover:bg-white/5 border-t border-white/10 transition-colors"
              >
                Xem tất cả kết quả cho &quot;{query}&quot;
              </button>
            </>
          ) : (
            query.trim().length >= 2 &&
            !loading && (
              <div className="px-4 py-6 text-center text-sm text-white/40">
                Không tìm thấy sản phẩm nào cho &quot;{query}&quot;
              </div>
            )
          )}
        </div>
      )}
    </div>
  );
}
