"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Save, Plus, Trash2, ArrowLeft, GripVertical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { api } from "@/lib/api-client";
import { RichTextEditor } from "@/components/admin/rich-text-editor";

interface FaqItem {
  question: string;
  answer: string;
}

interface PageData {
  id: string;
  slug: string;
  title: string;
  content: string;
  metaTitle: string | null;
  metaDescription: string | null;
  ogImage: string | null;
  faqItems: FaqItem[] | null;
}

export default function EditPagePage() {
  const { slug } = useParams<{ slug: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();

  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [metaTitle, setMetaTitle] = useState("");
  const [metaDescription, setMetaDescription] = useState("");
  const [ogImage, setOgImage] = useState("");
  const [faqItems, setFaqItems] = useState<FaqItem[]>([]);
  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState<"content" | "seo">("content");

  const { data: page, isLoading } = useQuery<PageData>({
    queryKey: ["admin", "page", slug],
    queryFn: async () => {
      const { data } = await api.get(`/pages/${slug}`);
      return data.data ?? data;
    },
  });

  const isFaq = slug === "faq";

  useEffect(() => {
    if (!page) return;
    setTitle(page.title);
    setContent(page.content ?? "");
    setMetaTitle(page.metaTitle ?? "");
    setMetaDescription(page.metaDescription ?? "");
    setOgImage(page.ogImage ?? "");
    setFaqItems((page.faqItems as FaqItem[]) ?? []);
  }, [page]);

  async function handleSave() {
    setSaving(true);
    setError("");
    setSuccessMsg("");

    try {
      await api.put(`/pages/${slug}`, {
        title,
        content,
        metaTitle: metaTitle || null,
        metaDescription: metaDescription || null,
        ogImage: ogImage || null,
        ...(isFaq ? { faqItems } : {}),
      });
      await queryClient.invalidateQueries({ queryKey: ["admin", "pages"] });
      await queryClient.invalidateQueries({
        queryKey: ["admin", "page", slug],
      });
      setSuccessMsg("Lưu trang thành công!");
      setTimeout(() => setSuccessMsg(""), 3000);
    } catch (err) {
      const resp = (
        err as { response?: { data?: { error?: { message?: string } } } }
      )?.response?.data;
      setError(resp?.error?.message ?? "Lỗi khi lưu");
    } finally {
      setSaving(false);
    }
  }

  function addFaqItem() {
    setFaqItems([...faqItems, { question: "", answer: "" }]);
  }

  function updateFaqItem(
    index: number,
    field: "question" | "answer",
    value: string,
  ) {
    const updated = [...faqItems];
    updated[index] = { ...updated[index], [field]: value };
    setFaqItems(updated);
  }

  function removeFaqItem(index: number) {
    setFaqItems(faqItems.filter((_, i) => i !== index));
  }

  if (isLoading) return <p className="text-muted-foreground">Đang tải...</p>;
  if (!page) return <p className="text-destructive">Không tìm thấy trang.</p>;

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => router.push("/admin/pages")}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h1 className="text-3xl font-bold">Sửa: {page.title}</h1>
      </div>

      {error && (
        <p className="text-sm text-destructive mb-4 p-3 bg-destructive/10 rounded-md">
          {error}
        </p>
      )}
      {successMsg && (
        <p className="text-sm text-green-400 mb-4 p-3 bg-green-950/30 border border-green-800 rounded-md">
          {successMsg}
        </p>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6">
        <div className="space-y-6">
          <div className="flex gap-1 border-b">
            <button
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${activeTab === "content" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}
              onClick={() => setActiveTab("content")}
            >
              Nội dung
            </button>
            <button
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${activeTab === "seo" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}
              onClick={() => setActiveTab("seo")}
            >
              SEO
            </button>
          </div>

          <div className={activeTab === "content" ? "block" : "hidden"}>
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Nội dung trang</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label>Tiêu đề</Label>
                  <Input
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="mt-1"
                  />
                </div>

                {!isFaq && (
                  <div>
                    <Label>Nội dung</Label>
                    <div className="mt-1">
                      <RichTextEditor value={content} onChange={setContent} />
                    </div>
                  </div>
                )}

                {isFaq && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <Label className="text-base font-semibold">
                        Câu hỏi và trả lời
                      </Label>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={addFaqItem}
                      >
                        <Plus className="h-3 w-3 mr-1" />
                        Thêm
                      </Button>
                    </div>
                    {faqItems.map((item, i) => (
                      <div
                        key={i}
                        className="border rounded-lg p-4 space-y-3 relative"
                      >
                        <div className="flex items-start gap-2">
                          <GripVertical className="h-5 w-5 text-muted-foreground mt-2 shrink-0" />
                          <div className="flex-1 space-y-3">
                            <div>
                              <Label className="text-xs text-muted-foreground">
                                Câu hỏi
                              </Label>
                              <Input
                                value={item.question}
                                onChange={(e) =>
                                  updateFaqItem(i, "question", e.target.value)
                                }
                                placeholder="Ví dụ: Thời gian giao hàng là bao lâu?"
                              />
                            </div>
                            <div>
                              <Label className="text-xs text-muted-foreground">
                                Câu trả lời
                              </Label>
                              <textarea
                                value={item.answer}
                                onChange={(e) =>
                                  updateFaqItem(i, "answer", e.target.value)
                                }
                                placeholder="Trả lời đầy đủ..."
                                rows={3}
                                className="flex w-full rounded-md border bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                              />
                            </div>
                          </div>
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            className="text-destructive hover:text-destructive shrink-0"
                            onClick={() => removeFaqItem(i)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                    {faqItems.length === 0 && (
                      <p className="text-sm text-muted-foreground text-center py-8">
                        Chưa có câu hỏi. Nhấn vào &quot;Thêm&quot; để bắt đầu.
                      </p>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <div className={activeTab === "seo" ? "block" : "hidden"}>
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">SEO</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label>Meta Title</Label>
                  <Input
                    value={metaTitle}
                    onChange={(e) => setMetaTitle(e.target.value)}
                    placeholder={title}
                    maxLength={60}
                    className="mt-1"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    {metaTitle.length}/60 ký tự. Để trống để sử dụng tiêu đề
                    trang.
                  </p>
                </div>
                <div>
                  <Label>Meta Description</Label>
                  <textarea
                    value={metaDescription}
                    onChange={(e) => setMetaDescription(e.target.value)}
                    placeholder="Mô tả cho công cụ tìm kiếm..."
                    maxLength={160}
                    rows={3}
                    className="flex w-full rounded-md border bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring mt-1"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    {metaDescription.length}/160 ký tự.
                  </p>
                </div>
                <div>
                  <Label>Ảnh OG (Open Graph)</Label>
                  <Input
                    value={ogImage}
                    onChange={(e) => setOgImage(e.target.value)}
                    placeholder="https://cdn.example.com/imagem.jpg"
                    className="mt-1"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Ảnh hiển thị khi chia sẻ trên Facebook/Twitter. Khuyến nghị:
                    1200x630px.
                  </p>
                </div>

                <div className="border rounded-lg p-4 bg-muted/30">
                  <p className="text-xs text-muted-foreground mb-2">
                    Xem trước trên Google:
                  </p>
                  <p className="text-blue-400 text-sm font-medium truncate">
                    {metaTitle || title} | RedFigure
                  </p>
                  <p className="text-green-400 text-xs truncate">
                    redfigure.com/{slug}
                  </p>
                  <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
                    {metaDescription || "Chưa có mô tả."}
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        <div>
          <Card>
            <CardContent className="pt-6 space-y-4">
              <div className="text-xs text-muted-foreground">
                <span className="font-medium">Slug:</span> /{slug}
              </div>
              <Button
                className="w-full"
                onClick={handleSave}
                disabled={saving || !title}
              >
                <Save className="h-4 w-4 mr-2" />
                {saving ? "Đang lưu..." : "Lưu"}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
