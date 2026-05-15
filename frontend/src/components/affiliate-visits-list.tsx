"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Loader2,
  Eye,
  AlertCircle,
  CheckCircle2,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { api } from "@/lib/api-client";
import { Button } from "@/components/ui/button";

export interface Visit {
  id: string;
  createdAt: string;
  landingUrl: string;
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
  utmContent: string | null;
  utmTerm: string | null;
  userAgent: string | null;
  converted: boolean;
  orderNumber: string | null;
  convertedAt: string | null;
}

interface VisitsResponse {
  data: Visit[];
  meta: { total: number; page: number; perPage: number; lastPage: number };
}

interface Props {
  endpoint: string;
  title?: string;
}

function parseBrowserFromUA(ua: string | null): string {
  if (!ua) return "—";

  if (/iPhone|iPad|iPod/i.test(ua)) return "iOS";
  if (/Android/i.test(ua)) return "Android";
  if (/Windows/i.test(ua)) return "Windows";
  if (/Macintosh|Mac OS/i.test(ua)) return "Mac";
  if (/Linux/i.test(ua)) return "Linux";
  return "Outro";
}

function formatRelative(iso: string): string {
  const now = Date.now();
  const then = new Date(iso).getTime();
  const diffMs = now - then;
  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 1) return "vừa xong";
  if (minutes < 60) return `${minutes} phút trước`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} giờ trước`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days} ngày trước`;
  return new Date(iso).toLocaleDateString("vi-VN");
}

export function AffiliateVisitsList({
  endpoint,
  title = "Lượt truy cập",
}: Props) {
  const [page, setPage] = useState(1);
  const PER_PAGE = 20;

  const { data, isLoading, error } = useQuery<VisitsResponse>({
    queryKey: ["affiliate-visits", endpoint, page],
    queryFn: async () => {
      const { data } = await api.get<VisitsResponse>(endpoint, {
        params: { page, perPage: PER_PAGE },
      });
      return data;
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground py-8">
        <Loader2 className="h-4 w-4 animate-spin" />
        Đang tải lượt truy cập...
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-red-500/40 bg-red-950/20 p-4 flex items-start gap-3">
        <AlertCircle className="h-5 w-5 text-red-400 shrink-0 mt-0.5" />
        <div>
          <p className="font-semibold text-red-300">
            Không thể tải danh sách lượt truy cập
          </p>
          <p className="text-xs text-muted-foreground">
            {(error as Error).message}
          </p>
        </div>
      </div>
    );
  }

  if (!data || data.data.length === 0) {
    return (
      <div className="rounded-2xl border border-purple/25 bg-ink-soft p-8 text-center">
        <Eye className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
        <p className="text-muted-foreground">
          Chưa có lượt truy cập. Hãy chia sẻ link của bạn!
        </p>
        <p className="text-xs text-muted-foreground mt-2">
          Lượt truy cập chưa chuyển đổi sẽ được lưu trữ trong 30 ngày.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold flex items-center gap-2">
          <Eye className="h-5 w-5 text-cyan" />
          {title}
        </h2>
        <span className="text-sm text-muted-foreground">
          {data.meta.total} total
        </span>
      </div>

      <div className="rounded-2xl border border-purple/25 bg-ink-soft overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-ink/50 text-xs uppercase text-muted-foreground">
            <tr>
              <th className="text-left px-4 py-3 font-medium">Thời gian</th>
              <th className="text-left px-4 py-3 font-medium">Nguồn</th>
              <th className="text-left px-4 py-3 font-medium">Trang đích</th>
              <th className="text-left px-4 py-3 font-medium">Thiết bị</th>
              <th className="text-left px-4 py-3 font-medium">Chuyển đổi</th>
            </tr>
          </thead>
          <tbody>
            {data.data.map((v) => (
              <tr
                key={v.id}
                className="border-t border-purple/15 hover:bg-ink/30"
              >
                <td className="px-4 py-3 whitespace-nowrap">
                  <span title={new Date(v.createdAt).toLocaleString("vi-VN")}>
                    {formatRelative(v.createdAt)}
                  </span>
                </td>
                <td className="px-4 py-3">
                  {v.utmSource ? (
                    <div className="flex flex-col">
                      <span className="font-medium">{v.utmSource}</span>
                      {v.utmMedium && (
                        <span className="text-xs text-muted-foreground">
                          {v.utmMedium}
                          {v.utmCampaign && ` · ${v.utmCampaign}`}
                        </span>
                      )}
                    </div>
                  ) : (
                    <span className="text-muted-foreground">trực tiếp</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <code
                    className="text-xs text-cyan/80 max-w-[200px] truncate block"
                    title={v.landingUrl}
                  >
                    {v.landingUrl}
                  </code>
                </td>
                <td className="px-4 py-3 text-xs text-muted-foreground">
                  {parseBrowserFromUA(v.userAgent)}
                </td>
                <td className="px-4 py-3">
                  {v.converted ? (
                    <div className="flex items-center gap-1.5 text-emerald-400">
                      <CheckCircle2 className="h-4 w-4" />
                      <span className="text-xs font-medium">
                        {v.orderNumber ?? "SIM"}
                      </span>
                      {v.orderNumber && (
                        <ExternalLink className="h-3 w-3 opacity-60" />
                      )}
                    </div>
                  ) : (
                    <span className="text-xs text-muted-foreground">—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {data.meta.lastPage > 1 && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">
            Trang {data.meta.page} / {data.meta.lastPage}
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              className="bg-ink-soft border-cyan/30 text-white hover:bg-cyan/10"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
            >
              <ChevronLeft className="h-4 w-4" />
              Trước
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="bg-ink-soft border-cyan/30 text-white hover:bg-cyan/10"
              onClick={() =>
                setPage((p) => Math.min(data.meta.lastPage, p + 1))
              }
              disabled={page >= data.meta.lastPage}
            >
              Sau
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
