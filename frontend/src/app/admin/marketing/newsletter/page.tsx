"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Search,
  Trash2,
  Download,
  Mail,
  Loader2,
  Check,
  Clock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { api } from "@/lib/api-client";
import { API_URL } from "@/lib/constants";
import { useAuthStore } from "@/store/auth-store";

interface Subscriber {
  id: string;
  email: string;
  source: string | null;
  createdAt: string;
  confirmedAt: string | null;
}

interface ListResponse {
  data: Subscriber[];
  meta: { total: number; page: number; perPage: number; lastPage: number };
}

interface Stats {
  total: number;
  confirmed: number;
  pending: number;
  last24h: number;
  last7d: number;
  last30d: number;
}

function StatCard({
  label,
  value,
  accent,
}: {
  label: string;
  value: number;
  accent?: "lime" | "amber";
}) {
  const accentClass =
    accent === "lime"
      ? "text-lime-500"
      : accent === "amber"
        ? "text-amber-500"
        : "";
  return (
    <Card>
      <CardContent className="p-5">
        <p className="text-xs uppercase tracking-wider text-muted-foreground">
          {label}
        </p>
        <p className={`text-3xl font-bold mt-1 ${accentClass}`}>
          {value.toLocaleString("vi-VN")}
        </p>
      </CardContent>
    </Card>
  );
}

function StatusBadge({ confirmedAt }: { confirmedAt: string | null }) {
  if (confirmedAt) {
    return (
      <span className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded bg-lime-500/15 text-lime-700 dark:text-lime-400 font-medium">
        <Check className="size-3" strokeWidth={2.5} />
        Confirmado
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded bg-amber-500/15 text-amber-700 dark:text-amber-400 font-medium">
      <Clock className="size-3" strokeWidth={2.5} />
      Pendente
    </span>
  );
}

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("vi-VN", {
    timeZone: "Asia/Ho_Chi_Minh",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function NewsletterAdminPage() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");

  const statsQuery = useQuery<Stats>({
    queryKey: ["admin", "newsletter", "stats"],
    queryFn: async () => {
      const { data } = await api.get<{ data: Stats }>(
        "/admin/newsletter/stats",
      );
      return data.data;
    },
  });

  const listQuery = useQuery<ListResponse>({
    queryKey: ["admin", "newsletter", "list", page, search],
    queryFn: async () => {
      const params: Record<string, string | number> = { page, perPage: 20 };
      if (search.trim()) params.search = search.trim();
      const { data } = await api.get<ListResponse>(
        "/admin/newsletter/subscribers",
        { params },
      );
      return data;
    },
  });

  const removeMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/admin/newsletter/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "newsletter"] });
    },
  });

  function applySearch(e: React.FormEvent) {
    e.preventDefault();
    setSearch(searchInput);
    setPage(1);
  }

  function exportCsv() {
    const token = useAuthStore.getState().accessToken;
    fetch(`${API_URL}/api/v1/admin/newsletter/export.csv`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
      .then((res) => res.blob())
      .then((blob) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `newsletter-${new Date().toISOString().slice(0, 10)}.csv`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
      });
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Mail className="h-6 w-6" />
            Danh sách đăng ký nhận tin
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Danh sách các email đã được thu thập thông qua mẫu đăng ký công
            khai. Việc gửi email sẽ được thực hiện thông qua một nền tảng bên
            ngoài — hãy xuất file CSV và nhập vào đó.
          </p>
        </div>
        <Button onClick={exportCsv}>
          <Download className="h-4 w-4 mr-2" />
          Xuất CSV
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <StatCard label="Tổng" value={statsQuery.data?.total ?? 0} />
        <StatCard
          label="Đã xác nhận"
          value={statsQuery.data?.confirmed ?? 0}
          accent="lime"
        />
        <StatCard
          label="Đang chờ xử lý"
          value={statsQuery.data?.pending ?? 0}
          accent="amber"
        />
        <StatCard label="24h qua" value={statsQuery.data?.last24h ?? 0} />
        <StatCard label="7 ngày qua" value={statsQuery.data?.last7d ?? 0} />
        <StatCard label="30 ngày qua" value={statsQuery.data?.last30d ?? 0} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Đăng ký</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={applySearch} className="flex gap-2 mb-4">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Tìm kiếm email…"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                className="pl-9"
              />
            </div>
            <Button type="submit" variant="outline">
              Tìm kiếm
            </Button>
          </form>

          {listQuery.isLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground py-12 justify-center">
              <Loader2 className="h-4 w-4 animate-spin" /> Đang tải…
            </div>
          ) : listQuery.data && listQuery.data.data.length > 0 ? (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Email</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Nguồn</TableHead>
                    <TableHead>Ngày đăng ký</TableHead>
                    <TableHead>Đã xác nhận</TableHead>
                    <TableHead className="w-20"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {listQuery.data.data.map((sub) => (
                    <TableRow key={sub.id}>
                      <TableCell className="font-mono text-xs">
                        {sub.email}
                      </TableCell>
                      <TableCell>
                        <StatusBadge confirmedAt={sub.confirmedAt} />
                      </TableCell>
                      <TableCell>
                        <span className="text-xs px-2 py-1 rounded bg-muted">
                          {sub.source ?? "—"}
                        </span>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {formatDateTime(sub.createdAt)}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {sub.confirmedAt
                          ? formatDateTime(sub.confirmedAt)
                          : "—"}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            if (
                              confirm(
                                `Xóa ${sub.email} khỏi danh sách? Thao tác này không gửi email xác nhận.`,
                              )
                            ) {
                              removeMutation.mutate(sub.id);
                            }
                          }}
                          disabled={removeMutation.isPending}
                          title="Xóa khỏi danh sách"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {listQuery.data.meta.lastPage > 1 && (
                <div className="flex items-center justify-between mt-4">
                  <p className="text-sm text-muted-foreground">
                    Trang {listQuery.data.meta.page} của{" "}
                    {listQuery.data.meta.lastPage} · {listQuery.data.meta.total}{" "}
                    đăng ký
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      disabled={page === 1}
                    >
                      Trước đó
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        setPage((p) =>
                          Math.min(listQuery.data!.meta.lastPage, p + 1),
                        )
                      }
                      disabled={page === listQuery.data.meta.lastPage}
                    >
                      Tiếp theo
                    </Button>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="text-center py-12 text-muted-foreground text-sm">
              {search
                ? "Không tìm thấy đăng ký nào với email này."
                : "Chưa có ai đăng ký. Khi có người điền form ở trang chủ, họ sẽ xuất hiện ở đây."}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
