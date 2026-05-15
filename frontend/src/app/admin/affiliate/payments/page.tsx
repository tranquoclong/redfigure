"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { DollarSign, Loader2, AlertCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/lib/api-client";
import { formatCurrency } from "@/lib/constants";

interface PendingRequest {
  id: string;
  affiliateId: string;
  amountRequested: string;
  amountPaid: string;
  status: string;
  requestedAt: string;
  affiliate: {
    id: string;
    publicId: number;
    user: { name: string | null; email: string };
  };
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString("vi-VN", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

export default function AdminPaymentsAffiliatePage() {
  const queryClient = useQueryClient();
  const [payModalReq, setPayModalReq] = useState<PendingRequest | null>(null);
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);

  const { data, isLoading } = useQuery<PendingRequest[]>({
    queryKey: ["admin", "affiliate-payment-requests", "pending"],
    queryFn: async () => {
      const { data } = await api.get(
        "/admin/affiliates/payment-requests/pending",
      );
      return data.data;
    },
  });

  const recordPayment = useMutation({
    mutationFn: async (params: {
      affiliateId: string;
      amount: number;
      note: string;
      paymentRequestId: string;
    }) => {
      const { data } = await api.post(
        `/admin/affiliates/${params.affiliateId}/payments`,
        {
          amount: params.amount,
          paidAt: new Date().toISOString(),
          note: params.note || undefined,
          paymentRequestId: params.paymentRequestId,
        },
      );
      return data.data;
    },
    onSuccess: () => {
      setPayModalReq(null);
      setAmount("");
      setNote("");
      setError(null);
      queryClient.invalidateQueries({
        queryKey: ["admin", "affiliate-payment-requests"],
      });
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
        resp?.error?.message ?? resp?.message ?? "Lỗi khi ghi nhận thanh toán.",
      );
    },
  });

  const cancelRequest = useMutation({
    mutationFn: async (params: { id: string; reason: string }) => {
      await api.post(`/admin/affiliates/payment-requests/${params.id}/cancel`, {
        reason: params.reason,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["admin", "affiliate-payment-requests"],
      });
    },
  });

