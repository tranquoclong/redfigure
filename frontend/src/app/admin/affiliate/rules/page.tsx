"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Percent,
  Plus,
  Trash2,
  AlertCircle,
  ArrowLeft,
  Package,
  Tag,
  FolderTree,
  Loader2,
  Save,
} from "lucide-react";
import { api } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { extractError } from "@/lib/extract-error";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type Scope = "PRODUCT" | "TAG" | "CATEGORY";

interface CommissionRule {
  id: string;
  scope: Scope;
  rate: string;
  productId: string | null;
  tagId: string | null;
  categoryId: string | null;
  product: { id: string; name: string; slug: string } | null;
  tag: { id: string; name: string; slug: string } | null;
  category: { id: string; name: string; slug: string } | null;
  createdAt: string;
}

interface Meta {
  total: number;
  page: number;
  perPage: number;
  lastPage: number;
}

function SCOPE_LABEL(scope: Scope) {
  if (scope === "PRODUCT") return "product";
  if (scope === "TAG") return "Tag";
  return "Categoria";
}

function SCOPE_ICON(scope: Scope) {
  if (scope === "PRODUCT") return Package;
  if (scope === "TAG") return Tag;
  return FolderTree;
}

export default function AffiliateRulesPage() {
  const qc = useQueryClient();
  const [scopeFilter, setScopeFilter] = useState<Scope | "ALL">("ALL");
  const [createOpen, setCreateOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["admin", "affiliate-rules", scopeFilter],
    queryFn: async () => {
      const { data } = await api.get<{ data: CommissionRule[]; meta: Meta }>(
        "/admin/affiliate-rules",
        {
          params: scopeFilter !== "ALL" ? { scope: scopeFilter } : {},
        },
      );
      return data;
    },
  });

  const updateRate = useMutation({
    mutationFn: async ({ id, rate }: { id: string; rate: number }) => {
      const { data } = await api.patch(`/admin/affiliate-rules/${id}`, {
        rate,
      });
      return data.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "affiliate-rules"] });
      setError(null);
    },
    onError: (err) => setError(extractError(err)),
  });

  const deleteRule = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/admin/affiliate-rules/${id}`);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "affiliate-rules"] });
      setError(null);
    },
    onError: (err) => setError(extractError(err)),
  });

  const rules = data?.data ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link
          href="/admin/affiliate"
          className="inline-flex items-center gap-1 hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" />
          CTV
        </Link>
        <span>/</span>
        <span>Tỷ lệ hoa hồng</span>
      </div>

      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <Percent className="h-7 w-7 text-purple" />
          <div>
            <h1 className="text-2xl font-bold">Tỷ lệ hoa hồng</h1>
            <p className="text-xs text-muted-foreground">
              Thứ tự ưu tiên:{" "}
              <strong>
                Sản phẩm &gt; Tag &gt; Danh mục &gt; Mặc định (setting{" "}
                <code>affiliate_default_commission_rate</code>)
              </strong>
              . Tỷ lệ <code>0</code> sẽ chặn. Với nhiều tag/category cùng cấp,
              tỷ lệ cao nhất sẽ thắng; bất kỳ tỷ lệ 0 nào cũng sẽ chặn cấp đó.
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Select
            value={scopeFilter}
            onValueChange={(v) => setScopeFilter(v as Scope | "ALL")}
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Chọn phạm vi" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Tất cả</SelectItem>
              <SelectItem value="PRODUCT">Sản phẩm</SelectItem>
              <SelectItem value="TAG">Tag</SelectItem>
              <SelectItem value="CATEGORY">Danh mục</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Tạo quy tắc mới
          </Button>
        </div>
      </div>

      {error && (
        <div className="flex gap-2 items-start text-sm text-destructive bg-destructive/10 border border-destructive/30 rounded-md px-3 py-2">
          <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
          <span>{error}</span>
          <button
            type="button"
            onClick={() => setError(null)}
            className="ml-auto text-xs underline hover:text-destructive-foreground"
          >
            Đóng
          </button>
        </div>
      )}

      {isLoading ? (
        <p className="text-muted-foreground">Đang tải...</p>
      ) : rules.length === 0 ? (
        <div className="rounded-2xl border border-white/10 bg-ink-soft p-8 text-center text-sm text-muted-foreground">
          Chưa có quy tắc nào được ghi nhận. Tỷ lệ mặc định (setting{" "}
          <code>affiliate_default_commission_rate</code>) được áp dụng cho tất
          cả sản phẩm.
        </div>
      ) : (
        <div className="rounded-2xl border border-white/10 bg-ink-soft overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-white/5 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="text-left px-4 py-2">Phạm vi</th>
                <th className="text-left px-4 py-2">Mục tiêu</th>
                <th className="text-left px-4 py-2 w-32">Rate (%)</th>
                <th className="text-right px-4 py-2 w-20">Hành động</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {rules.map((r) => {
                const Icon = SCOPE_ICON(r.scope);
                const target =
                  r.product?.name ?? r.tag?.name ?? r.category?.name ?? "?";
                return (
                  <tr key={r.id}>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-1.5 text-xs">
                        <Icon className="h-3.5 w-3.5" />
                        {SCOPE_LABEL(r.scope)}
                      </span>
                    </td>
                    <td className="px-4 py-3">{target}</td>
                    <td className="px-4 py-3">
                      <RateEditor
                        key={r.rate}
                        initialRate={r.rate}
                        onSave={(rate) => updateRate.mutate({ id: r.id, rate })}
                        disabled={updateRate.isPending}
                      />
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => {
                          if (
                            confirm(
                              `Xóa quy tắc ${SCOPE_LABEL(r.scope)}: ${target}?`,
                            )
                          ) {
                            deleteRule.mutate(r.id);
                          }
                        }}
                        disabled={deleteRule.isPending}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <CreateRuleDialog
        open={createOpen}
        onOpenChange={(open) => {
          setCreateOpen(open);
          if (!open) setError(null);
        }}
        onSuccess={() => {
          qc.invalidateQueries({ queryKey: ["admin", "affiliate-rules"] });
          setCreateOpen(false);
        }}
        onError={(msg) => setError(msg)}
      />
    </div>
  );
}

function RateEditor({
  initialRate,
  onSave,
  disabled,
}: {
  initialRate: string;
  onSave: (rate: number) => void;
  disabled?: boolean;
}) {
  const [value, setValue] = useState(initialRate);
  const [dirty, setDirty] = useState(false);

  return (
    <div className="flex items-center gap-2">
      <Input
        type="number"
        min={0}
        max={100}
        step="0.01"
        value={value}
        onChange={(e) => {
          setValue(e.target.value);
          setDirty(e.target.value !== initialRate);
        }}
        className="h-8 w-24"
      />
      {dirty && (
        <Button
          size="sm"
          onClick={() => {
            const rate = parseFloat(value);
            if (!Number.isFinite(rate) || rate < 0 || rate > 100) return;
            onSave(rate);
          }}
          disabled={disabled}
          title="Lưu tỷ lệ mới"
        >
          <Save className="h-3.5 w-3.5" />
        </Button>
      )}
    </div>
  );
}

interface Target {
  id: string;
  name: string;
}

function CreateRuleDialog({
  open,
  onOpenChange,
  onSuccess,
  onError,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSuccess: () => void;
  onError: (msg: string) => void;
}) {
  const [scope, setScope] = useState<Scope>("PRODUCT");
  const [targetId, setTargetId] = useState("");
  const [rate, setRate] = useState("5");

  const products = useQuery({
    queryKey: ["admin", "products-picker"],
    queryFn: async () => {
      const { data } = await api.get<{
        data: Array<{ id: string; name: string }>;
      }>("/products", { params: { perPage: 200 } });
      return data.data;
    },
    enabled: open && scope === "PRODUCT",
  });

  const tags = useQuery({
    queryKey: ["admin", "tags-picker"],
    queryFn: async () => {
      const { data } = await api.get<{
        data: Array<{ id: string; name: string }>;
      }>("/tags");
      return data.data ?? data;
    },
    enabled: open && scope === "TAG",
  });

  const categories = useQuery({
    queryKey: ["admin", "categories-picker"],
    queryFn: async () => {
      const { data } = await api.get<{
        data: Array<{ id: string; name: string }>;
      }>("/categories");
      return data.data ?? data;
    },
    enabled: open && scope === "CATEGORY",
  });

  const targets: Target[] =
    scope === "PRODUCT"
      ? (products.data ?? [])
      : scope === "TAG"
        ? (tags.data ?? [])
        : (categories.data ?? []);

  const create = useMutation({
    mutationFn: async () => {
      const rateNum = parseFloat(rate);
      if (!Number.isFinite(rateNum) || rateNum < 0 || rateNum > 100) {
        throw new Error("Tỷ lệ phải từ 0 đến 100");
      }
      if (!targetId) throw new Error("Chọn một mục tiêu");
      const body: {
        scope: Scope;
        rate: number;
        productId?: string;
        tagId?: string;
        categoryId?: string;
      } = {
        scope,
        rate: rateNum,
      };
      if (scope === "PRODUCT") body.productId = targetId;
      if (scope === "TAG") body.tagId = targetId;
      if (scope === "CATEGORY") body.categoryId = targetId;
      const { data } = await api.post("/admin/affiliate-rules", body);
      return data.data;
    },
    onSuccess: () => {
      setTargetId("");
      setRate("5");
      onSuccess();
    },
    onError: (err) => onError(extractError(err)),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Tạo quy tắc mới</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1">
            <Label className="text-xs">Phạm vi</Label>
            <Select
              value={scope}
              onValueChange={(v) => {
                setScope(v as Scope);
                setTargetId("");
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="PRODUCT">Sản phẩm</SelectItem>
                <SelectItem value="TAG">Tag</SelectItem>
                <SelectItem value="CATEGORY">Danh mục</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label className="text-xs">Mục tiêu</Label>
            <Select
              value={targetId}
              onValueChange={(v) => setTargetId(v ?? "")}
              disabled={targets.length === 0}
            >
              <SelectTrigger>
                <SelectValue
                  placeholder={targets.length === 0 ? "Đang tải..." : "Chọn"}
                />
              </SelectTrigger>
              <SelectContent>
                {targets.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label className="text-xs">
              Tỷ lệ (%) — 0 đến 100. Sử dụng 0 để chặn.
            </Label>
            <Input
              type="number"
              min={0}
              max={100}
              step="0.01"
              value={rate}
              onChange={(e) => setRate(e.target.value)}
              placeholder="5.00"
            />
          </div>
        </div>
        <DialogFooter>
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={create.isPending}
          >
            Hủy
          </Button>
          <Button
            onClick={() => create.mutate()}
            disabled={create.isPending || !targetId}
          >
            {create.isPending && (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            )}
            Tạo quy tắc
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
