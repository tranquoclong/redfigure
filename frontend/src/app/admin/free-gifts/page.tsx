"use client";

import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Pencil, Trash2, Gift } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { api } from "@/lib/api-client";
import { formatCurrency } from "@/lib/constants";

interface FreeGiftRow {
  id: string;
  isActive: boolean;
  minOrderAmount: number;
  label: string;
  startsAt: string | null;
  endsAt: string | null;
  product: {
    id: string;
    name: string;
    slug: string;
  };
}

function formatDateRange(start: string | null, end: string | null): string {
  if (!start && !end) return "Luôn hoạt động";
  const fmt = (d: string) => new Date(d).toLocaleDateString("vi-VN");
  if (start && end) return `${fmt(start)} → ${fmt(end)}`;
  if (start) return `Từ ${fmt(start)}`;
  return `Đến ${fmt(end!)}`;
}

export default function AdminFreeGiftsPage() {
  const queryClient = useQueryClient();

  const { data: gifts, isLoading } = useQuery({
    queryKey: ["admin", "free-gifts"],
    queryFn: async () => {
      const { data } = await api.get("/free-gifts");
      return (data.data ?? []) as FreeGiftRow[];
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/free-gifts/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "free-gifts"] });
    },
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Gift className="h-7 w-7 text-magenta" />
            Quà tặng miễn phí
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Quà tặng tự động trong giỏ hàng khi tổng tiền đạt mức tối thiểu. Chỉ
            quà có giá trị tối thiểu cao nhất (hạn chế nhất) được hiển thị mỗi
            lần.
          </p>
        </div>
        <Link href="/admin/free-gifts/new">
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            Thêm quà tặng
          </Button>
        </Link>
      </div>

      {isLoading ? (
        <p className="text-muted-foreground">Đang tải…</p>
      ) : !gifts?.length ? (
        <div className="rounded-lg border border-dashed border-border/60 bg-muted/20 p-8 text-center">
          <Gift className="h-10 w-10 mx-auto text-muted-foreground mb-2" />
          <p className="text-muted-foreground">
            Chưa có quà tặng nào được cấu hình.
          </p>
          <Link href="/admin/free-gifts/new" className="inline-block mt-4">
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Thêm quà tặng đầu tiên
            </Button>
          </Link>
        </div>
      ) : (
        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Sản phẩm</TableHead>
                <TableHead>Tối thiểu</TableHead>
                <TableHead>Thời gian</TableHead>
                <TableHead>Trạng thái</TableHead>
                <TableHead className="w-[120px] text-right">
                  Hành động
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {gifts.map((g) => (
                <TableRow key={g.id}>
                  <TableCell className="font-medium">
                    {g.product.name}
                  </TableCell>
                  <TableCell>{formatCurrency(g.minOrderAmount)}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatDateRange(g.startsAt, g.endsAt)}
                  </TableCell>
                  <TableCell>
                    <span
                      className={
                        g.isActive
                          ? "inline-flex rounded-full bg-green-500/10 px-2 py-0.5 text-xs text-green-700"
                          : "inline-flex rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground"
                      }
                    >
                      {g.isActive ? "Hoạt động" : "Ngừng hoạt động"}
                    </span>
                  </TableCell>
                  <TableCell className="text-right space-x-1">
                    <Link href={`/admin/free-gifts/${g.id}`}>
                      <Button size="icon" variant="ghost" className="h-8 w-8">
                        <Pencil className="h-4 w-4" />
                      </Button>
                    </Link>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 text-destructive"
                      onClick={() => {
                        if (confirm(`Xóa quà tặng "${g.product.name}"?`))
                          deleteMutation.mutate(g.id);
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
