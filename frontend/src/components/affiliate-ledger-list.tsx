"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Loader2,
  AlertCircle,
  ArrowUpRight,
  ArrowDownLeft,
  FileText,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { api } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/constants";

interface Entry {
  id: string;
  type: "CREDIT" | "DEBIT";
  source: "COMMISSION" | "MANUAL_CREDIT" | "PAYMENT" | "ADJUSTMENT";
  amount: string;
  reason: string | null;
  createdAt: string;
  orderId: string | null;
  commissionId: string | null;
  paymentId: string | null;
  createdByUserId: string | null;
}

interface Response {
  data: Entry[];
  meta: { total: number; page: number; perPage: number; lastPage: number };
}

const SOURCE_LABELS: Record<Entry["source"], string> = {
  COMMISSION: "Hoa hồng",
  MANUAL_CREDIT: "Ghi nợ thủ công",
  PAYMENT: "Thanh toán",
  ADJUSTMENT: "Điều chỉnh",
};

export function AffiliateLedgerList({
  endpoint,
  title = "Chiết khấu",
}: {
  endpoint: string;
  title?: string;
}) {
  const [page, setPage] = useState(1);
  const PER_PAGE = 20;

  const { data, isLoading, error } = useQuery<Response>({
    queryKey: ["affiliate-ledger", endpoint, page],
    queryFn: async () => {
      const { data } = await api.get<Response>(endpoint, {
        params: { page, perPage: PER_PAGE },
      });
      return data;
    },
  });

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold flex items-center gap-2">
          <FileText className="h-5 w-5 text-purple" />
          {title}
        </h2>
        {data && (
          <span className="text-sm text-muted-foreground">
            {data.meta.total} giao dịch
          </span>
        )}
      </div>

      {isLoading && (
        <div className="flex items-center gap-2 text-muted-foreground py-4">
          <Loader2 className="h-4 w-4 animate-spin" />
          Đang tải...
        </div>
      )}

      {error && (
        <div className="rounded-2xl border border-red-500/40 bg-red-950/20 p-4 flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-red-400 shrink-0 mt-0.5" />
          <p className="text-sm text-red-300">{(error as Error).message}</p>
        </div>
      )}

      {data && data.data.length === 0 && (
        <div className="rounded-2xl border border-purple/25 bg-ink-soft p-8 text-center text-muted-foreground">
          Chưa có giao dịch nào.
        </div>
      )}

      {data && data.data.length > 0 && (
        <div className="rounded-2xl border border-purple/25 bg-ink-soft overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-ink/50 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="text-left px-4 py-3 font-medium">Ngày</th>
                <th className="text-left px-4 py-3 font-medium">Loại</th>
                <th className="text-left px-4 py-3 font-medium">Nguồn</th>
                <th className="text-right px-4 py-3 font-medium">Giá</th>
                <th className="text-left px-4 py-3 font-medium">Lý do</th>
              </tr>
            </thead>
            <tbody>
              {data.data.map((e) => (
                <tr
                  key={e.id}
                  className="border-t border-purple/15 hover:bg-ink/30"
                >
                  <td className="px-4 py-3 text-xs whitespace-nowrap">
                    {new Date(e.createdAt).toLocaleString("vi-VN")}
                  </td>
                  <td className="px-4 py-3">
                    {e.type === "CREDIT" ? (
                      <span className="inline-flex items-center gap-1 text-emerald-400 text-xs font-medium">
                        <ArrowUpRight className="h-3 w-3" />
                        Nhận
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-red-400 text-xs font-medium">
                        <ArrowDownLeft className="h-3 w-3" />
                        Trả
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground text-xs">
                    {SOURCE_LABELS[e.source]}
                  </td>
                  <td
                    className={`px-4 py-3 text-right font-semibold ${
                      e.type === "CREDIT" ? "text-emerald-400" : "text-red-400"
                    }`}
                  >
                    {e.type === "CREDIT" ? "+" : "-"}
                    {formatCurrency(Number(e.amount))}
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground max-w-[260px]">
                    <span className="line-clamp-2" title={e.reason ?? ""}>
                      {e.reason ?? "—"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {data && data.meta.lastPage > 1 && (
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
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
