"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  Users,
  Search,
  ArrowLeft,
  Loader2,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
} from "lucide-react";
import { api } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface AffiliateListRow {
  id: string;
  publicId: number;
  status: "APPROVED" | "PENDING" | "SUSPENDED" | "REJECTED";
  createdAt: string;
  user: { id: string; name: string | null; email: string };
}

interface ListResponse {
  data: AffiliateListRow[];
  meta: { total: number; page: number; perPage: number; lastPage: number };
}

export default function AdminAffiliateListPage() {
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<string>("");
  const [page, setPage] = useState(1);
  const PER_PAGE = 25;

  const { data, isLoading, error } = useQuery<ListResponse>({
    queryKey: ["admin", "affiliates", "list", q, status, page],
    queryFn: async () => {
      const { data } = await api.get<ListResponse>("/admin/affiliates", {
        params: {
          q: q || undefined,
          status: status || undefined,
          page,
          perPage: PER_PAGE,
        },
      });
      return data;
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/admin/affiliate">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <Users className="h-8 w-8 text-cyan" />
        <div>
          <h1 className="text-3xl font-bold">Danh sách cộng tác viên</h1>
          <p className="text-sm text-muted-foreground">
            Tìm kiếm theo tên/email + xem chi tiết từng cộng tác viên.
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-3 items-end">
        <div className="flex-1 min-w-[250px]">
          <label className="text-xs text-muted-foreground uppercase mb-1 block">
            Tìm kiếm
          </label>
          <div className="relative">
            <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
            <Input
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setPage(1);
              }}
              placeholder="Tên hoặc email..."
              className="pl-9"
            />
          </div>
        </div>
        <div>
          <label className="text-xs text-muted-foreground uppercase mb-1 block">
            Trạng thái
          </label>
          <select
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(1);
            }}
            className="h-8 rounded-md border border-white/10 bg-ink-soft px-3 text-sm"
          >
            <option value="">Tất cả</option>
            <option value="APPROVED">Đã duyệt</option>
            <option value="SUSPENDED">Đã khóa</option>
            <option value="PENDING">Chờ duyệt</option>
            <option value="REJECTED">Đã từ chối</option>
          </select>
        </div>
      </div>

      {isLoading && (
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Đang tải...
        </div>
      )}

      {error && (
        <div className="rounded-2xl border border-red-500/40 bg-red-950/20 p-4 flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-red-400 shrink-0 mt-0.5" />
          <p className="text-sm text-red-300">{(error as Error).message}</p>
        </div>
      )}

      {data && data.data.length === 0 && (
        <div className="rounded-2xl border border-purple/25 bg-ink-soft p-8 text-center text-muted-foreground">
          Không tìm thấy cộng tác viên nào.
        </div>
      )}

      {data && data.data.length > 0 && (
        <div className="rounded-2xl border border-purple/25 bg-ink-soft overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-ink/50 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="text-left px-4 py-3 font-medium">#</th>
                <th className="text-left px-4 py-3 font-medium">Tên</th>
                <th className="text-left px-4 py-3 font-medium">Email</th>
                <th className="text-left px-4 py-3 font-medium">Trạng thái</th>
                <th className="text-left px-4 py-3 font-medium">
                  Ngày đăng ký
                </th>
                <th className="text-left px-4 py-3 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {data.data.map((a) => (
                <tr
                  key={a.id}
                  className="border-t border-purple/15 hover:bg-ink/30"
                >
                  <td className="px-4 py-3 font-bold text-cyan">
                    #{a.publicId}
                  </td>
                  <td className="px-4 py-3">{a.user.name ?? "—"}</td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {a.user.email}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={
                        a.status === "APPROVED"
                          ? "text-emerald-400 text-xs font-medium"
                          : a.status === "SUSPENDED"
                            ? "text-red-400 text-xs font-medium"
                            : "text-amber-400 text-xs font-medium"
                      }
                    >
                      {a.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    {new Date(a.createdAt).toLocaleDateString("vi-VN")}
                  </td>
                  <td className="px-4 py-3">
                    <Link href={`/admin/affiliate/${a.id}`}>
                      <Button
                        variant="outline"
                        size="sm"
                        className="bg-ink-soft border-cyan/30 text-white hover:bg-cyan/10"
                      >
                        Chi tiết
                        <ExternalLink className="h-3 w-3 ml-1" />
                      </Button>
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {data && data.meta.lastPage > 1 && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">
            Trang {data.meta.page} của {data.meta.lastPage} (Tổng{" "}
            {data.meta.total})
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              className="bg-ink-soft border-cyan/30 text-white hover:bg-cyan/10"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
            >
              <ChevronLeft className="h-4 w-4" />
              Trước
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="bg-ink-soft border-cyan/30 text-white hover:bg-cyan/10"
              onClick={() =>
                setPage((p) => Math.min(data.meta.lastPage, p + 1))
              }
              disabled={page >= data.meta.lastPage}
            >
              Sau
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
