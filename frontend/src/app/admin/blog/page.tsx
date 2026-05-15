"use client";
import type { ApiRecord } from "@/types/api";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Pencil } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/constants";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { api } from "@/lib/api-client";

import { extractError } from "@/lib/extract-error";
export default function AdminBlogPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [error, setError] = useState("");

  const { data: posts, isLoading } = useQuery({
    queryKey: ["admin", "blog"],
    queryFn: async () => {
      const { data } = await api.get("/blog/admin/all");
      return data.data;
    },
  });

  const publishMutation = useMutation({
    mutationFn: (id: string) => api.put(`/blog/${id}/publish`),
    onSuccess: () => {
      setError("");
      queryClient.invalidateQueries({ queryKey: ["admin", "blog"] });
    },
    onError: (err) => {
      setError(extractError(err));
    },
  });

  const unpublishMutation = useMutation({
    mutationFn: (id: string) => api.put(`/blog/${id}/unpublish`),
    onSuccess: () => {
      setError("");
      queryClient.invalidateQueries({ queryKey: ["admin", "blog"] });
    },
    onError: (err) => {
      setError(extractError(err));
    },
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold">Blog</h1>
        <Button onClick={() => router.push("/admin/blog/new")}>
          <Plus className="h-4 w-4 mr-1" />
          Bài viết mới
        </Button>
      </div>

      {error && (
        <div className="bg-destructive/10 text-destructive border border-destructive/20 rounded-md px-4 py-3 mb-4 text-sm">
          {error}
        </div>
      )}

      {isLoading ? (
        <p className="text-muted-foreground">Đang tải...</p>
      ) : !posts?.length ? (
        <div className="text-center py-12 text-muted-foreground">
          <p className="text-lg mb-2">Chưa có bài viết</p>
          <p className="text-sm">
            Nhấp vào &quot;Bài viết mới&quot; để bắt đầu.
          </p>
        </div>
      ) : (
        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tiêu đề</TableHead>
                <TableHead>Trạng thái</TableHead>
                <TableHead>Ngày</TableHead>
                <TableHead className="w-[200px]">Hành động</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {posts.map((post: ApiRecord) => (
                <TableRow key={post.id}>
                  <TableCell>
                    <button
                      className="font-medium hover:underline text-left"
                      onClick={() => router.push(`/admin/blog/${post.id}`)}
                    >
                      {post.title}
                    </button>
                    {post.featured && (
                      <Badge variant="outline" className="ml-2 text-xs">
                        Nổi bật
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant={post.isPublished ? "default" : "secondary"}>
                      {post.isPublished ? "Đã đăng" : "Bản nháp"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {formatDate(post.createdAt)}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => router.push(`/admin/blog/${post.id}`)}
                      >
                        <Pencil className="h-3.5 w-3.5 mr-1" />
                        Chỉnh sửa
                      </Button>
                      {post.isPublished ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => unpublishMutation.mutate(post.id)}
                        >
                          Bỏ đăng
                        </Button>
                      ) : (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => publishMutation.mutate(post.id)}
                        >
                          Đăng bài
                        </Button>
                      )}
                    </div>
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
