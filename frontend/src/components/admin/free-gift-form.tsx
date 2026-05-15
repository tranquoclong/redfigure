"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { Save, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { ProductPicker } from "@/components/admin/product-picker";
import { api } from "@/lib/api-client";
import { extractApiError } from "@/lib/extract-error";

export interface FreeGiftFormValues {
  id?: string;
  productId: string | null;
  minOrderAmount: number;
  label: string;
  startsAt: string;
  endsAt: string;
  isActive: boolean;
}

export function FreeGiftForm({ initial }: { initial?: FreeGiftFormValues }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const isEdit = !!initial?.id;

  const [productId, setProductId] = useState<string | null>(
    initial?.productId ?? null,
  );
  const [minOrderAmount, setMinOrderAmount] = useState<string>(
    initial?.minOrderAmount?.toString() ?? "",
  );
  const [label, setLabel] = useState<string>(initial?.label ?? "🎁 Quà tặng");
  const [startsAt, setStartsAt] = useState<string>(initial?.startsAt ?? "");
  const [endsAt, setEndsAt] = useState<string>(initial?.endsAt ?? "");
  const [isActive, setIsActive] = useState<boolean>(initial?.isActive ?? true);
  const [error, setError] = useState("");

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        productId,
        minOrderAmount: Number(minOrderAmount),
        label: label || undefined,

        startsAt: startsAt ? `${startsAt}T00:00:00.000Z` : undefined,
        endsAt: endsAt ? `${endsAt}T23:59:59.999Z` : undefined,
        isActive,
      };
      if (isEdit) {
        return api.patch(`/free-gifts/${initial!.id}`, payload);
      }
      return api.post("/free-gifts", payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "free-gifts"] });
      router.push("/admin/free-gifts");
    },
    onError: (err) => {
      setError(extractApiError(err, "Lỗi khi lưu"));
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!productId) {
      setError("Chọn một sản phẩm cho quà tặng");
      return;
    }
    const min = Number(minOrderAmount);
    if (!Number.isFinite(min) || min <= 0) {
      setError("Giá trị tối thiểu phải lớn hơn 0");
      return;
    }
    if (startsAt && endsAt && endsAt < startsAt) {
      setError("Ngày kết thúc phải sau ngày bắt đầu");
      return;
    }
    saveMutation.mutate();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-2xl">
      <div className="flex items-center gap-3">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => router.push("/admin/free-gifts")}
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Quay lại
        </Button>
        <h1 className="text-2xl font-bold">
          {isEdit ? "Chỉnh sửa quà tặng" : "Quà tặng"}
        </h1>
      </div>

      {error && (
        <div className="bg-destructive/10 text-destructive border border-destructive/20 rounded-md px-4 py-3 text-sm">
          {error}
        </div>
      )}

      <div className="space-y-2">
        <Label>Sản phẩm quà tặng</Label>
        <p className="text-xs text-muted-foreground">
          Chỉ áp dụng cho sản phẩm thông thường (không có biến thể hoặc bộ sưu
          tập). Khách hàng sẽ nhận được 1 sản phẩm khi đạt đủ giá trị tối thiểu.
        </p>
        <ProductPicker
          value={productId}
          onChange={setProductId}
          helperText="Sản phẩm sẽ được tự động thêm vào giỏ hàng"
        />
      </div>

      <div className="space-y-2 max-w-xs">
        <Label htmlFor="min">Giá trị tối thiểu (VND)</Label>
        <Input
          id="min"
          type="number"
          step="0.01"
          min="0.01"
          required
          value={minOrderAmount}
          onChange={(e) => setMinOrderAmount(e.target.value)}
          placeholder="100.00"
        />
        <p className="text-xs text-muted-foreground">
          Tổng giá trị không bao gồm phí vận chuyển.
        </p>
      </div>

      <div className="space-y-2 max-w-md">
        <Label htmlFor="label">Thông báo hiển thị cho khách hàng</Label>
        <Input
          id="label"
          maxLength={80}
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="🎁 Quà tặng!"
        />
      </div>

      <div className="grid grid-cols-2 gap-4 max-w-md">
        <div className="space-y-2">
          <Label htmlFor="starts">Thời gian bắt đầu (tùy chọn)</Label>
          <Input
            id="starts"
            type="date"
            value={startsAt}
            onChange={(e) => setStartsAt(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="ends">Thời gian kết thúc (tùy chọn)</Label>
          <Input
            id="ends"
            type="date"
            value={endsAt}
            onChange={(e) => setEndsAt(e.target.value)}
          />
        </div>
      </div>

      <div className="flex items-center gap-3">
        <Switch id="active" checked={isActive} onCheckedChange={setIsActive} />
        <Label htmlFor="active" className="cursor-pointer">
          Kích hoạt
        </Label>
      </div>

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={saveMutation.isPending}>
          <Save className="h-4 w-4 mr-2" />
          {saveMutation.isPending ? "Đang lưu..." : "Lưu"}
        </Button>
        <Link href="/admin/free-gifts">
          <Button type="button" variant="ghost">
            Hủy
          </Button>
        </Link>
      </div>
    </form>
  );
}
