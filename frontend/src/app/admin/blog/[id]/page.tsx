"use client";

import { use } from "react";
import { useQuery } from "@tanstack/react-query";
import { BlogForm } from "@/components/admin/blog-form";
import { api } from "@/lib/api-client";

export default function EditBlogPostPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);

  const { data: post, isLoading } = useQuery({
    queryKey: ["admin", "blog", id],
    queryFn: async () => {
      const { data } = await api.get(`/blog/admin/all`);
      return data.data.find((p: { id: string }) => p.id === id);
    },
  });

  if (isLoading) {
    return <p className="text-muted-foreground">Đang tải...</p>;
  }

  if (!post) {
    return <p className="text-destructive">Không tìm thấy bài viết.</p>;
  }

  return <BlogForm post={post} />;
}
