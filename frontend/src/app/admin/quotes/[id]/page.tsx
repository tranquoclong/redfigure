"use client";

import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AxiosError } from "axios";
import {
  ArrowLeft,
  Copy,
  Send,
  XCircle,
  Trash2,
  Plus,
  Save,
} from "lucide-react";
import { api } from "@/lib/api-client";
import { formatDateTime } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://redfigure.com";

interface QuoteItem {
  id: string;
  name: string;
  description: string | null;
  unitPrice: number;
  maxQuantity: number;
  weight: number;
  width: number;
  height: number;
  length: number;
  status: "QUOTED" | "ACCEPTED" | "CANCELLED";
  sortOrder: number;
}

interface Quote {
  id: string;
  number: string;
  token: string;
  status: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string | null;
  customerNotes: string | null;
  adminNotes: string | null;
  externalLinks: string[];
  expiresAt: string;
  sentAt: string | null;
  createdAt: string;
  items: QuoteItem[];
  images: Array<{
    id: string;
    uploadedBy: string;
    mediaFile?: { thumb: string; card: string } | null;
  }>;
  user: { id: string; email: string; name: string | null } | null;
}

interface NewItem {
  name: string;
  description: string;
  unitPrice: string;
  maxQuantity: string;
  weight: string;
  width: string;
  height: string;
  length: string;
}

const emptyNewItem: NewItem = {
  name: "",
  description: "",
  unitPrice: "",
  maxQuantity: "1",
  weight: "0.3",
  width: "11",
  height: "16",
  length: "5",
};

