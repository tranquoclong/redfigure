"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Trash2 } from "lucide-react";

interface DeleteOrderButtonProps {
  status: string;
  onConfirm: () => void;
  loading?: boolean;
}

const ALLOWED_STATUSES = new Set(["PENDING", "CANCELLED"]);

export function DeleteOrderButton({
  status,
  onConfirm,
  loading,
}: DeleteOrderButtonProps) {
  const [open, setOpen] = useState(false);
  const allowed = ALLOWED_STATUSES.has(status);

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        disabled={!allowed || loading}
        onClick={() => setOpen(true)}
        title={
          allowed
            ? "Gửi vào thùng rác"
            : "Chỉ đơn PENDING hoặc CANCELLED mới có thể cho vào thùng rác"
        }
        className="text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 disabled:opacity-30"
      >
        <Trash2 className="h-4 w-4 mr-2" />
        Gửi vào thùng rác
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Gửi vào thùng rác?</DialogTitle>
            <DialogDescription>
              Đơn hàng sẽ được gửi vào thùng rác và ẩn khỏi danh sách (admin và
              khách hàng). Bạn có thể khôi phục trong vòng 30 ngày. Sau thời
              gian này, đơn hàng sẽ bị xóa vĩnh viễn.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={loading}
            >
              Hủy
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                onConfirm();
                setOpen(false);
              }}
              disabled={loading}
            >
              {loading ? "Gửi…" : "Xác nhận"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
