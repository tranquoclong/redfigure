"use client";
import type { ApiRecord } from "@/types/api";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Search } from "lucide-react";
import { formatDate, formatCurrency } from "@/lib/constants";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Pagination } from "@/components/shared/pagination";
import { api } from "@/lib/api-client";

function formatCccd(cccd: string): string {
  const digits = cccd.replace(/\D/g, "");
  if (digits.length !== 11) return cccd;
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
}

function formatPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 11)
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  if (digits.length === 10)
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  return phone;
}

export default function AdminClientsPage() {
  const router = useRouter();
  const [page, setPage] = useState(1);
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
    queryKey: ["admin", "users", page, debouncedSearch],
    queryFn: async () => {
      const params: Record<string, string | number> = { page, perPage: 20 };
      if (debouncedSearch) params.search = debouncedSearch;
      const { data } = await api.get("/users", { params });
      return data;
    },
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold">Khách hàng</h1>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Tìm kiếm tên, email hoặc CCCD..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 w-[300px]"
          />
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
                  <TableHead>Tên</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>CCCD</TableHead>
                  <TableHead>Điện thoại</TableHead>
                  <TableHead>Đơn hàng</TableHead>
                  <TableHead>Tổng chi tiêu</TableHead>
                  <TableHead>Ngày đăng ký</TableHead>
                  <TableHead>Trạng thái</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data?.data?.length === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={8}
                      className="text-center text-muted-foreground py-8"
                    >
                      Không tìm thấy khách hàng.
                    </TableCell>
                  </TableRow>
                )}
                {data?.data?.map((user: ApiRecord) => (
                  <TableRow
                    key={user.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => router.push(`/admin/clients/${user.id}`)}
                  >
                    <TableCell className="font-medium">
                      {user.name || "-"}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {user.email}
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {user.cccd ? formatCccd(user.cccd) : "-"}
                    </TableCell>
                    <TableCell className="text-sm">
                      {user.phone ? formatPhone(user.phone) : "-"}
                    </TableCell>
                    <TableCell className="text-sm">
                      {user._count?.orders ?? 0}
                    </TableCell>
                    <TableCell className="text-sm font-medium">
                      {formatCurrency(user.totalSpent ?? 0)}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatDate(user.createdAt)}
                    </TableCell>
                    <TableCell>
                      <Badge variant={user.isActive ? "default" : "secondary"}>
                        {user.isActive ? "Hoạt động" : "Không hoạt động"}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
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
