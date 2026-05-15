"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { formatDateLong } from "@/lib/constants";

interface PageSummary {
  id: string;
  slug: string;
  title: string;
  metaTitle: string | null;
  metaDescription: string | null;
  updatedAt: string;
}

export default function AdminPagesPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["admin", "pages"],
    queryFn: async () => {
      const { data } = await api.get("/pages");
      return data.data ?? data;
    },
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold">Trang</h1>
      </div>

      {isLoading ? (
        <p className="text-muted-foreground">Đang tải...</p>
      ) : (
        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tiêu đề</TableHead>
                <TableHead>Slug</TableHead>
                <TableHead>SEO</TableHead>
                <TableHead>Cập nhật</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(data as PageSummary[])?.map((page) => (
                <TableRow key={page.id}>
                  <TableCell className="font-medium">
                    <Link
                      href={`/admin/pages/${page.slug}`}
                      className="hover:text-primary hover:underline transition-colors"
                    >
                      {page.title}
                    </Link>
                  </TableCell>
                  <TableCell className="text-muted-foreground font-mono text-xs">
                    /{page.slug}
                  </TableCell>
                  <TableCell>
                    {page.metaDescription ? (
                      <Badge variant="default" className="text-[10px]">
                        OK
                      </Badge>
                    ) : (
                      <Badge variant="secondary" className="text-[10px]">
                        Chưa có mô tả
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-xs">
                    {formatDateLong(page.updatedAt)}
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
