"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Save, Eye, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RichTextEditor } from "@/components/admin/rich-text-editor";
import { ImagePicker } from "@/components/admin/image-picker";
import { api } from "@/lib/api-client";

import { extractError } from "@/lib/extract-error";
interface BlogPost {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  content: string;
  coverImage: string | null;
  isPublished: boolean;
  featured: boolean;
}

interface BlogFormProps {
  post?: BlogPost;
}

export function BlogForm({ post }: BlogFormProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const isEditing = !!post;

  const [title, setTitle] = useState(post?.title ?? "");
  const [excerpt, setExcerpt] = useState(post?.excerpt ?? "");
  const [content, setContent] = useState(post?.content ?? "");
  const [coverImage, setCoverImage] = useState(post?.coverImage ?? "");
  const [featured, setFeatured] = useState(post?.featured ?? false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const saveMutation = useMutation({
    mutationFn: async () => {
      const body = {
        title,
        content,
        excerpt: excerpt || undefined,
        coverImage: coverImage || undefined,
        featured,
      };
      if (isEditing) {
        const { data } = await api.put(`/blog/${post.id}`, body);
        return data.data;
      }
      const { data } = await api.post("/blog", body);
      return data.data;
    },
    onSuccess: (data) => {
      setError("");
      setSuccess(
        isEditing ? "Bài viết đã được cập nhật!" : "Bài viết đã được tạo!",
      );
      queryClient.invalidateQueries({ queryKey: ["admin", "blog"] });
      if (!isEditing && data?.id) {
        setTimeout(() => router.push(`/admin/blog/${data.id}`), 600);
      }
    },
    onError: (err) => {
      setSuccess("");
      setError(extractError(err));
    },
  });

  const publishMutation = useMutation({
    mutationFn: async () => {
      if (!post) return;
      if (post.isPublished) {
        const { data } = await api.put(`/blog/${post.id}/unpublish`);
        return data.data;
      }
      const { data } = await api.put(`/blog/${post.id}/publish`);
      return data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "blog"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "blog", post?.id] });
      setSuccess(
        post?.isPublished
          ? "Bài viết đã được ẩn!"
          : "Bài viết đã được xuất bản!",
      );
      setError("");
    },
    onError: (err) => {
      setSuccess("");
      setError(extractError(err));
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      if (!post) return;
      await api.delete(`/blog/${post.id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "blog"] });
      router.push("/admin/blog");
    },
    onError: (err) => {
      setError(extractError(err));
    },
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push("/admin/blog")}
          >
            <ArrowLeft className="h-4 w-4 mr-1" />
            Quay lại
          </Button>
          <h1 className="text-2xl font-bold">
            {isEditing ? "Sửa bài viết" : "Bài viết mới"}
          </h1>
        </div>
        <div className="flex items-center gap-2">
          {isEditing && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => publishMutation.mutate()}
                disabled={publishMutation.isPending}
              >
                <Eye className="h-4 w-4 mr-1" />
                {post.isPublished ? "Ẩn bài viết" : "Xuất bản bài viết"}
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => {
                  if (confirm("Tem certeza que deseja excluir este post?")) {
                    deleteMutation.mutate();
                  }
                }}
                disabled={deleteMutation.isPending}
              >
                <Trash2 className="h-4 w-4 mr-1" />
                Xóa bài viết
              </Button>
            </>
          )}
          <Button
            onClick={() => saveMutation.mutate()}
            disabled={
              saveMutation.isPending || !title.trim() || !content.trim()
            }
          >
            <Save className="h-4 w-4 mr-1" />
            {saveMutation.isPending ? "Đang lưu..." : "Lưu bài viết"}
          </Button>
        </div>
      </div>

      {error && (
        <div className="bg-destructive/10 text-destructive border border-destructive/20 rounded-md px-4 py-3 mb-4 text-sm">
          {error}
        </div>
      )}
      {success && (
        <div className="bg-green-50 text-green-700 border border-green-200 rounded-md px-4 py-3 mb-4 text-sm">
          {success}
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-[1fr_300px] gap-6">
        <div className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="title" className="text-base font-semibold">
              Tiêu đề
            </Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Tiêu đề bài viết"
              className="text-lg"
            />
            {isEditing && post.slug && (
              <p className="text-xs text-muted-foreground">
                Slug: <code className="bg-muted px-1 rounded">{post.slug}</code>
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label className="text-base font-semibold">Nội dung</Label>
            <RichTextEditor value={content} onChange={setContent} />
          </div>
        </div>

        <div className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="excerpt" className="text-sm font-semibold">
              Tóm tắt
            </Label>
            <Textarea
              id="excerpt"
              value={excerpt}
              onChange={(e) => setExcerpt(e.target.value)}
              placeholder="Tóm tắt bài viết"
              rows={4}
            />
          </div>

          <div className="space-y-2">
            <Label className="text-sm font-semibold">Ảnh đại diện</Label>
            <ImagePicker
              value={coverImage === "" ? null : coverImage}
              onChange={(url) => setCoverImage(url ?? "")}
              variant="full"
              aspectRatio="1200x630"
              helperText="Ảnh bìa hiển thị ở đầu bài viết, danh sách và như Open Graph. Khuyến nghị 1200×630 px."
            />
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="featured"
              checked={featured}
              onChange={(e) => setFeatured(e.target.checked)}
              className="rounded"
            />
            <Label htmlFor="featured" className="text-sm cursor-pointer">
              Bài viết nổi bật
            </Label>
          </div>

          {isEditing && (
            <div className="rounded-md border p-3 space-y-1 text-sm text-muted-foreground">
              <p>
                Trạng thái:{" "}
                <strong
                  className={
                    post.isPublished ? "text-green-600" : "text-yellow-600"
                  }
                >
                  {post.isPublished ? "Đã xuất bản" : "Bản nháp"}
                </strong>
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
