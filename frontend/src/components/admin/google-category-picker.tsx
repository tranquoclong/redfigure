"use client";

import { useState, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/api-client";

interface GoogleCategory {
  id: string;
  name: string;
  path: string;
}

interface Props {
  value: string | null | undefined;

  onChange: (id: string | null) => void;

  initial?: GoogleCategory | null;
  placeholder?: string;
}

export function GoogleCategoryPicker({
  value,
  onChange,
  initial,
  placeholder = "Tìm danh mục Google...",
}: Props) {
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(query.trim()), 250);
    return () => clearTimeout(t);
  }, [query]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const { data: selected } = useQuery<GoogleCategory | null>({
    queryKey: ["google-category", value],
    queryFn: async () => {
      if (!value) return null;
      const { data } = await api.get(`/google-categories/${value}`);
      return (data.data ?? data) as GoogleCategory;
    },
    enabled: !!value && !initial,
    initialData: initial ?? undefined,
    staleTime: Infinity,
  });

  const { data: results, isFetching } = useQuery<GoogleCategory[]>({
    queryKey: ["google-categories", "search", debounced],
    queryFn: async () => {
      if (!debounced) return [];
      const { data } = await api.get("/google-categories/search", {
        params: { q: debounced, limit: 30 },
      });
      return (data.data ?? data) as GoogleCategory[];
    },
    enabled: debounced.length > 0 && open,
  });

  function handleSelect(cat: GoogleCategory) {
    onChange(cat.id);
    setQuery("");
    setDebounced("");
    setOpen(false);
  }

  function handleClear() {
    onChange(null);
    setQuery("");
    setDebounced("");
  }

  return (
    <div className="space-y-1.5" ref={containerRef}>
      {value && selected && (
        <div className="flex items-start gap-2 rounded-md border bg-muted/30 px-3 py-2 text-xs">
          <span className="font-mono text-muted-foreground shrink-0">
            {selected.id}
          </span>
          <span className="flex-1 break-words">{selected.path}</span>
          <button
            type="button"
            onClick={handleClear}
            className="text-muted-foreground hover:text-destructive shrink-0"
            aria-label="Remover categoria"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
        <Input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder={placeholder}
          className="pl-8 h-9 text-sm"
        />

        {open && debounced && (
          <div className="absolute z-50 left-0 right-0 mt-1 max-h-72 overflow-y-auto rounded-md border bg-popover shadow-lg">
            {isFetching && (
              <div className="px-3 py-2 text-xs text-muted-foreground">
                Đang tìm kiếm...
              </div>
            )}
            {!isFetching && results && results.length === 0 && (
              <div className="px-3 py-2 text-xs text-muted-foreground">
                Không tìm thấy danh mục nào.
              </div>
            )}
            {!isFetching &&
              results?.map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => handleSelect(cat)}
                  className="w-full text-left px-3 py-2 hover:bg-muted/50 text-xs flex items-start gap-2 border-b last:border-b-0"
                >
                  <span className="font-mono text-muted-foreground shrink-0">
                    {cat.id}
                  </span>
                  <span className="flex-1">{cat.path}</span>
                </button>
              ))}
          </div>
        )}
      </div>
    </div>
  );
}
