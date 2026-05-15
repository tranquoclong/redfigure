"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  ArrowLeft,
  UserPlus,
  Search,
  Loader2,
  AlertCircle,
  CheckCircle2,
} from "lucide-react";
import { api } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface UserRow {
  id: string;
  name: string | null;
  email: string;
  role: string;
  hasAffiliate?: boolean;
}

interface UsersResponse {
  data: UserRow[];
  meta: { total: number; page: number; perPage: number; lastPage: number };
}

export default function AdminAffiliateNewPage() {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<UserRow | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const { data, isLoading } = useQuery<UsersResponse>({
    queryKey: ["admin-users-search-affiliate", search],
    queryFn: async () => {
      const { data } = await api.get<UsersResponse>("/users", {
        params: { search: search || undefined, perPage: 15 },
      });
      return data;
    },
    enabled: search.length >= 2,
  });

  const create = useMutation({
    mutationFn: async (userId: string) => {
      const { data } = await api.post<{
        data: { id: string; publicId: number };
      }>("/admin/affiliates/create-for-user", { userId });
      return data.data;
    },
    onSuccess: (account) => {
      router.push(`/admin/affiliate/${account.id}`);
    },
    onError: (e: unknown) => {
      const resp = (
        e as { response?: { data?: { error?: { message?: string } } } }
      )?.response?.data;
      setErr(
        resp?.error?.message ??
          "Lỗi khi tạo CTV — khách hàng có thể đã có tài khoản.",
      );
    },
  });

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center gap-3">
        <Link href="/admin/affiliate">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <UserPlus className="h-8 w-8 text-magenta" />
        <div>
          <h1 className="text-3xl font-bold">Tạo CTV thủ công</h1>
          <p className="text-sm text-muted-foreground">
            Thăng cấp khách hàng hiện tại thành CTV — tận dụng đăng ký, không
            trùng lặp (AffiliateAccount.userId @unique).
          </p>
        </div>
      </div>

      <div>
        <label className="text-xs text-muted-foreground uppercase mb-1 block">
          Tìm kiếm khách hàng (tên hoặc email)
        </label>
        <div className="relative">
          <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
          <Input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setSelected(null);
              setErr(null);
            }}
            placeholder="Tìm kiếm tên hoặc email khách hàng..."
            className="pl-9"
            autoFocus
          />
        </div>
        {search.length > 0 && search.length < 2 && (
          <p className="text-xs text-muted-foreground mt-1">
            Nhập ít nhất 2 ký tự.
          </p>
        )}
      </div>

      {isLoading && (
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Tìm kiếm...
        </div>
      )}

      {data && data.data.length === 0 && search.length >= 2 && (
        <div className="rounded-2xl border border-white/10 bg-ink-soft p-6 text-center text-muted-foreground">
          Không tìm thấy khách hàng nào cho &quot;{search}&quot;.
        </div>
      )}

      {data && data.data.length > 0 && (
        <div className="rounded-2xl border border-purple/25 bg-ink-soft overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-ink/50 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="text-left px-4 py-3 font-medium">Tên</th>
                <th className="text-left px-4 py-3 font-medium">Email</th>
                <th className="text-left px-4 py-3 font-medium">Vai trò</th>
                <th className="text-right px-4 py-3 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {data.data.map((u) => (
                <tr
                  key={u.id}
                  className={`border-t border-purple/15 ${
                    selected?.id === u.id ? "bg-cyan/10" : "hover:bg-ink/30"
                  }`}
                >
                  <td className="px-4 py-3">{u.name ?? "—"}</td>
                  <td className="px-4 py-3 text-muted-foreground">{u.email}</td>
                  <td className="px-4 py-3">
                    <span className="text-xs uppercase text-muted-foreground">
                      {u.role}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Button
                      variant={selected?.id === u.id ? "default" : "outline"}
                      size="sm"
                      className={
                        selected?.id === u.id
                          ? ""
                          : "bg-ink-soft border-magenta/30 text-white hover:bg-magenta/10"
                      }
                      onClick={() => setSelected(u)}
                    >
                      {selected?.id === u.id ? "Đã chọn" : "Chọn"}
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {selected && (
        <div className="rounded-2xl border border-magenta/30 bg-magenta/5 p-5 space-y-3">
          <h3 className="font-semibold flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-magenta" />
            Xác nhận thăng cấp thành CTV
          </h3>
          <div className="text-sm space-y-1">
            <p>
              <span className="text-muted-foreground">Khách hàng:</span>{" "}
              <strong>{selected.name ?? selected.email}</strong>
            </p>
            <p className="text-xs text-muted-foreground">
              Status sẽ là <strong>APPROVED</strong>, termsVersion{" "}
              <code>admin-created</code>. CTV sẽ nhận được #publicId theo định
              dạng tuần tự. Bạn có thể chỉnh sửa slug <code>publicCode</code>{" "}
              trên trang chi tiết sau.
            </p>
          </div>

          {err && (
            <div className="flex gap-2 text-sm text-red-300 bg-red-950/20 border border-red-500/30 rounded-md px-3 py-2">
              <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
              <span>{err}</span>
            </div>
          )}

          <div className="flex gap-2">
            <Button
              variant="ghost"
              onClick={() => setSelected(null)}
              disabled={create.isPending}
            >
              Hủy
            </Button>
            <Button
              onClick={() => create.mutate(selected.id)}
              disabled={create.isPending}
            >
              {create.isPending && (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              )}
              Tạo tài khoản CTV
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