  const openPayModal = (req: PendingRequest) => {
    const remaining = Number(req.amountRequested) - Number(req.amountPaid ?? 0);
    setPayModalReq(req);
    setAmount(remaining.toFixed(2));
    setNote("");
    setError(null);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <DollarSign className="h-8 w-8 text-emerald-500" />
        <div>
          <h1 className="text-3xl font-bold">Thanh toán CTV</h1>
          <p className="text-sm text-muted-foreground">
            Yêu cầu thanh toán PENDING đang chờ thanh toán thủ công.
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Yêu cầu thanh toán ({data?.length ?? 0})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Đang tải...</p>
          ) : !data || data.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Không có yêu cầu thanh toán nào.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-xs uppercase text-muted-foreground border-b border-white/10">
                  <tr>
                    <th className="text-left py-2 px-2">CTV</th>
                    <th className="text-left py-2 px-2">Yêu cầu</th>
                    <th className="text-right py-2 px-2">Tổng</th>
                    <th className="text-right py-2 px-2">Đã thanh toán</th>
                    <th className="text-center py-2 px-2 w-48">Hành động</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {data.map((req) => (
                    <tr key={req.id}>
                      <td className="py-2 px-2">
                        <p className="font-medium">
                          #{req.affiliate.publicId}{" "}
                          {req.affiliate.user.name ?? "—"}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {req.affiliate.user.email}
                        </p>
                      </td>
                      <td className="py-2 px-2 text-muted-foreground">
                        {formatDate(req.requestedAt)}
                      </td>
                      <td className="text-right py-2 px-2 font-medium">
                        {formatCurrency(Number(req.amountRequested))}
                      </td>
                      <td className="text-right py-2 px-2 text-cyan">
                        {formatCurrency(Number(req.amountPaid ?? 0))}
                      </td>
                      <td className="text-center py-2 px-2">
                        <div className="flex gap-2 justify-center">
                          <Button size="sm" onClick={() => openPayModal(req)}>
                            Ghi nhận thanh toán
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              const reason =
                                prompt("Lý do hủy thanh toán?") ?? "";
                              if (reason.trim()) {
                                cancelRequest.mutate({
                                  id: req.id,
                                  reason: reason.trim(),
                                });
                              }
                            }}
                            disabled={cancelRequest.isPending}
                          >
                            Hủy
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <PaymentHistoryCard />

      <Dialog
        open={!!payModalReq}
        onOpenChange={(open) => {
          if (!open) setPayModalReq(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ghi nhận thanh toán</DialogTitle>
            <DialogDescription>
              Xác nhận thanh toán bên ngoài đã được thực hiện . Số dư của CTV sẽ
              được trừ vào ví.
            </DialogDescription>
          </DialogHeader>
          {payModalReq && (
            <div className="space-y-4">
              <div className="text-sm">
                <p>
                  <strong>CTV:</strong> #{payModalReq.affiliate.publicId}{" "}
                  {payModalReq.affiliate.user.name ?? "—"}
                </p>
                <p className="text-muted-foreground">
                  Yêu cầu {formatCurrency(Number(payModalReq.amountRequested))}{" "}
                  vào {formatDate(payModalReq.requestedAt)}.
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="amount">Số tiền đã thanh toán (VND)</Label>
                <Input
                  id="amount"
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="note">Ghi chú (tùy chọn)</Label>
                <Textarea
                  id="note"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Ghi chú giao dịch..."
                  maxLength={500}
                />
              </div>
              {error && (
                <div className="flex gap-2 text-sm text-destructive bg-destructive/10 border border-destructive/30 rounded-md px-3 py-2">
                  <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setPayModalReq(null)}
              disabled={recordPayment.isPending}
            >
              Hủy
            </Button>
            <Button
              onClick={() => {
                if (!payModalReq) return;
                const amt = parseFloat(amount);
                if (!Number.isFinite(amt) || amt <= 0) {
                  setError("Số tiền không hợp lệ.");
                  return;
                }
                recordPayment.mutate({
                  affiliateId: payModalReq.affiliateId,
                  amount: amt,
                  note,
                  paymentRequestId: payModalReq.id,
                });
              }}
              disabled={recordPayment.isPending}
            >
              {recordPayment.isPending && (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              )}
              Xác nhận thanh toán
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

interface PaymentHistoryRow {
  id: string;
  amount: string;
  note: string | null;
  paidAt: string;
  createdByUserId: string;
  affiliate: {
    id: string;
    publicId: number;
    name: string | null;
    email: string;
  };
  paymentRequest: {
    id: string;
    amountRequested: string;
    status: string;
  } | null;
}

function PaymentHistoryCard() {
  const [page, setPage] = useState(1);
  const PER_PAGE = 25;

  const { data, isLoading } = useQuery<{
    data: PaymentHistoryRow[];
    meta: { total: number; page: number; perPage: number; lastPage: number };
  }>({
    queryKey: ["admin", "affiliate-payments-history", page],
    queryFn: async () => {
      const { data } = await api.get(
        "/admin/affiliates/payment-requests/history",
        {
          params: { page, perPage: PER_PAGE },
        },
      );
      return data;
    },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">
          Lịch sử thanh toán ({data?.meta.total ?? 0})
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Đang tải...</p>
        ) : !data || data.data.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Chưa có thanh toán nào được ghi nhận.
          </p>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-xs uppercase text-muted-foreground border-b border-white/10">
                  <tr>
                    <th className="text-left py-2 px-2">CTV</th>
                    <th className="text-left py-2 px-2">Thanh toán</th>
                    <th className="text-right py-2 px-2">Giá trị</th>
                    <th className="text-left py-2 px-2">Ghi chú</th>
                    <th className="text-left py-2 px-2">Yêu cầu</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {data.data.map((p) => (
                    <tr key={p.id}>
                      <td className="py-2 px-2">
                        <p className="font-medium">
                          #{p.affiliate.publicId} {p.affiliate.name ?? "—"}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {p.affiliate.email}
                        </p>
                      </td>
                      <td className="py-2 px-2 text-muted-foreground">
                        {formatDate(p.paidAt)}
                      </td>
                      <td className="text-right py-2 px-2 font-semibold text-emerald-400">
                        {formatCurrency(Number(p.amount))}
                      </td>
                      <td className="py-2 px-2 text-xs text-muted-foreground max-w-[260px]">
                        <span className="line-clamp-2" title={p.note ?? ""}>
                          {p.note ?? "—"}
                        </span>
                      </td>
                      <td className="py-2 px-2 text-xs">
                        {p.paymentRequest ? (
                          <span
                            className={
                              p.paymentRequest.status === "PAID"
                                ? "text-emerald-400"
                                : p.paymentRequest.status === "PARTIALLY_PAID"
                                  ? "text-amber-400"
                                  : "text-muted-foreground"
                            }
                          >
                            {p.paymentRequest.status}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">
                            Không có yêu cầu
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {data.meta.lastPage > 1 && (
              <div className="flex items-center justify-between mt-4 text-sm">
                <span className="text-muted-foreground">
                  Trang {data.meta.page} của {data.meta.lastPage}
                </span>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page <= 1}
                  >
                    Trước
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      setPage((p) => Math.min(data.meta.lastPage, p + 1))
                    }
                    disabled={page >= data.meta.lastPage}
                  >
                    Sau
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
