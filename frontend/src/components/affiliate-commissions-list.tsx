"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Loader2,
  AlertCircle,
  Clock,
  CheckCircle2,
  XCircle,
  ChevronLeft,
  ChevronRight,
  DollarSign,
} from "lucide-react";
import { api } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/constants";

interface Commission {
  id: string;
  status: "PENDING" | "APPROVED" | "CANCELLED";
  source: "REF" | "COUPON";
  baseAmount: string;
  rate: string;
  commissionAmount: string;
  createdAt: string;
  approvedAt: string | null;
  cancelledAt: string | null;
  cancelReason: string | null;
  order: { number: string; createdAt: string };
  productName: string;
  quantity: number;
}

interface Response {
  data: Commission[];
  meta: { total: number; page: number; perPage: number; lastPage: number };
}

interface Props {
  endpoint: string;
  title?: string;
}

const STATUS_TABS: Array<{
  value: "" | "PENDING" | "APPROVED" | "CANCELLED";
  label: string;
}> = [
  { value: "", label: "Tất cả" },
  { value: "PENDING", label: "Chờ xử lý" },
  { value: "APPROVED", label: "Chờ duyệt" },
  { value: "CANCELLED", label: "Đã hủy" },
];

export function AffiliateCommissionsList({
  endpoint,
  title = "Hoa hồng",
}: Props) {
  const [status, setStatus] = useState<
    "" | "PENDING" | "APPROVED" | "CANCELLED"
  >("");
  const [page, setPage] = useState(1);
  const PER_PAGE = 20;

  const { data, isLoading, error } = useQuery<Response>({
    queryKey: ["affiliate-commissions", endpoint, status, page],
    queryFn: async () => {
      const { data } = await api.get<Response>(endpoint, {
        params: { status: status || undefined, page, perPage: PER_PAGE },
      });
      return data;
    },
  });

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold flex items-center gap-2">
          <DollarSign className="h-5 w-5 text-emerald-400" />
          {title}
        </h2>
      </div>

      <div className="flex gap-1 border-b border-white/10">
        {STATUS_TABS.map((t) => (
          <button
            key={t.value}
            onClick={() => {
              setStatus(t.value);
              setPage(1);
            }}
            className={`px-4 py-2 text-sm border-b-2 transition-colors ${
              status === t.value
                ? "border-cyan text-cyan"
                : "border-transparent text-muted-foreground hover:text-white"
            }`}
          >
            {t.label}
          </button>
        ))}
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
          Chưa có hoa hồng{status ? ` ${status.toLowerCase()}` : ""} nào.
        </div>
      )}

      {data && data.data.length > 0 && (
        <div className="rounded-2xl border border-purple/25 bg-ink-soft overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-ink/50 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="text-left px-4 py-3 font-medium">Đơn hàng</th>
                <th className="text-left px-4 py-3 font-medium">Sản phẩm</th>
                <th className="text-left px-4 py-3 font-medium">Cơ sở</th>
                <th className="text-left px-4 py-3 font-medium">Thuế</th>
                <th className="text-left px-4 py-3 font-medium">Hoa hồng</th>
                <th className="text-left px-4 py-3 font-medium">Trạng thái</th>
                <th className="text-left px-4 py-3 font-medium">Ngày</th>
              </tr>
            </thead>
            <tbody>
              {data.data.map((c) => (
                <tr
                  key={c.id}
                  className="border-t border-purple/15 hover:bg-ink/30"
                >
                  <td className="px-4 py-3 font-mono text-xs text-cyan">
                    {c.order.number}
                  </td>
                  <td className="px-4 py-3">
                    <span className="line-clamp-1 max-w-[200px]">
                      {c.productName}
                    </span>
                    {c.quantity > 1 && (
                      <span className="text-xs text-muted-foreground">
                        {" "}
                        × {c.quantity}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {formatCurrency(Number(c.baseAmount))}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{c.rate}%</td>
                  <td className="px-4 py-3 font-semibold text-emerald-400">
                    {formatCurrency(Number(c.commissionAmount))}
                  </td>
                  <td className="px-4 py-3">
                    {c.status === "PENDING" && (
                      <span className="inline-flex items-center gap-1 text-amber-400 text-xs font-medium">
                        <Clock className="h-3 w-3" />
                        Chờ xử lý
                      </span>
                    )}
                    {c.status === "APPROVED" && (
                      <span className="inline-flex items-center gap-1 text-emerald-400 text-xs font-medium">
                        <CheckCircle2 className="h-3 w-3" />
                        Chờ duyệt
                      </span>
                    )}
                    {c.status === "CANCELLED" && (
                      <span
                        className="inline-flex items-center gap-1 text-red-400 text-xs font-medium"
                        title={c.cancelReason ?? ""}
                      >
                        <XCircle className="h-3 w-3" />
                        Đã hủy
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    {new Date(c.createdAt).toLocaleDateString("vi-VN")}
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
