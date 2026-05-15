"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Wallet,
  Clock,
  CheckCircle2,
  XCircle,
  Eye,
  ShoppingBag,
  Loader2,
  AlertCircle,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api-client";
import { formatCurrency } from "@/lib/constants";

interface Overview {
  currentBalance: number;
  pendingCommissions: number;
  approvedCommissions: number;
  cancelledCommissions: number;
  paidLifetime: number;
  visits30d: number;
  conversions30d: number;
}

interface PaymentRequest {
  id: string;
  status: "PENDING" | "PARTIALLY_PAID" | "PAID" | "CANCELLED";
  amountRequested: string;
  amountPaid: string;
  requestedAt: string;
  completedAt: string | null;
  cancelledAt: string | null;
  cancelReason: string | null;
}

export function AffiliateOverviewCard({
  minPayoutAmount = 100,
}: {
  minPayoutAmount?: number;
}) {
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const { data, isLoading } = useQuery<Overview>({
    queryKey: ["me", "affiliate", "overview"],
    queryFn: async () => {
      const { data } = await api.get("/me/affiliate/stats/overview");
      return data.data;
    },
  });

  const { data: requests } = useQuery<PaymentRequest[]>({
    queryKey: ["me", "affiliate", "payment-requests"],
    queryFn: async () => {
      const { data } = await api.get("/me/affiliate/payment-requests");
      return data.data;
    },
  });

  const pendingRequest = requests?.find((r) => r.status === "PENDING");

  const createRequest = useMutation({
    mutationFn: async () => {
      const { data } = await api.post("/me/affiliate/payment-requests");
      return data.data;
    },
    onSuccess: () => {
      setConfirmOpen(false);
      setError(null);
      queryClient.invalidateQueries({ queryKey: ["me", "affiliate"] });
    },
    onError: (err: unknown) => {
      const resp = (
        err as {
          response?: {
            data?: { error?: { message?: string }; message?: string };
          };
        }
      )?.response?.data;
      setError(
        resp?.error?.message ??
          resp?.message ??
          "Không thể yêu cầu thanh toán.",
      );
    },
  });

  const cancelRequest = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/me/affiliate/payment-requests/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["me", "affiliate"] });
    },
  });

  if (isLoading) {
    return (
      <div className="rounded-2xl border border-white/10 bg-ink-soft p-6 text-sm text-muted-foreground">
        Đang tải thông tin...
      </div>
    );
  }

  if (!data) return null;

  const canRequestPayout =
    data.currentBalance >= minPayoutAmount && !pendingRequest;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs uppercase text-muted-foreground flex items-center gap-2">
              <Wallet className="h-4 w-4 text-emerald-500" />
              Số dư khả dụng
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-500">
              {formatCurrency(data.currentBalance)}
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">
              Rút tối thiểu: {formatCurrency(minPayoutAmount)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs uppercase text-muted-foreground flex items-center gap-2">
              <Clock className="h-4 w-4 text-amber-400" />
              Chờ xử lý
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(data.pendingCommissions)}
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">
              Chờ 7 ngày sau khi giao hàng
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs uppercase text-muted-foreground flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-cyan" />
              Chờ duyệt
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(data.approvedCommissions)}
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">
              Chờ duyệt thanh toán
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs uppercase text-muted-foreground flex items-center gap-2">
              <XCircle className="h-4 w-4 text-rose-400" />
              Đã hủy
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(data.cancelledCommissions)}
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">Đã hủy</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs uppercase text-muted-foreground flex items-center gap-2">
              <Wallet className="h-4 w-4 text-purple" />
              Tổng thu nhập
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xl font-semibold">
              {formatCurrency(data.paidLifetime)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs uppercase text-muted-foreground flex items-center gap-2">
              <Eye className="h-4 w-4 text-cyan" />
              Lượt truy cập (30 ngày)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xl font-semibold">
              {data.visits30d.toLocaleString("vi-VN")}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs uppercase text-muted-foreground flex items-center gap-2">
              <ShoppingBag className="h-4 w-4 text-emerald-500" />
              Đơn hàng (30 ngày)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xl font-semibold">
              {data.conversions30d.toLocaleString("vi-VN")}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="rounded-2xl border border-white/10 bg-ink-soft p-5 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex-1 min-w-0">
            <p className="font-semibold">Yêu cầu thanh toán</p>
            <p className="text-xs text-muted-foreground">
              {pendingRequest
                ? `Đã yêu cầu thanh toán: ${formatCurrency(Number(pendingRequest.amountRequested))}`
                : data.currentBalance < minPayoutAmount
                  ? `Cần đạt ${formatCurrency(minPayoutAmount)} để yêu cầu thanh toán.`
                  : "Đã đạt mức tối thiểu và có thể yêu cầu thanh toán."}
            </p>
          </div>
          {pendingRequest ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => cancelRequest.mutate(pendingRequest.id)}
              disabled={cancelRequest.isPending}
            >
              {cancelRequest.isPending && (
                <Loader2 className="h-3 w-3 mr-1 animate-spin" />
              )}
              Hủy yêu cầu thanh toán
            </Button>
          ) : (
            <Button
              onClick={() => {
                setError(null);
                setConfirmOpen(true);
              }}
              disabled={!canRequestPayout}
            >
              Yêu cầu thanh toán
            </Button>
          )}
        </div>

        {confirmOpen && !pendingRequest && (
          <div className="rounded-md border border-cyan/25 bg-ink p-4 space-y-3">
            <p className="text-sm">
              Bạn có chắc chắn muốn yêu cầu thanh toán số tiền{" "}
              <strong className="text-emerald-400">
                {formatCurrency(data.currentBalance)}
              </strong>
              ? Quản trị viên sẽ được thông báo và xử lý thủ công.
            </p>
            {error && (
              <div className="flex gap-2 text-sm text-destructive bg-destructive/10 border border-destructive/30 rounded-md px-3 py-2">
                <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}
            <div className="flex gap-2 justify-end">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setConfirmOpen(false)}
                disabled={createRequest.isPending}
              >
                Hủy
              </Button>
              <Button
                size="sm"
                onClick={() => createRequest.mutate()}
                disabled={createRequest.isPending}
              >
                {createRequest.isPending && (
                  <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                )}
                Xác nhận
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
