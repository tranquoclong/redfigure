"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { api } from "@/lib/api-client";
import { formatDateTime } from "@/lib/constants";
import { EmptyState } from "@/components/shared/empty-state";
import { FileText, ExternalLink, Clock } from "lucide-react";

type CustomQuoteStatus =
  | "REQUESTED"
  | "DRAFT"
  | "SENT"
  | "PARTIALLY_ACCEPTED"
  | "FULLY_ACCEPTED"
  | "EXPIRED"
  | "CANCELLED";

interface MyQuote {
  id: string;
  number: string;
  status: CustomQuoteStatus;
  token: string;
  expiresAt: string;
  sentAt: string | null;
  acceptedAt: string | null;
  createdAt: string;
  updatedAt: string;
  itemsCount: number;
}

const STATUS_LABEL: Record<CustomQuoteStatus, string> = {
  REQUESTED: "Đã yêu cầu",
  DRAFT: "Đang xử lý",
  SENT: "Sẵn sàng cho bạn",
  PARTIALLY_ACCEPTED: "Đã mua một phần",
  FULLY_ACCEPTED: "Đã mua tất cả",
  EXPIRED: "Hết hạn",
  CANCELLED: "Đã hủy",
};

const STATUS_COLOR: Record<CustomQuoteStatus, string> = {
  REQUESTED: "bg-amber-500/20 text-amber-300 border-amber-500/40",
  DRAFT: "bg-purple-500/20 text-purple-300 border-purple-500/40",
  SENT: "bg-cyan-500/20 text-cyan-300 border-cyan-500/40",
  PARTIALLY_ACCEPTED: "bg-blue-500/20 text-blue-300 border-blue-500/40",
  FULLY_ACCEPTED: "bg-emerald-500/20 text-emerald-300 border-emerald-500/40",
  EXPIRED: "bg-white/10 text-white/40 border-white/20",
  CANCELLED: "bg-rose-500/20 text-rose-300 border-rose-500/40",
};

const STATUS_HINT: Record<CustomQuoteStatus, string> = {
  REQUESTED:
    "Đã nhận yêu cầu của bạn. Chúng tôi sẽ gửi báo giá tùy chỉnh trong thời gian sớm nhất.",
  DRAFT: "Chúng tôi đang chuẩn bị báo giá cho bạn.",
  SENT: "Báo giá sẵn sàng. Truy cập liên kết để xem lại và hoàn tất.",
  PARTIALLY_ACCEPTED:
    "Bạn đã mua một số mặt hàng. Số còn lại sẽ có sẵn cho đến khi hết hạn.",
  FULLY_ACCEPTED: "Bạn đã mua tất cả các mặt hàng trong báo giá này.",
  EXPIRED: "Báo giá này đã hết hạn.",
  CANCELLED: "Báo giá này đã bị hủy.",
};

const VIEWABLE_STATUSES: ReadonlySet<CustomQuoteStatus> = new Set([
  "SENT",
  "PARTIALLY_ACCEPTED",
  "FULLY_ACCEPTED",
]);

function daysUntil(expiresAt: string): { days: number; expired: boolean } {
  const ms = new Date(expiresAt).getTime() - Date.now();
  if (ms <= 0) return { days: 0, expired: true };
  return { days: Math.ceil(ms / (1000 * 60 * 60 * 24)), expired: false };
}

export default function MyQuotesPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["my-quotes"],
    queryFn: async () => {
      const { data } = await api.get("/custom-quotes/me", {
        params: { perPage: 50 },
      });
      return data as { data: MyQuote[]; meta: { total: number } };
    },
  });

  if (isLoading) {
    return <p className="text-white/50">Đang tải báo giá...</p>;
  }

  const quotes = data?.data ?? [];

  if (quotes.length === 0) {
    return (
      <div>
        <h1 className="text-2xl font-bold text-white mb-6">Báo giá</h1>
        <EmptyState
          title="Chưa có báo giá"
          description="Bạn có thể yêu cầu báo giá tùy chỉnh cho in mô hình."
        />
        <div className="flex justify-center mt-4">
          <Link
            href="/quote"
            className="inline-flex items-center gap-2 rounded-md bg-cyan/20 hover:bg-cyan/30 text-cyan px-4 py-2 text-sm transition-colors"
          >
            <FileText className="h-4 w-4" />
            Yêu cầu báo giá
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-start justify-between gap-4 mb-6 flex-wrap">
        <h1 className="text-2xl font-bold text-white">Báo giá</h1>
        <Link
          href="/quote"
          className="inline-flex items-center gap-2 rounded-md bg-cyan/20 hover:bg-cyan/30 text-cyan px-3 py-1.5 text-xs transition-colors"
        >
          <FileText className="h-3.5 w-3.5" />
          Yêu cầu báo giá mới
        </Link>
      </div>

      <div className="space-y-3">
        {quotes.map((q) => {
          const label = STATUS_LABEL[q.status];
          const color = STATUS_COLOR[q.status];
          const hint = STATUS_HINT[q.status];
          const { days, expired } = daysUntil(q.expiresAt);
          const viewable = VIEWABLE_STATUSES.has(q.status) && !expired;

          return (
            <div
              key={q.id}
              className="border border-white/10 rounded-xl p-4 hover:border-white/20 hover:bg-white/[0.02] transition-all"
            >
              <div className="flex items-center gap-2 flex-wrap mb-2">
                <p className="font-medium text-sm font-mono text-white">
                  #{q.number}
                </p>
                <span
                  className={`rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider ${color}`}
                >
                  {label}
                </span>
                <span className="text-[10px] text-white/40 ml-auto">
                  {q.itemsCount} Mô hình
                </span>
              </div>

              <p className="text-xs text-white/60 mb-3">{hint}</p>

              <div className="flex items-center gap-4 flex-wrap text-xs text-white/50">
                <span>Đã yêu cầu {formatDateTime(q.createdAt)}</span>
                {q.sentAt && <span>Đã gửi {formatDateTime(q.sentAt)}</span>}
                <span
                  className={`flex items-center gap-1 ${expired ? "text-rose-400" : days <= 3 ? "text-amber-400" : "text-white/50"}`}
                >
                  <Clock className="h-3 w-3" />
                  {expired
                    ? "Hết hạn"
                    : `Còn ${days} ${days === 1 ? "ngày" : "ngày"} nữa (đến ${formatDateTime(q.expiresAt)})`}
                </span>
              </div>

              {viewable && (
                <div className="mt-3">
                  <Link
                    href={`/quote/${q.token}`}
                    className="inline-flex items-center gap-1.5 text-xs text-cyan hover:text-cyan/80 transition-colors"
                  >
                    <ExternalLink className="h-3 w-3" />
                    Xem báo giá và hoàn tất
                  </Link>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
