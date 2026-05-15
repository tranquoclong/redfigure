"use client";
import type { ApiRecord } from "@/types/api";

import { useQuery } from "@tanstack/react-query";
import { Package, DollarSign, Users, ShoppingBag } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { statusLabel } from "@/components/admin/order-status-pills";
import { api } from "@/lib/api-client";
import { formatCurrency } from "@/lib/constants";

const STATUS_COLOR: Record<string, string> = {
  PENDING: "bg-amber-500/20 text-amber-300",
  CONFIRMED: "bg-blue-500/20 text-blue-300",
  PROCESSING: "bg-purple-500/20 text-purple-300",
  SHIPPED: "bg-cyan-500/20 text-cyan-300",
  DELIVERED: "bg-emerald-500/20 text-emerald-300",
  CANCELLED: "bg-rose-500/20 text-rose-300",
  RETURNED: "bg-orange-500/20 text-orange-300",
};

export default function AdminDashboard() {
  const { data: stats } = useQuery({
    queryKey: ["admin", "dashboard"],
    queryFn: async () => {
      const { data } = await api.get("/admin/dashboard");
      return data.data;
    },
  });

  const { data: ordersByStatus } = useQuery({
    queryKey: ["admin", "orders-by-status"],
    queryFn: async () => {
      const { data } = await api.get("/admin/orders-by-status");
      return data.data;
    },
  });

  const now = new Date();
  const monthName = now.toLocaleDateString("vi-VN", { month: "long" });

  const cards = [
    {
      title: `Tổng đơn hàng (${monthName})`,
      value: stats?.totalOrders ?? 0,
      icon: ShoppingBag,
    },
    {
      title: `Tổng doanh thu (${monthName})`,
      value: formatCurrency(stats?.totalRevenue ?? 0),
      icon: DollarSign,
    },
    {
      title: "Tổng người dùng",
      value: stats?.totalUsers ?? 0,
      icon: Users,
    },
    {
      title: "Tổng sản phẩm",
      value: stats?.totalProducts ?? 0,
      icon: Package,
    },
  ];

  return (
    <div>
      <h1 className="text-3xl font-bold mb-8">Dashboard</h1>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {cards.map((card) => (
          <Card key={card.title}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {card.title}
              </CardTitle>
              <card.icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{card.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">
            Tổng đơn hàng theo trạng thái ({monthName})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {ordersByStatus ? (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {ordersByStatus.map((item: ApiRecord) => {
                const color =
                  STATUS_COLOR[item.status as string] ?? "bg-muted/50";
                return (
                  <div
                    key={item.status}
                    className={`text-center p-3 rounded-lg ${color}`}
                  >
                    <p className="text-2xl font-bold">{item.count}</p>
                    <p className="text-xs mt-1">
                      {statusLabel(item.status as string)}
                    </p>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-muted-foreground text-sm">Đang tải...</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
