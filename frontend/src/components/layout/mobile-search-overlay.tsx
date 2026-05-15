"use client";

import {
  useState,
  useEffect,
  useRef,
  useCallback,
  type FormEvent,
} from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Search, Loader2, X } from "lucide-react";
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

interface MobileSearchOverlayProps {
  open: boolean;
  onClose: () => void;
}

export function MobileSearchOverlay({
  open,
  onClose,
}: MobileSearchOverlayProps) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const close = useCallback(() => {
    setQuery("");
    setResults([]);
    onClose();
  }, [onClose]);

  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";

      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

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
    router.push(`/p/${slug}`);
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[80] flex flex-col bg-ink lg:hidden"
      role="dialog"
      aria-modal="true"
      aria-label="Tìm kiếm sản phẩm"
    >
      <div className="flex items-center gap-2 border-b border-white/10 bg-ink/95 px-3 py-3 backdrop-blur-md">
        <button
          type="button"
          onClick={close}
          aria-label="Trở về"
          className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-white/70 transition-colors hover:bg-white/5 hover:text-white"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <form onSubmit={handleSubmit} role="search" className="relative flex-1">
          <Search
            className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-cyan/70"
            size={18}
          />
          <input
            ref={inputRef}
            type="search"
            value={query}
            onChange={(e) => handleChange(e.target.value)}
            placeholder="Tìm kiếm mô hình, tỷ lệ, nghệ sĩ…"
            className="w-full rounded-full border border-white/15 bg-black/40 py-2.5 pl-11 pr-10 text-[15px] text-white placeholder:text-white/40 focus:border-cyan/70 focus:outline-none"
          />
          {loading ? (
            <Loader2 className="absolute right-3.5 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-cyan/70" />
          ) : query ? (
            <button
              type="button"
              onClick={() => {
                setQuery("");
                setResults([]);
                inputRef.current?.focus();
              }}
              aria-label="Xóa tìm kiếm"
              className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1 text-white/45 hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>
          ) : null}
        </form>
      </div>

      <div className="flex-1 overflow-y-auto">
        {query.trim().length < 2 ? (
          <div className="px-6 py-12 text-center">
            <Search className="mx-auto mb-3 h-8 w-8 text-white/15" />
            <p className="text-sm text-white/40">
              Nhập ít nhất 2 ký tự để tìm kiếm
            </p>
          </div>
        ) : results.length > 0 ? (
          <ul>
            {results.map((item) => {
              const price = item.salePrice ?? item.basePrice;
              return (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => handleSelect(item.slug)}
                    className="flex w-full items-center gap-3 border-b border-white/5 px-4 py-3 text-left transition-colors hover:bg-white/5"
                  >
                    {item.image ? (
                      <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-white/5">
                        <Image
                          src={item.image}
                          alt={item.name}
                          fill
                          sizes="48px"
                          className="object-cover"
                        />
                      </div>
                    ) : (
                      <div className="h-12 w-12 shrink-0 rounded-lg bg-white/5" />
                    )}
                    <span className="line-clamp-2 min-w-0 flex-1 text-sm text-white/85">
                      {item.name}
                    </span>
                    <span className="shrink-0 text-sm font-bold text-cyan">
                      {formatCurrency(price)}
                    </span>
                  </button>
                </li>
              );
            })}
            <button
              type="button"
              onClick={handleSubmit as () => void}
              className="w-full border-b border-white/5 px-4 py-3 text-center text-sm text-cyan/80 transition-colors hover:bg-white/5 hover:text-cyan"
            >
              Xem tất cả kết quả cho &quot;{query}&quot;
            </button>
          </ul>
        ) : !loading ? (
          <div className="px-6 py-12 text-center">
            <p className="text-sm text-white/40">
              Không tìm thấy sản phẩm nào cho &quot;{query}&quot;
            </p>
          </div>
        ) : null}
      </div>
    </div>
  );
}
