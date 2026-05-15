"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { statusLabel, type OrderStatus } from "./order-status-pills";

interface OrderStatusChangeModalProps {
  open: boolean;
  fromStatus: string;
  toStatus: OrderStatus | null;
  loading?: boolean;
  reason: string;
  onReasonChange: (r: string) => void;
  onConfirm: () => void;
  onCancel: () => void;
}

function requiresReason(status: OrderStatus | null): boolean {
  return status === "CANCELLED" || status === "RETURNED";
}

export function OrderStatusChangeModal({
  open,
  fromStatus,
  toStatus,
  loading,
  reason,
  onReasonChange,
  onConfirm,
  onCancel,
}: OrderStatusChangeModalProps) {
  const needsReason = requiresReason(toStatus);
  const reasonMissing = needsReason && reason.trim().length === 0;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onCancel()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Thay đổi trạng thái đơn hàng?</DialogTitle>
          <DialogDescription>
            Từ trạng thái: <strong>{statusLabel(fromStatus)}</strong> sang trạng
            thái: <strong>{toStatus ? statusLabel(toStatus) : "—"}</strong>.
            <br />
            Khách hàng sẽ được thông báo qua email tự động.
          </DialogDescription>
        </DialogHeader>

        {needsReason && (
          <div className="grid gap-2 py-2">
            <Label htmlFor="status-reason">
              Lý do <span className="text-destructive">*</span>
            </Label>
            <Textarea
              id="status-reason"
              placeholder={
                toStatus === "CANCELLED"
                  ? "Ví dụ: Hết hàng, khách hàng yêu cầu hủy, v.v."
                  : "Ví dụ: Sản phẩm bị hỏng khi giao hàng, khách hàng yêu cầu trả lại, v.v."
              }
              value={reason}
              onChange={(e) => onReasonChange(e.target.value)}
              maxLength={500}
              rows={3}
              disabled={loading}
              autoFocus
            />
            <p className="text-xs text-muted-foreground">
              Lời giải thích này được bao gồm trực tiếp trong email mà khách
              hàng nhận được.
            </p>
          </div>
        )}

        <DialogFooter>
          <Button
            variant="outline"
            className="rounded-md"
            onClick={onCancel}
            disabled={loading}
          >
            Hủy
          </Button>
          <Button
            onClick={onConfirm}
            className="rounded-md"
            disabled={loading || !toStatus || reasonMissing}
          >
            {loading ? "Đang xử lý…" : "Xác nhận"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
