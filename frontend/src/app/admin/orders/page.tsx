"use client";
import type { ApiRecord } from "@/types/api";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Pagination } from "@/components/shared/pagination";
import { statusLabel } from "@/components/admin/order-status-pills";
import { api } from "@/lib/api-client";
import { formatCurrency, formatDateTime } from "@/lib/constants";
import { Trash2, MessageCircle, Search } from "lucide-react";

const STATUSES = [
  "ALL",
  "PENDING",
  "CONFIRMED",
  "PROCESSING",
  "SHIPPED",
  "DELIVERED",
  "CANCELLED",
];

const STATUS_COLOR: Record<string, string> = {
  PENDING: "bg-amber-500/20 text-amber-300 border-amber-500/40",
  CONFIRMED: "bg-blue-500/20 text-blue-300 border-blue-500/40",
  PROCESSING: "bg-purple-500/20 text-purple-300 border-purple-500/40",
  SHIPPED: "bg-cyan-500/20 text-cyan-300 border-cyan-500/40",
  DELIVERED: "bg-emerald-500/20 text-emerald-300 border-emerald-500/40",
  CANCELLED: "bg-rose-500/20 text-rose-300 border-rose-500/40",
  RETURNED: "bg-orange-500/20 text-orange-300 border-orange-500/40",
};

function buildWhatsAppUrl(
  phone: string,
  orderNumber: string,
  customerName: string,
): string {
  const digits = phone.replace(/\D/g, "");
  const fullPhone = digits.startsWith("84") ? digits : `84${digits}`;
  const text = encodeURIComponent(
    `Xin chào, ${customerName}! Về đơn hàng ${orderNumber}`,
  );
  return `https://api.whatsapp.com/send?phone=${fullPhone}&text=${text}`;
}

export default function AdminOrdersPage() {
  const router = useRouter();
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  const { data, isLoading } = useQuery({
    queryKey: ["admin", "orders", page, statusFilter, debouncedSearch],
    queryFn: async () => {
      const params: Record<string, string | number> = { page, perPage: 20 };
      if (statusFilter !== "ALL") params.status = statusFilter;
      if (debouncedSearch) params.search = debouncedSearch;
      const { data } = await api.get("/orders", { params });
      return data;
    },
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-6 gap-3 flex-wrap">
        <h1 className="text-3xl font-bold">Đơn hàng</h1>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Tìm kiếm số, khách hàng, email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 w-[240px]"
            />
          </div>
          <Link href="/admin/orders/trash">
            <Button variant="outline" size="sm">
              <Trash2 className="h-4 w-4 mr-2" />
              Thùng rác
            </Button>
          </Link>
          <Select
            value={statusFilter}
            onValueChange={(v) => {
              setStatusFilter(v ?? "ALL");
              setPage(1);
            }}
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Trạng thái" />
            </SelectTrigger>
            <SelectContent>
              {STATUSES.map((s) => (
                <SelectItem key={s} value={s}>
                  {s === "ALL" ? "Tất cả" : statusLabel(s)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {isLoading ? (
        <p className="text-muted-foreground">Đang tải...</p>
      ) : (
        <>
          <div className="border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Đơn hàng</TableHead>
                  <TableHead>Thời gian</TableHead>
                  <TableHead>Trạng thái</TableHead>
                  <TableHead>Tổng cộng</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data?.data?.map((order: ApiRecord) => {
                  const color =
                    STATUS_COLOR[order.status] ??
                    "border-white/20 text-white/60";
                  const hasPhone = !!(order.customerPhone as string);

                  return (
                    <TableRow
                      key={order.id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => router.push(`/admin/orders/${order.id}`)}
                    >
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {hasPhone && (
                            <a
                              href={buildWhatsAppUrl(
                                order.customerPhone as string,
                                order.number as string,
                                (order.customerName as string) || "Client",
                              )}
                              target="_blank"
                              rel="noopener noreferrer"
                              title="WhatsApp"
                              className="shrink-0 rounded-md bg-emerald-600 p-1.5 text-white hover:bg-emerald-500 transition-colors"
                            >
                              <MessageCircle className="h-3.5 w-3.5" />
                            </a>
                          )}
                          <div>
                            <Link
                              href={`/admin/orders/${order.id}`}
                              className="font-mono text-xs font-medium hover:text-cyan transition-colors"
                            >
                              #{order.number}
                            </Link>
                            {order.customerName && (
                              <span className="ml-2 text-xs text-muted-foreground">
                                {order.customerName as string}
                              </span>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-xs">
                        {formatDateTime(order.createdAt as string)}
                      </TableCell>
                      <TableCell>
                        <span
                          className={`inline-block rounded-full border px-3 py-1 text-[11px] font-medium uppercase tracking-wider ${color}`}
                        >
                          {statusLabel(order.status as string)}
                        </span>
                      </TableCell>
                      <TableCell className="font-medium">
                        {formatCurrency(order.total as number)}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          {data?.meta && (
            <Pagination
              page={page}
              lastPage={data.meta.lastPage}
              onPageChange={setPage}
            />
          )}
        </>
      )}
    </div>
  );
}
