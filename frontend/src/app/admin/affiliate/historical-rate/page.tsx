"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, History, Loader2, AlertCircle } from "lucide-react";
import { api } from "@/lib/api-client";
import { Button } from "@/components/ui/button";

type AuditEntry = {
  id: string;
  action: "CREATED" | "UPDATED";
  oldRate: string | null;
  newRate: string | null;
  changedAt: string;
  changedBy: {
    id: string;
    name: string | null;
    email: string;
  };
};

type AuditResponse = {
  data: AuditEntry[];
  meta: { total: number; page: number; perPage: number; lastPage: number };
};

export default function HistoricalRatePage() {
  const { data, isLoading, error } = useQuery<AuditResponse>({
    queryKey: ["affiliate-default-rate-history"],
    queryFn: async () => {
      const response = await api.get("/admin/affiliates/audit/default-rate");
      return response.data;
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/admin/affiliate">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <History className="h-8 w-8 text-cyan" />
        <div>
          <h1 className="text-3xl font-bold">Lịch sử tỷ lệ mặc định</h1>
          <p className="text-sm text-muted-foreground">
            Lịch sử thay đổi tỷ lệ hoa hồng mặc định
            (affiliate_default_commission_rate).
          </p>
        </div>
      </div>

      {isLoading && (
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Đang tải...
        </div>
      )}

      {error && (
        <div className="rounded-2xl border border-red-500/40 bg-red-950/20 p-4 flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-red-400 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-red-300">Không thể tải lịch sử</p>
            <p className="text-xs text-muted-foreground">
              {(error as Error).message}
            </p>
          </div>
        </div>
      )}

      {data && data.data.length === 0 && (
        <div className="rounded-2xl border border-purple/25 bg-ink-soft p-8 text-center">
          <p className="text-muted-foreground">
            Chưa có thay đổi nào được ghi lại trong tỷ lệ mặc định.
          </p>
        </div>
      )}

      {data && data.data.length > 0 && (
        <div className="rounded-2xl border border-purple/25 bg-ink-soft overflow-hidden">
          <table className="w-full">
            <thead className="bg-ink/50 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="text-left px-4 py-3 font-medium">Khi nào</th>
                <th className="text-left px-4 py-3 font-medium">Hành động</th>
                <th className="text-left px-4 py-3 font-medium">Từ</th>
                <th className="text-left px-4 py-3 font-medium">Đến</th>
                <th className="text-left px-4 py-3 font-medium">Admin</th>
              </tr>
            </thead>
            <tbody>
              {data.data.map((entry) => (
                <tr
                  key={entry.id}
                  className="border-t border-purple/15 hover:bg-ink/30"
                >
                  <td className="px-4 py-3 text-sm">
                    {new Date(entry.changedAt).toLocaleString("vi-VN")}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={
                        entry.action === "CREATED"
                          ? "text-emerald-400 text-xs font-medium"
                          : "text-cyan text-xs font-medium"
                      }
                    >
                      {entry.action === "CREATED" ? "Tạo" : "Thay đổi"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">
                    {entry.oldRate != null ? `${entry.oldRate}%` : "—"}
                  </td>
                  <td className="px-4 py-3 text-sm font-semibold">
                    {entry.newRate != null ? `${entry.newRate}%` : "—"}
                  </td>
                  <td className="px-4 py-3 text-sm">
                    <div className="flex flex-col">
                      <span>{entry.changedBy.name ?? "—"}</span>
                      <span className="text-xs text-muted-foreground">
                        {entry.changedBy.email}
                      </span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {data && data.meta.total > data.meta.perPage && (
        <p className="text-xs text-muted-foreground text-center">
          Hiển thị {data.data.length} của {data.meta.total} mục.
        </p>
      )}
    </div>
  );
}
