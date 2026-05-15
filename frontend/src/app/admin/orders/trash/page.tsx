"use client";

import type { ApiRecord } from "@/types/api";

import { useState } from "react";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Pagination } from "@/components/shared/pagination";
import { api } from "@/lib/api-client";
import { formatCurrency, formatDate } from "@/lib/constants";
import { statusLabel } from "@/components/admin/order-status-pills";
import { ArrowLeft, RotateCcw } from "lucide-react";

const RETENTION_DAYS = 30;

function daysUntilHardDelete(deletedAt: string): number {
  const ms = new Date(deletedAt).getTime();
  const cutoff = ms + RETENTION_DAYS * 24 * 60 * 60 * 1000;
  const remaining = cutoff - Date.now();
  return Math.max(0, Math.ceil(remaining / (24 * 60 * 60 * 1000)));
}

export default function AdminTrashPage() {
  const [page, setPage] = useState(1);
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["admin", "orders", "trash", page],
    queryFn: async () => {
      const { data } = await api.get("/orders/trash", {
        params: { page, perPage: 20 },
      });
      return data;
    },
  });

  const restoreMutation = useMutation({
    mutationFn: (orderId: string) => api.post(`/orders/${orderId}/restore`),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["admin", "orders", "trash"],
      });
      queryClient.invalidateQueries({ queryKey: ["admin", "orders"] });
    },
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-6 gap-3 flex-wrap">
        <div>
          <Link
            href="/admin/orders"
            className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 mb-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Quay lại danh sách đơn hàng
          </Link>
          <h1 className="text-3xl font-bold">Thùng rác</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Đơn hàng gửi vào thùng rác sẽ bị xóa vĩnh viễn sau {RETENTION_DAYS}{" "}
            ngày.
          </p>
        </div>
      </div>

      {isLoading ? (
        <p className="text-muted-foreground">Đang tải...</p>
      ) : data?.data?.length === 0 ? (
        <p className="text-muted-foreground">Thùng rác đang trống.</p>
      ) : (
        <>
          <div className="border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Mã đơn hàng</TableHead>
                  <TableHead>Khách hàng</TableHead>
                  <TableHead>Trạng thái</TableHead>
                  <TableHead>Tổng cộng</TableHead>
                  <TableHead>Xóa lúc</TableHead>
                  <TableHead>Xóa vĩnh viễn lúc</TableHead>
                  <TableHead className="w-[120px]">Hành động</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data?.data?.map((order: ApiRecord) => {
                  const remaining = daysUntilHardDelete(
                    order.deletedAt as string,
                  );
                  return (
                    <TableRow key={order.id as string}>
                      <TableCell className="font-mono text-xs">
                        {order.number as string}
                      </TableCell>
                      <TableCell className="text-sm">
                        {(order.customerName as string) ?? "—"}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {statusLabel(order.status as string)}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-medium">
                        {formatCurrency(order.total as number)}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {formatDate(order.deletedAt as string)}
                      </TableCell>
                      <TableCell className="text-sm">
                        <span
                          className={
                            remaining <= 7
                              ? "text-rose-400"
                              : "text-muted-foreground"
                          }
                        >
                          {remaining === 0 ? "Sắp xóa" : `${remaining} ngày`}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() =>
                            restoreMutation.mutate(order.id as string)
                          }
                          disabled={restoreMutation.isPending}
                        >
                          <RotateCcw className="h-4 w-4 mr-1.5" />
                          Khôi phục
                        </Button>
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
