"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import { formatDateTime } from "@/lib/constants";
import { cn } from "@/lib/utils";

export interface CheckoutLogEntry {
  id: string;
  step: string;
  status: "success" | "error";
  orderId?: string | null;
  userId?: string | null;
  method?: string | null;
  request?: string | null;
  response?: string | null;
  error?: string | null;
  duration?: number | null;
  ip?: string | null;
  userAgent?: string | null;
  metadata?: string | null;
  createdAt: string;
}

const STEP_LABEL: Record<string, string> = {
  pricing_computed: "Tính toán giá",
  stock_validated: "Kho hàng đã xác thực",
  order_persisted: "Đã tạo đơn hàng",
  create_order: "Tạo đơn hàng",
  status_transition: "Chuyển đổi trạng thái",
  email_enqueued: "Đã gửi email",

  create_payment: "Tạo thanh toán",
  payment_reconciliation: "Đối chiếu thanh toán",
  payment_reconciliation_resolved: "Đối chiếu thanh toán đã giải quyết",
  gateway_qr_created: "Thanh toán bằng mã QR đã tạo tại cổng thanh toán",
  gateway_card_created: "Thẻ đã xử lý tại cổng thanh toán",
  payment_webhook: "Webhook cổng thanh toán",
};

const MAX_PARSE_BYTES = 50_000;

function safeParseJson(raw: string | null | undefined): unknown {
  if (!raw) return null;
  if (raw.length > MAX_PARSE_BYTES) {
    return {
      __truncated: true,
      reason: `Dữ liệu quá lớn (${raw.length} bytes) — xem trước:`,
      preview: raw.slice(0, 1000),
    };
  }
  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
}

interface Props {
  orderId: string;
}

export function CheckoutLogList({ orderId }: Props) {
  const { data, isLoading, error } = useQuery<{ data: CheckoutLogEntry[] }>({
    queryKey: ["admin", "order", orderId, "logs"],
    queryFn: async () => {
      const res = await api.get(`/payments/${orderId}/logs`);
      return res.data;
    },
  });
  const [filterErrors, setFilterErrors] = useState(false);

  if (isLoading) {
    return <p className="text-sm text-muted-foreground">Đang tải nhật ký...</p>;
  }
  if (error) {
    return (
      <p className="text-sm text-red-400">
        Lỗi khi tải nhật ký: {(error as Error).message}
      </p>
    );
  }

  const logs = data?.data ?? [];
  const filtered = filterErrors
    ? logs.filter((l) => l.status === "error")
    : logs;
  const errorCount = logs.filter((l) => l.status === "error").length;

  if (logs.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Chưa có nhật ký nào được ghi.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground">
          {logs.length} nhật ký
          {errorCount > 0 && (
            <span className="text-red-400"> · {errorCount} lỗi</span>
          )}
        </span>
        {errorCount > 0 && (
          <button
            type="button"
            onClick={() => setFilterErrors((v) => !v)}
            className="rounded border border-white/10 px-2 py-0.5 text-xs hover:bg-white/5"
          >
            {filterErrors ? "Xem tất cả" : "Chỉ xem lỗi"}
          </button>
        )}
      </div>

      <div className="space-y-2">
        {filtered.map((log) => {
          const meta = safeParseJson(log.metadata);
          const req = safeParseJson(log.request);
          const res = safeParseJson(log.response);
          const hasDetails = !!(meta || req || res || log.error);

          return (
            <details
              key={log.id}
              className={cn(
                "rounded-lg border bg-white/[0.02]",
                log.status === "error"
                  ? "border-red-500/30"
                  : "border-white/10",
              )}
            >
              <summary
                className={cn(
                  "cursor-pointer select-none list-none px-4 py-2",
                  hasDetails && "hover:bg-white/[0.04]",
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 text-sm">
                      <span
                        className={cn(
                          "inline-block w-2 h-2 rounded-full shrink-0",
                          log.status === "error"
                            ? "bg-red-500"
                            : "bg-emerald-500",
                        )}
                      />
                      <span className="font-medium">
                        {STEP_LABEL[log.step] ?? log.step}
                      </span>
                      {log.method && (
                        <span className="rounded border border-cyan/30 bg-cyan/10 px-1.5 py-0.5 text-[10px] uppercase text-cyan">
                          {log.method}
                        </span>
                      )}
                      {log.duration !== undefined && log.duration !== null && (
                        <span className="text-[11px] text-muted-foreground">
                          {log.duration}ms
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      {formatDateTime(log.createdAt)}
                      {log.ip && ` · ${log.ip}`}
                    </p>
                    {log.error && (
                      <p className="text-xs text-red-400 mt-1 break-all">
                        {log.error.split("\n")[0]}
                      </p>
                    )}
                  </div>
                  {hasDetails && (
                    <span className="text-xs text-muted-foreground">▼</span>
                  )}
                </div>
              </summary>
              {hasDetails && (
                <div className="border-t border-white/10 p-3 text-xs space-y-3">
                  {meta != null && <Section label="Metadata" data={meta} />}
                  {req != null && <Section label="Request" data={req} />}
                  {res != null && <Section label="Response" data={res} />}
                  {log.error && (
                    <div>
                      <p className="font-medium text-red-400 mb-1">Lỗi</p>
                      <pre className="overflow-x-auto rounded bg-black/30 p-2 text-[11px] text-red-300 whitespace-pre-wrap">
                        {log.error}
                      </pre>
                    </div>
                  )}
                </div>
              )}
            </details>
          );
        })}
      </div>
    </div>
  );
}

function Section({ label, data }: { label: string; data: unknown }) {
  return (
    <div>
      <p className="font-medium mb-1">{label}</p>
      <pre className="overflow-x-auto rounded bg-black/30 p-2 text-[11px] text-muted-foreground">
        {typeof data === "string" ? data : JSON.stringify(data, null, 2)}
      </pre>
    </div>
  );
}
