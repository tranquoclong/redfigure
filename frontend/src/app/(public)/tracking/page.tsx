"use client";
import type { ApiRecord } from "@/types/api";

import { useState } from "react";
import { Search, CheckCircle, Circle } from "lucide-react";
import { formatDate, formatDateTime } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { api } from "@/lib/api-client";

const STATUS_ORDER = [
  "PENDING",
  "CONFIRMED",
  "PROCESSING",
  "SHIPPED",
  "DELIVERED",
];
const STATUS_LABELS: Record<string, string> = {
  PENDING: "Chờ xử lý",
  CONFIRMED: "Đã xác nhận",
  PROCESSING: "Đang xử lý",
  SHIPPED: "Đang giao hàng",
  DELIVERED: "Đã giao hàng",
  CANCELLED: "Đã hủy",
};

export default function TrackingPage() {
  const [orderNumber, setOrderNumber] = useState("");
  const [email, setEmail] = useState("");
  const [order, setOrder] = useState<ApiRecord | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setOrder(null);
    setLoading(true);

    try {
      const { data } = await api.post(
        `/orders/track/${orderNumber.toUpperCase()}`,
        { email: email.trim() },
      );
      setOrder(data);
    } catch {
      setError(
        "Không tìm thấy đơn hàng. Vui lòng kiểm tra số đơn hàng và email.",
      );
    } finally {
      setLoading(false);
    }
  }

  const currentIndex = order ? STATUS_ORDER.indexOf(order.status) : -1;

  return (
    <div className="mx-auto max-w-2xl px-4 sm:px-6 lg:px-8 py-16">
      <h1 className="text-3xl font-bold mb-2">Theo dõi đơn hàng</h1>
      <p className="text-muted-foreground mb-8">
        Nhập số đơn hàng và email đã sử dụng khi mua hàng.
      </p>

      <form onSubmit={handleSearch} className="space-y-4 mb-8">
        <div className="space-y-2">
          <Label htmlFor="orderNumber">Mã đơn hàng</Label>
          <Input
            id="orderNumber"
            placeholder="ABCD1234"
            value={orderNumber}
            onChange={(e) => setOrderNumber(e.target.value)}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            placeholder="user@gmail.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>
        <Button type="submit" className="w-full" disabled={loading}>
          <Search className="h-4 w-4 mr-2" />
          {loading ? "Đang tìm..." : "Theo dõi"}
        </Button>
      </form>

      {error && <p className="text-sm text-destructive mb-4">{error}</p>}

      {order && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="font-mono">{order.number}</CardTitle>
              <Badge>{STATUS_LABELS[order.status] ?? order.status}</Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              Ngày tạo: {formatDate(order.createdAt)}
            </p>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-1 mb-6">
              {STATUS_ORDER.map((status, i) => {
                const reached = i <= currentIndex;
                return (
                  <div key={status} className="flex items-center gap-1 flex-1">
                    {reached ? (
                      <CheckCircle className="h-5 w-5 text-primary shrink-0" />
                    ) : (
                      <Circle className="h-5 w-5 text-muted-foreground/30 shrink-0" />
                    )}
                    <span
                      className={`text-xs ${reached ? "font-medium" : "text-muted-foreground"}`}
                    >
                      {STATUS_LABELS[status]}
                    </span>
                    {i < STATUS_ORDER.length - 1 && (
                      <div
                        className={`flex-1 h-0.5 ${i < currentIndex ? "bg-primary" : "bg-muted"}`}
                      />
                    )}
                  </div>
                );
              })}
            </div>

            {order.trackingCode && (
              <p className="text-sm">
                Mã vận đơn:{" "}
                <span className="font-mono font-medium">
                  {order.trackingCode}
                </span>
              </p>
            )}

            {order.statusHistory?.length > 0 && (
              <div className="mt-6 space-y-3">
                <h3 className="text-sm font-medium">Lịch sử</h3>
                {order.statusHistory.map((entry: ApiRecord, i: number) => (
                  <div key={i} className="flex items-start gap-3 text-sm">
                    <div className="w-2 h-2 rounded-full bg-primary mt-1.5 shrink-0" />
                    <div>
                      <p>{STATUS_LABELS[entry.toStatus] ?? entry.toStatus}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatDateTime(entry.createdAt)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
