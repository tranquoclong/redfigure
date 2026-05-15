"use client";

import { formatDateTime } from "@/lib/constants";

export interface PaymentEvent {
  id: string;
  type: string;
  rawData: unknown;
  mpStatus?: string | null;
  mpStatusDetail?: string | null;
  createdAt: string;
}

const TYPE_LABEL: Record<string, string> = {
  create_qr: "Tạo QR",
  create_credit_card: "Tạo thẻ",
  webhook: "Webhook nhận",
  double_check: "Kiểm tra lại",
  refund: "Hoàn tiền",
};

interface PaymentEventListProps {
  events: PaymentEvent[];
}

export function PaymentEventList({ events }: PaymentEventListProps) {
  if (events.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Chưa có sự kiện nào được ghi nhận.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {events.map((event) => (
        <details
          key={event.id}
          className="rounded-lg border border-white/10 bg-white/[0.02]"
        >
          <summary className="cursor-pointer select-none list-none px-4 py-3 hover:bg-white/[0.04]">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 text-sm">
                  <span className="font-medium">
                    {TYPE_LABEL[event.type] ?? event.type}
                  </span>
                  {event.mpStatus && (
                    <span className="rounded border border-cyan/30 bg-cyan/10 px-2 py-0.5 text-xs text-cyan">
                      {event.mpStatus}
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {formatDateTime(event.createdAt)}
                  {event.mpStatusDetail && ` · ${event.mpStatusDetail}`}
                </p>
              </div>
              <span className="text-xs text-muted-foreground">▼</span>
            </div>
          </summary>
          <pre className="overflow-x-auto border-t border-white/10 p-4 text-xs text-muted-foreground">
            {JSON.stringify(event.rawData, null, 2)}
          </pre>
        </details>
      ))}
    </div>
  );
}
