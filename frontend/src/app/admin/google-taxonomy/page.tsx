"use client";

import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search, ExternalLink } from "lucide-react";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/api-client";

interface GoogleCategory {
  id: string;
  name: string;
  path: string;
  parentId: string | null;
}

export default function AdminGoogleTaxonomyPage() {
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");

  useEffect(() => {
    const t = setTimeout(() => setDebounced(query.trim()), 300);
    return () => clearTimeout(t);
  }, [query]);

  const { data: results, isFetching } = useQuery<GoogleCategory[]>({
    queryKey: ["admin", "google-categories", "search", debounced],
    queryFn: async () => {
      if (!debounced) return [];
      const { data } = await api.get("/google-categories/search", {
        params: { q: debounced, limit: 50 },
      });
      return (data.data ?? data) as GoogleCategory[];
    },
    enabled: debounced.length > 0,
  });

  return (
    <div>
      <h1 className="text-3xl font-bold mb-2">Danh mục Google</h1>
      <p className="text-sm text-muted-foreground mb-6 max-w-2xl">
        Danh mục chính thức của{" "}
        <a
          href="https://support.google.com/merchants/answer/6324436"
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary hover:underline inline-flex items-center gap-1"
        >
          Danh mục Sản phẩm Google
          <ExternalLink className="h-3 w-3" />
        </a>{" "}
        bằng tiếng Việt (5.595 danh mục). Trang này chỉ để tham khảo — danh mục
        được cung cấp bởi seed của cơ sở dữ liệu. Việc chọn danh mục cho một sản
        phẩm hoặc danh mục nội bộ diễn ra trong các biểu mẫu tương ứng.
      </p>

      <div className="relative max-w-xl mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Tìm kiếm (ví dụ: mô hình, tượng, figure)"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="pl-9"
        />
      </div>

      {!debounced && (
        <p className="text-sm text-muted-foreground italic">
          Nhập ít nhất một thuật ngữ để tìm kiếm.
        </p>
      )}

      {debounced && isFetching && (
        <p className="text-sm text-muted-foreground">Đang tìm kiếm...</p>
      )}

      {debounced && !isFetching && results && results.length === 0 && (
        <p className="text-sm text-muted-foreground">
          Không tìm thấy danh mục nào cho &quot;{debounced}&quot;.
        </p>
      )}

      {results && results.length > 0 && (
        <div className="space-y-1">
          <p className="text-xs text-muted-foreground mb-2">
            {results.length} kết quả
            {results.length === 50 &&
              " (nhập thêm từ khóa để xem thêm kết quả)"}
          </p>
          <div className="border rounded-lg divide-y">
            {results.map((cat) => (
              <div
                key={cat.id}
                className="flex items-start gap-3 px-4 py-3 hover:bg-muted/30 transition-colors"
              >
                <span className="font-mono text-xs text-muted-foreground shrink-0 mt-0.5">
                  {cat.id}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm">{cat.path}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