export default function AdminQuoteDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [adminNotes, setAdminNotes] = useState("");
  const [validityDays, setValidityDays] = useState("14");
  const [newItem, setNewItem] = useState<NewItem>(emptyNewItem);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const { data: quote, isLoading } = useQuery({
    queryKey: ["admin", "custom-quote", id],
    queryFn: async () => {
      const res = await api.get(`/admin/custom-quotes/${id}`);
      const q = res.data.data as Quote;
      setAdminNotes(q.adminNotes ?? "");
      return q;
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (payload: Record<string, unknown>) => {
      await api.patch(`/admin/custom-quotes/${id}`, payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["admin", "custom-quote", id],
      });
      setFeedback("Salvo");
      setTimeout(() => setFeedback(null), 2000);
    },
  });

  const addItemMutation = useMutation({
    mutationFn: async (item: NewItem) => {
      await api.post(`/admin/custom-quotes/${id}/items`, {
        name: item.name.trim(),
        description: item.description.trim() || undefined,
        unitPrice: parseFloat(item.unitPrice),
        maxQuantity: parseInt(item.maxQuantity, 10) || 1,
        weight: parseFloat(item.weight),
        width: parseFloat(item.width),
        height: parseFloat(item.height),
        lengthCm: parseFloat(item.length),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["admin", "custom-quote", id],
      });
      setNewItem(emptyNewItem);
    },
  });

  const deleteItemMutation = useMutation({
    mutationFn: async (itemId: string) => {
      await api.delete(`/admin/custom-quotes/${id}/items/${itemId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["admin", "custom-quote", id],
      });
    },
  });

  const sendMutation = useMutation({
    mutationFn: async () => {
      await api.patch(`/admin/custom-quotes/${id}`, {
        adminNotes: adminNotes.trim() || undefined,
        validityDays: parseInt(validityDays, 10) || 14,
      });
      await api.post(`/admin/custom-quotes/${id}/send`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["admin", "custom-quote", id],
      });
      setFeedback("Sent to client!");
      setTimeout(() => setFeedback(null), 3000);
    },
  });

  const cancelMutation = useMutation({
    mutationFn: async () => {
      await api.post(`/admin/custom-quotes/${id}/cancel`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["admin", "custom-quote", id],
      });
    },
  });

  if (isLoading || !quote) {
    return (
      <div className="container mx-auto max-w-5xl py-6">
        <p className="text-sm text-muted-foreground">Đang tải…</p>
      </div>
    );
  }

  const publicLink = `${SITE_URL}/quote/${quote.token}`;
  const isDraftish = quote.status === "REQUESTED" || quote.status === "DRAFT";
  const hasItems = quote.items.length > 0;
  const canSend = isDraftish && hasItems;
  const canSaveDraft = isDraftish;
  const canCancel =
    quote.status !== "CANCELLED" && quote.status !== "FULLY_ACCEPTED";

  const STATUS_LABEL: Record<string, string> = {
    REQUESTED: "Trả lời chờ xử lý",
    DRAFT: "Bản nháp",
    SENT: "Đã gửi cho khách hàng",
    PARTIALLY_ACCEPTED: "Đã chấp nhận một phần",
    FULLY_ACCEPTED: "Đã chấp nhận toàn bộ",
    EXPIRED: "Hết hạn",
    CANCELLED: "Đã hủy",
  };
  const statusLabel = STATUS_LABEL[quote.status] ?? quote.status;

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(publicLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  }

  async function handleAddItem() {
    if (!newItem.name || !newItem.unitPrice) return;
    try {
      await addItemMutation.mutateAsync(newItem);
    } catch (err) {
      setFeedback(
        (err instanceof AxiosError &&
          (err.response?.data as { error?: { message?: string } })?.error
            ?.message) ||
          "Lỗi khi thêm mục",
      );
    }
  }

  return (
    <div className="container mx-auto max-w-5xl py-6 space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/admin/quotes">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4 mr-1" /> Quay lại
          </Button>
        </Link>
      </div>

      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <p className="text-xs uppercase tracking-wider text-muted-foreground">
            Báo giá
          </p>
          <h1 className="text-2xl font-bold">{quote.number}</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {quote.customerName} · {quote.customerEmail}
            {quote.customerPhone && ` · ${quote.customerPhone}`}
          </p>
        </div>
        <Badge variant="secondary">{statusLabel}</Badge>
      </div>

      {feedback && (
        <div className="rounded-md bg-primary/10 border border-primary/40 px-4 py-2 text-sm">
          {feedback}
        </div>
      )}

      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex-1 min-w-0">
              <p className="text-xs text-muted-foreground mb-1">
                Link công khai
              </p>
              <code className="text-xs break-all">{publicLink}</code>
            </div>
            <Button variant="outline" size="sm" onClick={copyLink}>
              <Copy className="h-3 w-3 mr-1" />
              {copied ? "Đã sao chép!" : "Sao chép liên kết"}
            </Button>
          </div>

          {isDraftish && !hasItems && (
            <div className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-300">
              Thêm ít nhất 1 mục vào báo giá dưới đây trước khi gửi cho khách
              hàng.
            </div>
          )}

          <div className="flex items-center gap-2 flex-wrap">
            {canSaveDraft && (
              <Button
                variant="outline"
                onClick={() =>
                  updateMutation.mutate({
                    adminNotes: adminNotes.trim() || undefined,
                    validityDays: parseInt(validityDays, 10) || 14,
                  })
                }
                disabled={updateMutation.isPending}
              >
                <Save className="h-3 w-3 mr-1" />
                {updateMutation.isPending ? "Đang lưu…" : "Lưu bản nháp"}
              </Button>
            )}
            {canSend && (
              <Button
                onClick={() => sendMutation.mutate()}
                disabled={sendMutation.isPending}
              >
                <Send className="h-3 w-3 mr-1" />
                {sendMutation.isPending
                  ? "Đang gửi…"
                  : quote.sentAt
                    ? "Gửi lại cho khách hàng"
                    : "Gửi cho khách hàng"}
              </Button>
            )}
            {canCancel && (
              <Button
                variant="outline"
                className="text-destructive ml-auto"
                onClick={() => cancelMutation.mutate()}
                disabled={cancelMutation.isPending}
              >
                <XCircle className="h-3 w-3 mr-1" /> Hủy báo giá
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {quote.customerNotes && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Ghi chú của khách hàng</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm whitespace-pre-wrap">{quote.customerNotes}</p>
          </CardContent>
        </Card>
      )}

      {quote.externalLinks.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Liên kết đã gửi</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-1 text-sm">
              {quote.externalLinks.map((url) => (
                <li key={url}>
                  <a
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary underline break-all"
                  >
                    {url}
                  </a>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {quote.images.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Hình ảnh</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {quote.images.map((img) => (
                <img
                  key={img.id}
                  src={img.mediaFile?.card ?? ""}
                  alt=""
                  className="w-24 h-24 object-cover rounded-md border"
                />
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">
            Các mục báo giá ({quote.items.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {quote.items.map((item) => (
            <div
              key={item.id}
              className="flex items-start gap-3 p-3 rounded-md border"
            >
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{item.name}</span>
                  <Badge
                    variant={item.status === "QUOTED" ? "outline" : "secondary"}
                    className="text-[10px]"
                  >
                    {item.status}
                  </Badge>
                </div>
                {item.description && (
                  <p className="text-xs text-muted-foreground mt-1">
                    {item.description}
                  </p>
                )}
                <p className="text-xs text-muted-foreground mt-1">
                  {item.unitPrice.toFixed(2)}đ · tối đa {item.maxQuantity} cái ·{" "}
                  {item.weight}kg · {item.width}×{item.height}×{item.length}cm
                </p>
              </div>
              {item.status === "QUOTED" && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-destructive"
                  onClick={() => deleteItemMutation.mutate(item.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
          ))}
          {quote.items.length === 0 && (
            <p className="text-sm text-muted-foreground">
              Chưa có mục nào. Thêm bên dưới.
            </p>
          )}
        </CardContent>
      </Card>

      {isDraftish && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Thêm mục</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid md:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Tên</Label>
                <Input
                  value={newItem.name}
                  onChange={(e) =>
                    setNewItem((p) => ({ ...p, name: e.target.value }))
                  }
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Đơn giá (VND)</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={newItem.unitPrice}
                  onChange={(e) =>
                    setNewItem((p) => ({ ...p, unitPrice: e.target.value }))
                  }
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Mô tả (tùy chọn)</Label>
              <Textarea
                value={newItem.description}
                onChange={(e) =>
                  setNewItem((p) => ({ ...p, description: e.target.value }))
                }
                rows={2}
              />
            </div>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Số lượng tối đa</Label>
                <Input
                  type="number"
                  min="1"
                  value={newItem.maxQuantity}
                  onChange={(e) =>
                    setNewItem((p) => ({ ...p, maxQuantity: e.target.value }))
                  }
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Cân nặng (kg)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={newItem.weight}
                  onChange={(e) =>
                    setNewItem((p) => ({ ...p, weight: e.target.value }))
                  }
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Chiều rộng (cm)</Label>
                <Input
                  type="number"
                  step="0.1"
                  value={newItem.width}
                  onChange={(e) =>
                    setNewItem((p) => ({ ...p, width: e.target.value }))
                  }
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Chiều cao (cm)</Label>
                <Input
                  type="number"
                  step="0.1"
                  value={newItem.height}
                  onChange={(e) =>
                    setNewItem((p) => ({ ...p, height: e.target.value }))
                  }
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Chiều dài (cm)</Label>
                <Input
                  type="number"
                  step="0.1"
                  value={newItem.length}
                  onChange={(e) =>
                    setNewItem((p) => ({ ...p, length: e.target.value }))
                  }
                />
              </div>
            </div>
            <Button
              onClick={handleAddItem}
              disabled={
                !newItem.name.trim() ||
                !newItem.unitPrice.trim() ||
                addItemMutation.isPending
              }
            >
              <Plus className="h-4 w-4 mr-1" /> Thêm mục
            </Button>
          </CardContent>
        </Card>
      )}

      {isDraftish && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Cấu hình vận chuyển</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1">
              <Label className="text-xs">Thời hạn (ngày)</Label>
              <Input
                type="number"
                min="1"
                max="365"
                value={validityDays}
                onChange={(e) => setValidityDays(e.target.value)}
                className="max-w-[160px]"
              />
              <p className="text-xs text-muted-foreground">
                Khách hàng nhìn thấy đếm ngược trên trang báo giá.
              </p>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">
                Ghi chú nội bộ (không hiển thị cho khách hàng)
              </Label>
              <Textarea
                value={adminNotes}
                onChange={(e) => setAdminNotes(e.target.value)}
                rows={3}
              />
            </div>
            <Button
              variant="outline"
              onClick={() =>
                updateMutation.mutate({
                  adminNotes: adminNotes.trim() || undefined,
                })
              }
              disabled={updateMutation.isPending}
            >
              <Save className="h-4 w-4 mr-1" /> Lưu ghi chú
            </Button>
          </CardContent>
        </Card>
      )}

      <p className="text-xs text-muted-foreground">
        Tạo lúc {formatDateTime(quote.createdAt)}
        {quote.sentAt && ` · Đã gửi lúc ${formatDateTime(quote.sentAt)}`}
      </p>
    </div>
  );
}
