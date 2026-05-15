"use client";
import type { ApiRecord } from "@/types/api";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Plus,
  Pencil,
  Trash2,
  Check,
  X,
  ChevronRight,
  ChevronDown,
  ImageIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/api-client";
import { GoogleCategoryPicker } from "@/components/admin/google-category-picker";
import { EntityImageDialog } from "@/components/admin/entity-image-dialog";

import { extractError } from "@/lib/extract-error";

function flattenForSelect(
  cats: ApiRecord[],
  depth = 0,
  excludeId?: string,
): Array<{ id: string; name: string; depth: number }> {
  const result: Array<{ id: string; name: string; depth: number }> = [];
  for (const cat of cats) {
    if (cat.id === excludeId) continue;
    result.push({ id: cat.id as string, name: cat.name as string, depth });
    if (cat.children) {
      result.push(
        ...flattenForSelect(cat.children as ApiRecord[], depth + 1, excludeId),
      );
    }
  }
  return result;
}

export default function AdminCategoriesPage() {
  const queryClient = useQueryClient();
  const [newName, setNewName] = useState("");
  const [newExtraDays, setNewExtraDays] = useState("");
  const [newParentId, setNewParentId] = useState("");
  const [error, setError] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editExtraDays, setEditExtraDays] = useState("");
  const [editScaleRuleSetId, setEditScaleRuleSetId] = useState("");
  const [editParentId, setEditParentId] = useState("");

  const [editColorId, setEditColorId] = useState("");
  const [editMaterialId, setEditMaterialId] = useState("");
  const [editGoogleCategoryId, setEditGoogleCategoryId] = useState<
    string | null
  >(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [imageDialogCat, setImageDialogCat] = useState<ApiRecord | null>(null);

  const { data: ruleSets } = useQuery({
    queryKey: ["admin", "scale-rule-sets"],
    queryFn: async () => {
      const { data } = await api.get("/scales/rule-sets");
      return data.data ?? [];
    },
  });

  const { data: colors } = useQuery({
    queryKey: ["admin", "colors"],
    queryFn: async () => {
      const { data } = await api.get("/colors");
      return data.data ?? [];
    },
  });

  const { data: materials } = useQuery({
    queryKey: ["admin", "materials"],
    queryFn: async () => {
      const { data } = await api.get("/materials");
      return data.data ?? [];
    },
  });

  const { data: categories, isLoading } = useQuery({
    queryKey: ["admin", "categories"],
    queryFn: async () => {
      const { data } = await api.get("/categories");
      return data.data;
    },
  });

  const createMutation = useMutation({
    mutationFn: (body: {
      name: string;
      extraDays?: number;
      parentId?: string;
    }) => api.post("/categories", body),
    onSuccess: () => {
      queryClient.refetchQueries({ queryKey: ["admin", "categories"] });
      setNewName("");
      setNewExtraDays("");
      setNewParentId("");
      setError("");
    },
    onError: (err) => setError(extractError(err)),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, body }: { id: string; body: Record<string, unknown> }) =>
      api.put(`/categories/${id}`, body),
    onSuccess: () => {
      queryClient.refetchQueries({ queryKey: ["admin", "categories"] });
      setEditingId(null);
      setError("");
    },
    onError: (err) => setError(extractError(err)),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/categories/${id}`),
    onSuccess: () => {
      queryClient.refetchQueries({ queryKey: ["admin", "categories"] });
      setError("");
    },
    onError: (err) => setError(extractError(err)),
  });

  function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (newName.trim()) {
      createMutation.mutate({
        name: newName,
        extraDays: newExtraDays ? parseInt(newExtraDays, 10) : undefined,
        parentId: newParentId || undefined,
      });
    }
  }

  function startEditing(cat: ApiRecord) {
    setEditingId(cat.id as string);
    setEditName(cat.name as string);
    setEditExtraDays(cat.extraDays != null ? String(cat.extraDays) : "");
    setEditScaleRuleSetId((cat.scaleRuleSetId as string) ?? "");
    setEditParentId((cat.parentId as string) ?? "");
    setEditColorId((cat.colorId as string) ?? "");
    setEditMaterialId((cat.materialId as string) ?? "");
    setEditGoogleCategoryId((cat.googleCategoryId as string) ?? null);
  }

  function handleUpdate() {
    if (editingId && editName.trim()) {
      updateMutation.mutate({
        id: editingId,
        body: {
          name: editName,
          extraDays: editExtraDays ? parseInt(editExtraDays, 10) : undefined,
          scaleRuleSetId: editScaleRuleSetId || null,
          parentId: editParentId || null,
          colorId: editColorId || null,
          materialId: editMaterialId || null,
          googleCategoryId: editGoogleCategoryId || null,
        },
      });
    }
  }

  function toggleExpand(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const parentOptions = flattenForSelect(
    categories ?? [],
    0,
    editingId ?? undefined,
  );

  function renderCategoryRow(cat: ApiRecord, depth: number) {
    const hasChildren = (cat.children as ApiRecord[] | undefined)?.length;
    const isExpanded = expanded.has(cat.id as string);
    const isEditing = editingId === cat.id;

    return (
      <div key={cat.id as string}>
        <div
          className={`${isEditing ? "block" : "flex items-center"} gap-2 py-2 px-3 border-b hover:bg-muted/30 ${depth > 0 ? "bg-muted/10" : ""}`}
          style={{ paddingLeft: `${depth * 24 + 12}px` }}
        >
          {!isEditing && (
            <button
              type="button"
              onClick={() => toggleExpand(cat.id as string)}
              className="w-5 h-5 flex items-center justify-center"
            >
              {hasChildren ? (
                isExpanded ? (
                  <ChevronDown className="h-4 w-4" />
                ) : (
                  <ChevronRight className="h-4 w-4" />
                )
              ) : (
                <span className="w-4" />
              )}
            </button>
          )}

          {isEditing ? (
            <div className="space-y-2">
              <div className="flex items-center gap-2 flex-wrap">
                <Input
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="h-8 w-40"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleUpdate();
                    if (e.key === "Escape") setEditingId(null);
                  }}
                />
                <Input
                  type="number"
                  value={editExtraDays}
                  onChange={(e) => setEditExtraDays(e.target.value)}
                  placeholder="Dias"
                  className="h-8 w-16"
                  min={0}
                />
                <select
                  value={editParentId}
                  onChange={(e) => setEditParentId(e.target.value)}
                  className="h-8 rounded-md border bg-background px-2 text-xs"
                >
                  <option value="">Danh mục</option>
                  {parentOptions
                    .filter((o) => o.id !== editingId)
                    .map((o) => (
                      <option key={o.id} value={o.id}>
                        {"—".repeat(o.depth)} {o.name}
                      </option>
                    ))}
                </select>
                <select
                  value={editScaleRuleSetId}
                  onChange={(e) => setEditScaleRuleSetId(e.target.value)}
                  className="h-8 rounded-md border bg-background px-2 text-xs"
                >
                  <option value="">Không có quy tắc</option>
                  {(ruleSets as Array<{ id: string; name: string }>)?.map(
                    (rs) => (
                      <option key={rs.id} value={rs.id}>
                        {rs.name}
                      </option>
                    ),
                  )}
                </select>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7"
                  onClick={handleUpdate}
                >
                  <Check className="h-3.5 w-3.5" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7"
                  onClick={() => setEditingId(null)}
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>

              <div className="flex items-start gap-2 flex-wrap">
                <div className="flex flex-col gap-0.5">
                  <label className="text-[10px] text-muted-foreground">
                    Màu sắc
                  </label>
                  <select
                    value={editColorId}
                    onChange={(e) => setEditColorId(e.target.value)}
                    className="h-8 rounded-md border bg-background px-2 text-xs w-32"
                  >
                    <option value="">— kế thừa từ cha —</option>
                    {(colors as Array<{ id: string; name: string }>)?.map(
                      (c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ),
                    )}
                  </select>
                </div>
                <div className="flex flex-col gap-0.5">
                  <label className="text-[10px] text-muted-foreground">
                    Chất liệu
                  </label>
                  <select
                    value={editMaterialId}
                    onChange={(e) => setEditMaterialId(e.target.value)}
                    className="h-8 rounded-md border bg-background px-2 text-xs w-32"
                  >
                    <option value="">— kế thừa từ cha —</option>
                    {(materials as Array<{ id: string; name: string }>)?.map(
                      (m) => (
                        <option key={m.id} value={m.id}>
                          {m.name}
                        </option>
                      ),
                    )}
                  </select>
                </div>
                <div className="flex flex-col gap-0.5 flex-1 min-w-[260px]">
                  <label className="text-[10px] text-muted-foreground">
                    Danh mục Google
                  </label>
                  <GoogleCategoryPicker
                    value={editGoogleCategoryId}
                    onChange={setEditGoogleCategoryId}
                  />
                </div>
              </div>
            </div>
          ) : (
            <>
              <ImageThumb
                src={cat.image as string | undefined}
                onClick={() => setImageDialogCat(cat)}
              />
              <button
                type="button"
                className="font-medium hover:underline text-left flex-1 text-sm"
                onClick={() => startEditing(cat)}
              >
                {cat.name as string}
              </button>
              <span className="text-xs text-muted-foreground font-mono">
                {cat.slug}
              </span>
              <span className="text-xs text-muted-foreground w-12 text-center">
                {cat._count?.productCategories ?? 0}
              </span>
              <span className="text-xs text-muted-foreground w-12 text-center">
                {cat.extraDays != null ? String(cat.extraDays) : "-"}
              </span>
              <span className="text-xs text-muted-foreground w-24 truncate">
                {cat.scaleRuleSetId
                  ? ((ruleSets as Array<{ id: string; name: string }>)?.find(
                      (rs) => rs.id === cat.scaleRuleSetId,
                    )?.name ?? "-")
                  : "-"}
              </span>
              <div className="flex items-center gap-0.5">
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7"
                  onClick={() => startEditing(cat)}
                >
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7 text-destructive"
                  onClick={() => {
                    if (confirm(`Excluir "${cat.name}"?`))
                      deleteMutation.mutate(cat.id as string);
                  }}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </>
          )}
        </div>

        {/* {hasChildren &&
          isExpanded &&
          (cat.children as ApiRecord[]).map((child) =>
            renderCategoryRow(child, depth + 1),
          )} */}
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-3xl font-bold mb-6">Danh mục</h1>

      <form onSubmit={handleCreate} className="flex gap-2 mb-4 flex-wrap">
        <Input
          placeholder="Danh mục mới"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          className="w-48"
        />
        <Input
          type="number"
          placeholder="Ngày sản xuất"
          value={newExtraDays}
          onChange={(e) => setNewExtraDays(e.target.value)}
          className="w-24"
          min={0}
        />
        <select
          value={newParentId}
          onChange={(e) => setNewParentId(e.target.value)}
          className="h-10 rounded-md border bg-background px-3 text-sm"
        >
          <option value="">Danh mục (cha)</option>
          {parentOptions.map((o) => (
            <option key={o.id} value={o.id}>
              {"—".repeat(o.depth)} {o.name}
            </option>
          ))}
        </select>
        <Button type="submit" disabled={createMutation.isPending}>
          <Plus className="h-4 w-4 mr-1" /> Tạo
        </Button>
      </form>

      {error && (
        <div className="bg-destructive/10 text-destructive border border-destructive/20 rounded-md px-4 py-3 mb-4 text-sm max-w-lg">
          {error}
        </div>
      )}

      {isLoading ? (
        <p className="text-muted-foreground">Đang tải...</p>
      ) : !categories?.length ? (
        <p className="text-muted-foreground">Chưa có danh mục.</p>
      ) : (
        <div className="border rounded-lg">
          <div className="flex items-center gap-2 py-2 px-3 border-b bg-muted/50 text-xs font-medium text-muted-foreground">
            <span className="w-5" />
            <span className="w-10">Ảnh</span>
            <span className="flex-1">Tên danh mục</span>
            <span className="font-mono">Slug</span>
            <span className="w-12 text-center">Sản phẩm</span>
            <span className="w-12 text-center">Ngày sản xuất</span>
            <span className="w-24">Quy tắc</span>
            <span className="w-16">Hành động</span>
          </div>
          {categories.map((cat: ApiRecord) => renderCategoryRow(cat, 0))}
        </div>
      )}

      {imageDialogCat && (
        <EntityImageDialog
          open={!!imageDialogCat}
          onOpenChange={(open) => !open && setImageDialogCat(null)}
          title={`Ảnh: ${imageDialogCat.name as string}`}
          currentValue={(imageDialogCat.image as string) ?? null}
          variant="full"
          aspectRatio="1200x630"
          helperText="Ảnh hiển thị trên banner danh mục và được sử dụng làm Open Graph khi chia sẻ. Nên dùng kích thước 1200×630 px."
          onSave={async (url) => {
            await updateMutation.mutateAsync({
              id: imageDialogCat.id as string,
              body: { image: url ?? null },
            });
            setImageDialogCat(null);
          }}
        />
      )}
    </div>
  );
}

function ImageThumb({
  src,
  onClick,
}: {
  src?: string | null;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="h-8 w-10 rounded border border-border/50 bg-muted/30 grid place-items-center overflow-hidden hover:ring-2 hover:ring-primary/50 transition shrink-0"
      title="Sửa ảnh"
    >
      {src ? (
        <img src={src} alt="" className="h-full w-full object-cover" />
      ) : (
        <ImageIcon className="h-3 w-3 text-muted-foreground" />
      )}
    </button>
  );
}
