"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { api } from "@/lib/api-client";
import { formatDateTime } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Status =
  | "REQUESTED"
  | "DRAFT"
  | "SENT"
  | "PARTIALLY_ACCEPTED"
  | "FULLY_ACCEPTED"
  | "EXPIRED"
  | "CANCELLED";

const STATUS_LABEL: Record<Status, string> = {
  REQUESTED: "Đang chờ trả lời",
  DRAFT: "Bản nháp",
  SENT: "Đã gửi cho khách hàng",
  PARTIALLY_ACCEPTED: "Đã chấp nhận một phần",
  FULLY_ACCEPTED: "Đã chấp nhận",
  EXPIRED: "Hết hạn",
  CANCELLED: "Đã hủy",
};

const STATUS_VARIANT: Record<
  Status,
  "default" | "secondary" | "outline" | "destructive"
> = {
  REQUESTED: "destructive",
  DRAFT: "outline",
  SENT: "secondary",
  PARTIALLY_ACCEPTED: "default",
  FULLY_ACCEPTED: "default",
  EXPIRED: "outline",
  CANCELLED: "outline",
};

interface QuoteRow {
  id: string;
  number: string;
  status: Status;
  customerName: string;
  customerEmail: string;
  expiresAt: string;
  createdAt: string;
  items: Array<{ id: string; unitPrice: number; status: string }>;
}

const TABS: Array<{ value: Status | "ALL"; label: string }> = [
  { value: "REQUESTED", label: "Đơn hàng mới" },
  { value: "DRAFT", label: "Bản nháp" },
  { value: "SENT", label: "Đã gửi" },
  { value: "PARTIALLY_ACCEPTED", label: "Đã chấp nhận một phần" },
  { value: "FULLY_ACCEPTED", label: "Đã chấp nhận" },
  { value: "ALL", label: "Tất cả" },
];

export default function AdminQuotesPage() {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<Status | "ALL">("REQUESTED");
  const [page, setPage] = useState(1);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["admin", "custom-quotes", tab, page],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (tab !== "ALL") params.set("status", tab);
      params.set("page", String(page));
      params.set("perPage", "20");
      const res = await api.get(`/admin/custom-quotes?${params.toString()}`);
      return res.data as {
        data: QuoteRow[];
        meta: {
          total: number;
          page: number;
          perPage: number;
          lastPage: number;
        };
      };
    },
  });

  const createMutation = useMutation({
    mutationFn: async (payload: {
      customerName: string;
      customerEmail: string;
    }) => {
      const res = await api.post("/admin/custom-quotes", payload);
      return res.data.data as { id: string };
    },
    onSuccess: (quote) => {
      queryClient.invalidateQueries({ queryKey: ["admin", "custom-quotes"] });
      setShowCreate(false);
      setNewName("");
      setNewEmail("");
      window.location.href = `/admin/quotes/${quote.id}`;
    },
  });

  const rows = data?.data ?? [];
  const meta = data?.meta;

  return (
    <div className="container mx-auto max-w-6xl py-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Báo giá customized</h1>
        <Button onClick={() => setShowCreate((v) => !v)}>
          <Plus className="h-4 w-4 mr-1" /> Tạo báo giá
        </Button>
      </div>

      {showCreate && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Tạo báo giá trực tiếp</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid md:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Tên khách hàng</Label>
                <Input
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Tên đầy đủ"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Email khách hàng</Label>
                <Input
                  type="email"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  placeholder="user@gmail.com"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                onClick={() =>
                  createMutation.mutate({
                    customerName: newName.trim(),
                    customerEmail: newEmail.trim(),
                  })
                }
                disabled={
                  !newName.trim() ||
                  !newEmail.trim() ||
                  createMutation.isPending
                }
              >
                Tạo và chỉnh sửa
              </Button>
              <Button variant="outline" onClick={() => setShowCreate(false)}>
                Hủy
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="flex gap-1 border-b overflow-x-auto">
        {TABS.map((t) => (
          <button
            key={t.value}
            type="button"
            onClick={() => {
              setTab(t.value);
              setPage(1);
            }}
            className={`px-4 py-2 text-sm whitespace-nowrap border-b-2 -mb-px ${
              tab === t.value
                ? "border-primary text-primary font-medium"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading && (
            <div className="p-6 text-sm text-muted-foreground">Đang tải…</div>
          )}
          {!isLoading && rows.length === 0 && (
            <div className="p-6 text-sm text-muted-foreground">
              Không tìm thấy báo giá nào trong tab này.
            </div>
          )}
          {!isLoading && rows.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-xs uppercase tracking-wider">
                  <tr>
                    <th className="px-4 py-2 text-left font-medium">Số</th>
                    <th className="px-4 py-2 text-left font-medium">
                      Khách hàng
                    </th>
                    <th className="px-4 py-2 text-left font-medium">
                      Trạng thái
                    </th>
                    <th className="px-4 py-2 text-right font-medium">Mục</th>
                    <th className="px-4 py-2 text-right font-medium">Tổng</th>
                    <th className="px-4 py-2 text-left font-medium">Ngày</th>
                    <th className="px-4 py-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((q) => {
                    const total = q.items.reduce(
                      (sum, i) => sum + i.unitPrice,
                      0,
                    );
                    return (
                      <tr key={q.id} className="border-t hover:bg-muted/30">
                        <td className="px-4 py-2 font-mono text-xs">
                          {q.number}
                        </td>
                        <td className="px-4 py-2">
                          <div>{q.customerName}</div>
                          <div className="text-xs text-muted-foreground">
                            {q.customerEmail}
                          </div>
                        </td>
                        <td className="px-4 py-2">
                          <Badge
                            variant={STATUS_VARIANT[q.status]}
                            className="text-[10px]"
                          >
                            {STATUS_LABEL[q.status]}
                          </Badge>
                        </td>
                        <td className="px-4 py-2 text-right font-mono text-xs">
                          {q.items.length}
                        </td>
                        <td className="px-4 py-2 text-right font-mono">
                          {total.toFixed(2)} đ
                        </td>
                        <td className="px-4 py-2 text-xs whitespace-nowrap">
                          {formatDateTime(q.createdAt)}
                        </td>
                        <td className="px-4 py-2 text-right">
                          <Link href={`/admin/quotes/${q.id}`}>
                            <Button variant="ghost" size="sm">
                              Xem chi tiết
                            </Button>
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {meta && meta.lastPage > 1 && (
        <div className="flex items-center justify-between">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            Trước
          </Button>
          <span className="text-sm text-muted-foreground">
            Trang {meta.page} của {meta.lastPage}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= meta.lastPage}
            onClick={() => setPage((p) => p + 1)}
          >
            Sau
          </Button>
        </div>
      )}
    </div>
  );
}
