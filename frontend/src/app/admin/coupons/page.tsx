"use client";
import type { ApiRecord } from "@/types/api";

import { useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Pencil, Trash2, X, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { api } from "@/lib/api-client";
import { formatCurrency, formatDate } from "@/lib/constants";

import { extractError } from "@/lib/extract-error";
interface CouponForm {
  code: string;
  type: "PERCENTAGE" | "FIXED" | "FREE_SHIPPING";
  value: string;
  minOrderValue: string;
  maxUses: string;
  usesPerUser: string;
  validFrom: string;
  validUntil: string;
  isFirstPurchaseOnly: boolean;
  isFreeShipping: boolean;
  isActive: boolean;
  categoryId: string;
  tagId: string;
  userId: string;
  userDisplay: string;
  affiliateId: string;
  affiliateDisplay: string;

  stackable: boolean;
  stackableWithIds: string[];
}

const emptyForm: CouponForm = {
  code: "",
  type: "PERCENTAGE",
  value: "",
  minOrderValue: "",
  maxUses: "",
  usesPerUser: "",
  validFrom: "",
  validUntil: "",
  isFirstPurchaseOnly: false,
  isFreeShipping: false,
  isActive: true,
  categoryId: "",
  tagId: "",
  userId: "",
  userDisplay: "",
  affiliateId: "",
  affiliateDisplay: "",
  stackable: false,
  stackableWithIds: [],
};

function generateRandomCode(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let code = "";
  for (let i = 0; i < 10; i++)
    code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

function formToPayload(form: CouponForm) {
  return {
    code: form.code.toUpperCase().trim(),
    type: form.type,
    value: parseFloat(form.value),
    minOrderValue: form.minOrderValue
      ? parseFloat(form.minOrderValue)
      : undefined,
    maxUses: form.maxUses ? parseInt(form.maxUses, 10) : undefined,
    usesPerUser: form.usesPerUser ? parseInt(form.usesPerUser, 10) : undefined,
    validFrom: form.validFrom
      ? new Date(form.validFrom).toISOString()
      : undefined,
    validUntil: form.validUntil
      ? new Date(form.validUntil).toISOString()
      : undefined,
    isFirstPurchaseOnly: form.isFirstPurchaseOnly,
    isFreeShipping: form.isFreeShipping,
    isActive: form.isActive,
    categoryId: form.categoryId || undefined,
    tagId: form.tagId || undefined,
    userId: form.userId || undefined,
    affiliateId: form.affiliateId || null,
    stackable: form.stackable,

    stackableWithIds: form.stackableWithIds,
  };
}

function formatDisplayValue(coupon: ApiRecord): string {
  if (coupon.type === "PERCENTAGE") return `${coupon.value}%`;
  if (coupon.type === "FIXED") return formatCurrency(coupon.value);
  return "Miễn phí vận chuyển";
}

function formatDateForInput(dateStr?: string): string {
  if (!dateStr) return "";
  return new Date(dateStr).toISOString().slice(0, 16);
}

function UserSearch({
  selectedUserId,
  selectedUserDisplay,
  onSelect,
}: {
  selectedUserId: string;
  selectedUserDisplay: string;
  onSelect: (userId: string, display: string) => void;
}) {
  const [search, setSearch] = useState("");
  const [showResults, setShowResults] = useState(false);

  const { data: users } = useQuery({
    queryKey: ["admin", "users-search", search],
    queryFn: async () => {
      if (!search || search.length < 3) return [];
      const { data } = await api.get(
        `/users?search=${encodeURIComponent(search)}&perPage=5`,
      );
      return (data.data ?? data) as ApiRecord[];
    },
    enabled: search.length >= 3,
  });

  const handleSelect = useCallback(
    (user: ApiRecord) => {
      onSelect(user.id as string, `${user.name} (${user.email})`);
      setSearch("");
      setShowResults(false);
    },
    [onSelect],
  );

  return (
    <div className="space-y-1">
      <Label className="text-xs">Khách hàng riêng</Label>
      {selectedUserId ? (
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="text-xs py-1">
            {selectedUserDisplay}
          </Badge>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={() => onSelect("", "")}
          >
            <X className="h-3 w-3" />
          </Button>
        </div>
      ) : (
        <div className="relative">
          <div className="relative">
            <Search className="absolute left-2 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Tìm kiếm theo email..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setShowResults(true);
              }}
              onFocus={() => setShowResults(true)}
              onBlur={() => setTimeout(() => setShowResults(false), 200)}
              className="pl-8 h-9"
            />
          </div>
          {showResults && users && users.length > 0 && (
            <div className="absolute z-50 mt-1 w-full bg-popover border rounded-md shadow-md max-h-40 overflow-y-auto">
              {users.map((user: ApiRecord) => (
                <button
                  key={user.id}
                  type="button"
                  className="w-full text-left px-3 py-2 text-sm hover:bg-accent cursor-pointer"
                  onMouseDown={() => handleSelect(user)}
                >
                  <span className="font-medium">{user.name}</span>
                  <span className="text-muted-foreground ml-2">
                    {user.email}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function AffiliateSearch({
  selectedAffiliateId,
  selectedAffiliateDisplay,
  onSelect,
}: {
  selectedAffiliateId: string;
  selectedAffiliateDisplay: string;
  onSelect: (affiliateId: string, display: string) => void;
}) {
  const [search, setSearch] = useState("");
  const [showResults, setShowResults] = useState(false);

  const { data: affiliates } = useQuery({
    queryKey: ["admin", "affiliates-search", search],
    queryFn: async () => {
      if (!search || search.length < 3) return [];
      const { data } = await api.get(
        `/admin/affiliates?q=${encodeURIComponent(search)}&status=APPROVED&perPage=5`,
      );
      return (data.data ?? []) as Array<{
        id: string;
        publicId: number;
        user: { name: string | null; email: string };
      }>;
    },
    enabled: search.length >= 3,
  });

  const handleSelect = useCallback(
    (aff: {
      id: string;
      publicId: number;
      user: { name: string | null; email: string };
    }) => {
      const display = `#${aff.publicId} ${aff.user.name ?? aff.user.email}`;
      onSelect(aff.id, display);
      setSearch("");
      setShowResults(false);
    },
    [onSelect],
  );

  return (
    <div className="space-y-1">
      <Label className="text-xs">
        Gán cho Affiliate
        <span className="ml-1 text-muted-foreground text-[10px]">
          (chỉ dành cho APPROVED — hoa hồng sẽ được cộng cho affiliate khi mã
          được sử dụng)
        </span>
      </Label>
      {selectedAffiliateId ? (
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="text-xs py-1">
            {selectedAffiliateDisplay}
          </Badge>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={() => onSelect("", "")}
          >
            <X className="h-3 w-3" />
          </Button>
        </div>
      ) : (
        <div className="relative">
          <div className="relative">
            <Search className="absolute left-2 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Tìm kiếm theo tên hoặc email..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setShowResults(true);
              }}
              onFocus={() => setShowResults(true)}
              onBlur={() => setTimeout(() => setShowResults(false), 200)}
              className="pl-8 h-9"
            />
          </div>
          {showResults && affiliates && affiliates.length > 0 && (
            <div className="absolute z-50 mt-1 w-full bg-popover border rounded-md shadow-md max-h-40 overflow-y-auto">
              {affiliates.map((aff) => (
                <button
                  key={aff.id}
                  type="button"
                  className="w-full text-left px-3 py-2 text-sm hover:bg-accent cursor-pointer"
                  onMouseDown={() => handleSelect(aff)}
                >
                  <span className="text-[11px] text-purple mr-2">
                    #{aff.publicId}
                  </span>
                  <span className="font-medium">
                    {aff.user.name ?? "(không có tên)"}
                  </span>
                  <span className="text-muted-foreground ml-2 text-xs">
                    {aff.user.email}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function StackingFields({
  form,
  updateField,
  allCoupons,
  editingId,
}: {
  form: CouponForm;
  updateField: <K extends keyof CouponForm>(
    key: K,
    value: CouponForm[K],
  ) => void;
  allCoupons: ApiRecord[];
  editingId: string | null;
}) {
  const candidates = allCoupons.filter(
    (c) => c.id !== editingId && c.isActive !== false,
  );

  function toggleId(id: string) {
    const has = form.stackableWithIds.includes(id);
    const updated = has
      ? form.stackableWithIds.filter((x) => x !== id)
      : [...form.stackableWithIds, id];
    updateField("stackableWithIds", updated);
  }

  return (
    <div className="rounded-lg border p-4 space-y-3 bg-muted/20">
      <div className="flex items-center gap-2">
        <Switch
          checked={form.stackable}
          onCheckedChange={(v) => updateField("stackable", v)}
        />
        <Label className="text-sm font-medium">
          Cho phép tích lũy với các mã khác
        </Label>
      </div>
      <p className="text-[11px] text-muted-foreground">
        Khi tắt, mã này sẽ <strong>độc quyền</strong> — khách hàng cố gắng sử
        dụng với một mã khác sẽ nhận được thông báo lỗi yêu cầu xóa mã kia. Giới
        hạn tối đa: 3 mã mỗi đơn hàng.
      </p>

      {form.stackable && (
        <div className="space-y-2 pt-2 border-t border-border/40">
          <Label className="text-xs">Tích lũy với</Label>
          <p className="text-[11px] text-muted-foreground">
            Chọn các mã cụ thể để sử dụng cùng với mã này. Nếu không có mã nào
            được chọn, mã này sẽ tích lũy với bất kỳ mã nào khác cũng được đánh
            dấu là có thể tích lũy. <strong>Quan trọng:</strong> quy tắc là hai
            chiều — mã khác cũng cần cho phép mã này.
          </p>
          {candidates.length === 0 ? (
            <p className="text-xs text-muted-foreground italic">
              Không có mã nào khác được kích hoạt.
            </p>
          ) : (
            <div className="max-h-40 overflow-y-auto rounded border bg-background p-2 space-y-1">
              {candidates.map((c) => {
                const id = c.id as string;
                const checked = form.stackableWithIds.includes(id);
                return (
                  <label
                    key={id}
                    className="flex items-center gap-2 px-2 py-1 rounded hover:bg-muted cursor-pointer text-sm"
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleId(id)}
                      className="h-4 w-4 cursor-pointer"
                    />
                    <span className="font-mono text-xs">
                      {c.code as string}
                    </span>
                    {c.stackable === false && (
                      <span className="ml-auto text-[10px] text-magenta">
                        (không thể tích lũy — không hoạt động)
                      </span>
                    )}
                  </label>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function RestrictionFields({
  form,
  updateField,
  categories,
  tags,
}: {
  form: CouponForm;
  updateField: <K extends keyof CouponForm>(
    key: K,
    value: CouponForm[K],
  ) => void;
  categories: ApiRecord[];
  tags: ApiRecord[];
}) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <div className="space-y-1">
        <Label className="text-xs">Hạn chế theo danh mục</Label>
        <Select
          value={form.categoryId || "_none"}
          onValueChange={(v) =>
            updateField("categoryId", !v || v === "_none" ? "" : v)
          }
        >
          <SelectTrigger>
            <SelectValue placeholder="Tất cả" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="_none">Tất cả danh mục</SelectItem>
            {categories.map((cat) => (
              <SelectItem key={cat.id} value={cat.id as string}>
                {cat.name as string}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1">
        <Label className="text-xs">Hạn chế theo tag</Label>
        <Select
          value={form.tagId || "_none"}
          onValueChange={(v) =>
            updateField("tagId", !v || v === "_none" ? "" : v)
          }
        >
          <SelectTrigger>
            <SelectValue placeholder="Tất cả" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="_none">Tất cả tag</SelectItem>
            {tags.map((tag) => (
              <SelectItem key={tag.id} value={tag.id as string}>
                {tag.name as string}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <UserSearch
        selectedUserId={form.userId}
        selectedUserDisplay={form.userDisplay}
        onSelect={(userId, display) => {
          updateField("userId", userId);
          updateField("userDisplay", display);
        }}
      />
      <AffiliateSearch
        selectedAffiliateId={form.affiliateId}
        selectedAffiliateDisplay={form.affiliateDisplay}
        onSelect={(affiliateId, display) => {
          updateField("affiliateId", affiliateId);
          updateField("affiliateDisplay", display);
        }}
      />
    </div>
  );
}

export default function AdminCouponsPage() {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<CouponForm>({ ...emptyForm });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [error, setError] = useState("");

  const { data: coupons, isLoading } = useQuery({
    queryKey: ["admin", "coupons"],
    queryFn: async () => {
      const { data } = await api.get("/coupons");
      return data.data ?? data;
    },
  });

  const { data: categories = [] } = useQuery({
    queryKey: ["admin", "categories-list"],
    queryFn: async () => {
      const { data } = await api.get("/categories");
      return (data.data ?? data) as ApiRecord[];
    },
  });

  const { data: tags = [] } = useQuery({
    queryKey: ["admin", "tags-list"],
    queryFn: async () => {
      const { data } = await api.get("/tags");
      return (data.data ?? data) as ApiRecord[];
    },
  });

  const createMutation = useMutation({
    mutationFn: () => {
      const { isActive, ...rest } = form;
      return api.post("/coupons", formToPayload(rest as any));
    },
    onSuccess: () => {
      setError("");
      setForm({ ...emptyForm });
      queryClient.invalidateQueries({ queryKey: ["admin", "coupons"] });
    },
    onError: (err) => setError(extractError(err)),
  });

  const updateMutation = useMutation({
    mutationFn: (id: string) => api.put(`/coupons/${id}`, formToPayload(form)),
    onSuccess: () => {
      setError("");
      setEditingId(null);
      setDialogOpen(false);
      setForm({ ...emptyForm });
      queryClient.invalidateQueries({ queryKey: ["admin", "coupons"] });
    },
    onError: (err) => setError(extractError(err)),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/coupons/${id}`),
    onSuccess: () => {
      setError("");
      queryClient.invalidateQueries({ queryKey: ["admin", "coupons"] });
    },
    onError: (err) => setError(extractError(err)),
  });

  function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    createMutation.mutate();
  }

  function openEdit(coupon: ApiRecord) {
    setEditingId(coupon.id as string);
    setForm({
      code: coupon.code as string,
      type: coupon.type as CouponForm["type"],
      value: String(coupon.value),
      minOrderValue: coupon.minOrderValue ? String(coupon.minOrderValue) : "",
      maxUses: coupon.maxUses ? String(coupon.maxUses) : "",
      usesPerUser: coupon.usesPerUser ? String(coupon.usesPerUser) : "",
      validFrom: formatDateForInput(coupon.validFrom as string),
      validUntil: formatDateForInput(coupon.validUntil as string),
      isFirstPurchaseOnly: !!coupon.isFirstPurchaseOnly,
      isFreeShipping: !!coupon.isFreeShipping,
      isActive: coupon.isActive !== false,
      categoryId: (coupon.categoryId as string) ?? "",
      tagId: (coupon.tagId as string) ?? "",
      userId: (coupon.userId as string) ?? "",
      userDisplay: coupon.user
        ? `${(coupon.user as ApiRecord).name} (${(coupon.user as ApiRecord).email})`
        : "",
      affiliateId: (coupon.affiliateId as string) ?? "",
      affiliateDisplay: coupon.affiliate
        ? (() => {
            const aff = coupon.affiliate as ApiRecord;
            const u = (aff.user as ApiRecord) || {};
            return `#${aff.publicId} ${(u.name as string) ?? (u.email as string) ?? ""}`;
          })()
        : "",
      stackable: !!coupon.stackable,
      stackableWithIds: Array.isArray(coupon.stackableWith)
        ? (coupon.stackableWith as ApiRecord[]).map((c) => c.id as string)
        : [],
    });
    setError("");
    setDialogOpen(true);
  }

  function closeDialog() {
    setDialogOpen(false);
    setEditingId(null);
    setForm({ ...emptyForm });
    setError("");
  }

  function handleDelete(id: string, code: string) {
    if (confirm(`Chắc chắn muốn vô hiệu hóa mã "${code}" không?`)) {
      deleteMutation.mutate(id);
    }
  }

  function updateField<K extends keyof CouponForm>(
    key: K,
    value: CouponForm[K],
  ) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  const typeLabels: Record<string, string> = {
    PERCENTAGE: "Phần trăm",
    FIXED: "Giá trị cố định",
    FREE_SHIPPING: "Miễn phí vận chuyển",
  };

  return (
    <div>
      <h1 className="text-3xl font-bold mb-6">Mã giảm giá</h1>

      {error && !dialogOpen && (
        <div className="bg-destructive/10 text-destructive border border-destructive/20 rounded-md px-4 py-3 mb-4 text-sm">
          {error}
        </div>
      )}

      <form
        onSubmit={handleCreate}
        className="border rounded-lg p-4 mb-6 space-y-4"
      >
        <h2 className="text-lg font-semibold">Tạo mã giảm giá</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="space-y-1">
            <Label className="text-xs">Mã</Label>
            <div className="flex gap-1.5">
              <Input
                placeholder="GIAM10"
                value={form.code}
                onChange={(e) =>
                  updateField("code", e.target.value.toUpperCase())
                }
                required
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="shrink-0 text-xs px-2"
                onClick={() => updateField("code", generateRandomCode())}
                title="Tạo mã ngẫu nhiên"
              >
                Tạo
              </Button>
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Loại</Label>
            <Select
              value={form.type}
              onValueChange={(v) =>
                updateField("type", v as CouponForm["type"])
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="PERCENTAGE">Phần trăm (%)</SelectItem>
                <SelectItem value="FIXED">Giá trị cố định (VND)</SelectItem>
                <SelectItem value="FREE_SHIPPING">
                  Miễn phí vận chuyển
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Giá trị</Label>
            <Input
              type="number"
              step="0.01"
              min="0"
              placeholder={form.type === "PERCENTAGE" ? "10" : "25.00"}
              value={form.value}
              onChange={(e) => updateField("value", e.target.value)}
              required
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Giá trị đơn hàng tối thiểu (VND)</Label>
            <Input
              type="number"
              step="0.01"
              min="0"
              placeholder="100.00"
              value={form.minOrderValue}
              onChange={(e) => updateField("minOrderValue", e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Số lần sử dụng tối đa</Label>
            <Input
              type="number"
              min="0"
              placeholder="Ilimitado"
              value={form.maxUses}
              onChange={(e) => updateField("maxUses", e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Số lần sử dụng cho mỗi người dùng</Label>
            <Input
              type="number"
              min="0"
              placeholder="Ilimitado"
              value={form.usesPerUser}
              onChange={(e) => updateField("usesPerUser", e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Ngày bắt đầu</Label>
            <Input
              type="datetime-local"
              value={form.validFrom}
              onChange={(e) => updateField("validFrom", e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Ngày hết hạn</Label>
            <Input
              type="datetime-local"
              value={form.validUntil}
              onChange={(e) => updateField("validUntil", e.target.value)}
            />
          </div>
        </div>

        <RestrictionFields
          form={form}
          updateField={updateField}
          categories={categories}
          tags={tags}
        />

        <div className="flex items-center gap-6 flex-wrap">
          <div className="flex items-center gap-2">
            <Switch
              checked={form.isFirstPurchaseOnly}
              onCheckedChange={(v) => updateField("isFirstPurchaseOnly", v)}
            />
            <Label className="text-sm">Chỉ áp dụng cho lần mua đầu tiên</Label>
          </div>
          {form.type !== "FREE_SHIPPING" && (
            <div className="flex items-center gap-2">
              <Switch
                checked={form.isFreeShipping}
                onCheckedChange={(v) => updateField("isFreeShipping", v)}
              />
              <Label className="text-sm">Miễn phí vận chuyển</Label>
            </div>
          )}
        </div>

        <StackingFields
          form={form}
          updateField={updateField}
          allCoupons={coupons ?? []}
          editingId={editingId}
        />

        <div className="flex items-center gap-6 flex-wrap">
          <Button type="submit" disabled={createMutation.isPending}>
            <Plus className="h-4 w-4 mr-2" />
            Tạo mã giảm giá
          </Button>
        </div>
      </form>

      {isLoading ? (
        <p className="text-muted-foreground">Đang tải...</p>
      ) : (
        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Mã</TableHead>
                <TableHead>Loại</TableHead>
                <TableHead>Giá trị</TableHead>
                <TableHead>Đơn hàng tối thiểu</TableHead>
                <TableHead>Số lần sử dụng</TableHead>
                <TableHead>Ngày hết hạn</TableHead>
                <TableHead>Hạn chế</TableHead>
                <TableHead>Trạng thái</TableHead>
                <TableHead className="w-24">Thao tác</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {coupons?.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={9}
                    className="text-center text-muted-foreground py-8"
                  >
                    Chưa có mã giảm giá nào.
                  </TableCell>
                </TableRow>
              )}
              {coupons?.map((coupon: ApiRecord) => (
                <TableRow key={coupon.id}>
                  <TableCell>
                    <button
                      type="button"
                      className="font-mono font-medium text-primary hover:underline cursor-pointer"
                      onClick={() => openEdit(coupon)}
                    >
                      {coupon.code}
                    </button>
                  </TableCell>
                  <TableCell className="text-sm">
                    {typeLabels[coupon.type as string] ?? coupon.type}
                  </TableCell>
                  <TableCell className="font-medium">
                    {formatDisplayValue(coupon)}
                  </TableCell>
                  <TableCell className="text-sm">
                    {coupon.minOrderValue
                      ? formatCurrency(coupon.minOrderValue)
                      : "-"}
                  </TableCell>
                  <TableCell className="text-sm">
                    {coupon._count?.usages ?? 0}
                    {coupon.maxUses ? `/${coupon.maxUses}` : ""}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {coupon.validUntil
                      ? formatDate(coupon.validUntil as string)
                      : "Không có hạn"}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {coupon.category && (
                        <Badge variant="outline" className="text-xs">
                          Danh mục: {(coupon.category as ApiRecord).name}
                        </Badge>
                      )}
                      {coupon.tag && (
                        <Badge variant="outline" className="text-xs">
                          Nhãn: {(coupon.tag as ApiRecord).name}
                        </Badge>
                      )}
                      {coupon.user && (
                        <Badge variant="outline" className="text-xs">
                          {(coupon.user as ApiRecord).email}
                        </Badge>
                      )}
                      {coupon.affiliate && (
                        <Badge
                          variant="outline"
                          className="text-xs border-purple/40 text-purple"
                          title={`Người giới thiệu #${(coupon.affiliate as ApiRecord).publicId}`}
                        >
                          Người giới thiệu #
                          {(coupon.affiliate as ApiRecord).publicId}
                        </Badge>
                      )}
                      {coupon.isFirstPurchaseOnly && (
                        <Badge variant="outline" className="text-xs">
                          Chỉ áp dụng cho lần mua đầu tiên
                        </Badge>
                      )}
                      {coupon.isFreeShipping &&
                        coupon.type !== "FREE_SHIPPING" && (
                          <Badge variant="secondary" className="text-xs">
                            + Miễn phí vận chuyển
                          </Badge>
                        )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={coupon.isActive ? "default" : "secondary"}>
                      {coupon.isActive ? "Hoạt động" : "Không hoạt động"}
                    </Badge>
                    {coupon.isFirstPurchaseOnly && (
                      <Badge variant="outline" className="ml-1 text-xs">
                        Chỉ áp dụng cho lần mua đầu tiên
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => openEdit(coupon)}
                        title="Chỉnh sửa"
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() =>
                          handleDelete(
                            coupon.id as string,
                            coupon.code as string,
                          )
                        }
                        disabled={deleteMutation.isPending}
                        title="Xóa"
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog
        open={dialogOpen}
        onOpenChange={(open) => {
          if (!open) closeDialog();
        }}
      >
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Chỉnh sửa mã giảm giá</DialogTitle>
          </DialogHeader>

          {error && dialogOpen && (
            <div className="bg-destructive/10 text-destructive border border-destructive/20 rounded-md px-4 py-3 text-sm">
              {error}
            </div>
          )}

          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (editingId) updateMutation.mutate(editingId);
            }}
            className="space-y-4"
          >
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label className="text-xs">Mã</Label>
                <div className="flex gap-1.5">
                  <Input
                    value={form.code}
                    onChange={(e) =>
                      updateField("code", e.target.value.toUpperCase())
                    }
                    required
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="shrink-0 text-xs px-2"
                    onClick={() => updateField("code", generateRandomCode())}
                    title="Tạo mã ngẫu nhiên"
                  >
                    Tạo
                  </Button>
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Loại</Label>
                <Select
                  value={form.type}
                  onValueChange={(v) =>
                    updateField("type", v as CouponForm["type"])
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PERCENTAGE">
                      Theo phần trăm (%)
                    </SelectItem>
                    <SelectItem value="FIXED">Giá trị cố định (VNĐ)</SelectItem>
                    <SelectItem value="FREE_SHIPPING">
                      Miễn phí vận chuyển
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Giá trị</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={form.value}
                  onChange={(e) => updateField("value", e.target.value)}
                  required
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Đơn hàng tối thiểu (VNĐ)</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={form.minOrderValue}
                  onChange={(e) => updateField("minOrderValue", e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Số lần sử dụng tối đa</Label>
                <Input
                  type="number"
                  min="0"
                  value={form.maxUses}
                  onChange={(e) => updateField("maxUses", e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Số lần sử dụng mỗi người</Label>
                <Input
                  type="number"
                  min="0"
                  value={form.usesPerUser}
                  onChange={(e) => updateField("usesPerUser", e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Còn hiệu lực từ</Label>
                <Input
                  type="datetime-local"
                  value={form.validFrom}
                  onChange={(e) => updateField("validFrom", e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Hết hạn vào</Label>
                <Input
                  type="datetime-local"
                  value={form.validUntil}
                  onChange={(e) => updateField("validUntil", e.target.value)}
                />
              </div>
            </div>

            <RestrictionFields
              form={form}
              updateField={updateField}
              categories={categories}
              tags={tags}
            />

            <div className="flex items-center gap-6 flex-wrap">
              <div className="flex items-center gap-2">
                <Switch
                  checked={form.isActive}
                  onCheckedChange={(v) => updateField("isActive", v)}
                />
                <Label className="text-sm">Đang hoạt động</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  checked={form.isFirstPurchaseOnly}
                  onCheckedChange={(v) => updateField("isFirstPurchaseOnly", v)}
                />
                <Label className="text-sm">
                  Chỉ dành cho khách hàng lần đầu
                </Label>
              </div>
              {form.type !== "FREE_SHIPPING" && (
                <div className="flex items-center gap-2">
                  <Switch
                    checked={form.isFreeShipping}
                    onCheckedChange={(v) => updateField("isFreeShipping", v)}
                  />
                  <Label className="text-sm">Bao gồm phí vận chuyển</Label>
                </div>
              )}
            </div>

            <StackingFields
              form={form}
              updateField={updateField}
              allCoupons={coupons ?? []}
              editingId={editingId}
            />

            <div className="flex gap-2 justify-end">
              <Button type="button" variant="outline" onClick={closeDialog}>
                <X className="h-4 w-4 mr-2" />
                Hủy
              </Button>
              <Button type="submit" disabled={updateMutation.isPending}>
                Lưu
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
