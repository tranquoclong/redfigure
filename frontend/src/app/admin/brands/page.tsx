"use client";
import type { Brand } from "@/types/product";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, Check, X, Pencil, ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { api } from "@/lib/api-client";
import { EntityImageDialog } from "@/components/admin/entity-image-dialog";

import { extractError } from "@/lib/extract-error";
function nextSkuPreview(prefix?: string, counter?: number): string | null {
  if (!prefix) return null;
  const next = (counter ?? 0) + 1;
  return `${prefix}${String(next).padStart(4, "0")}`;
}

export default function AdminBrandsPage() {
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editSkuPrefix, setEditSkuPrefix] = useState("");
  const [editSkuCounter, setEditSkuCounter] = useState("");
  const [editRenameFolderDefault, setEditRenameFolderDefault] = useState(true);
  const [editScaleRuleSetId, setEditScaleRuleSetId] = useState("");
  const [editNoScales, setEditNoScales] = useState(false);
  const [logoDialogBrand, setLogoDialogBrand] = useState<Brand | null>(null);

  const { data: brands, isLoading } = useQuery({
    queryKey: ["admin", "brands"],
    queryFn: async () => {
      const { data } = await api.get("/brands");
      return (data.data ?? data) as Brand[];
    },
  });

  const { data: ruleSets } = useQuery({
    queryKey: ["admin", "scale-rule-sets"],
    queryFn: async () => {
      const { data } = await api.get("/scales/rule-sets");
      return (data.data ?? []) as Array<{ id: string; name: string }>;
    },
  });

  const createMutation = useMutation({
    mutationFn: (n: string) => api.post("/brands", { name: n }),
    onSuccess: () => {
      setError("");
      queryClient.invalidateQueries({ queryKey: ["admin", "brands"] });
      setName("");
    },
    onError: (err) => {
      setError(extractError(err));
    },
  });

  const updateMutation = useMutation({
    mutationFn: (payload: {
      id: string;
      name?: string;
      skuPrefix?: string;
      skuCounter?: number;
      renameFolderDefault?: boolean;
      scaleRuleSetId?: string | null;
      noScales?: boolean;
      logo?: string | null;
    }) => {
      const { id, ...body } = payload;
      return api.put(`/brands/${id}`, body);
    },
    onSuccess: () => {
      setError("");
      setEditingId(null);
      queryClient.invalidateQueries({ queryKey: ["admin", "brands"] });
    },
    onError: (err) => {
      setError(extractError(err));
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/brands/${id}`),
    onSuccess: () => {
      setError("");
      queryClient.invalidateQueries({ queryKey: ["admin", "brands"] });
    },
    onError: (err) => {
      setError(extractError(err));
    },
  });

  function startEdit(brand: Brand) {
    setEditingId(brand.id);
    setEditName(brand.name);
    setEditSkuPrefix(brand.skuPrefix ?? "");
    setEditSkuCounter(String(brand.skuCounter?.counter ?? 0));
    setEditRenameFolderDefault(brand.renameFolderDefault ?? true);
    setEditScaleRuleSetId(brand.scaleRuleSetId ?? "");
    setEditNoScales(brand.noScales ?? false);
  }

  function cancelEdit() {
    setEditingId(null);
    setEditName("");
    setEditSkuPrefix("");
    setEditSkuCounter("");
    setEditScaleRuleSetId("");
    setEditNoScales(false);
  }

  function saveEdit() {
    if (editingId && editName.trim()) {
      updateMutation.mutate({
        id: editingId,
        name: editName,
        skuPrefix: editSkuPrefix,
        skuCounter: editSkuCounter ? parseInt(editSkuCounter, 10) : undefined,
        renameFolderDefault: editRenameFolderDefault,
        scaleRuleSetId: editScaleRuleSetId || null,
        noScales: editNoScales,
      });
    }
  }

  function handleDelete(brand: Brand) {
    if (confirm(`Excluir marca "${brand.name}"?`)) {
      deleteMutation.mutate(brand.id);
    }
  }

  return (
    <div>
      <h1 className="text-3xl font-bold mb-6">Thương hiệu</h1>
      {error && (
        <div className="bg-destructive/10 text-destructive border border-destructive/20 rounded-md px-4 py-3 mb-4 text-sm">
          {error}
        </div>
      )}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (name.trim()) createMutation.mutate(name);
        }}
        className="flex gap-2 mb-6 max-w-md"
      >
        <Input
          placeholder="Thêm thương hiệu"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <Button type="submit" disabled={createMutation.isPending}>
          <Plus className="h-4 w-4 mr-2" />
          Thêm
        </Button>
      </form>
      {isLoading ? (
        <p className="text-muted-foreground">Đang tải...</p>
      ) : (
        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[60px]">Logo</TableHead>
                <TableHead>Tên</TableHead>
                <TableHead>Slug</TableHead>
                <TableHead>SKU</TableHead>
                <TableHead>SKU cuối</TableHead>
                <TableHead>SKU tiếp theo</TableHead>
                <TableHead>Tự động đổi tên</TableHead>
                <TableHead>Quy tắc Scale</TableHead>
                <TableHead className="w-[80px]">Hành động</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {brands?.map((b) => (
                <TableRow key={b.id}>
                  {editingId === b.id ? (
                    <>
                      <TableCell>
                        <LogoThumb
                          src={b.logo}
                          onClick={() => setLogoDialogBrand(b)}
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") saveEdit();
                            if (e.key === "Escape") cancelEdit();
                          }}
                          className="h-8"
                          autoFocus
                        />
                      </TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">
                        {b.slug}
                      </TableCell>
                      <TableCell>
                        <Input
                          value={editSkuPrefix}
                          onChange={(e) => setEditSkuPrefix(e.target.value)}
                          placeholder="CNP-"
                          className="h-8 w-24"
                          maxLength={10}
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          value={editSkuCounter}
                          onChange={(e) => setEditSkuCounter(e.target.value)}
                          placeholder="0"
                          className="h-8 w-20"
                          min={0}
                        />
                      </TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">
                        {nextSkuPreview(
                          editSkuPrefix,
                          editSkuCounter ? parseInt(editSkuCounter, 10) : 0,
                        ) ?? "—"}
                      </TableCell>
                      <TableCell>
                        <Switch
                          checked={editRenameFolderDefault}
                          onCheckedChange={setEditRenameFolderDefault}
                        />
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <select
                            value={editScaleRuleSetId}
                            onChange={(e) =>
                              setEditScaleRuleSetId(e.target.value)
                            }
                            className="h-8 w-full rounded-md border bg-background px-2 text-xs"
                          >
                            <option value="">Không dùng quy tắc</option>
                            {ruleSets?.map((rs) => (
                              <option key={rs.id} value={rs.id}>
                                {rs.name}
                              </option>
                            ))}
                          </select>
                          <label className="flex items-center gap-1 text-xs">
                            <input
                              type="checkbox"
                              checked={editNoScales}
                              onChange={(e) =>
                                setEditNoScales(e.target.checked)
                              }
                            />
                            Không dùng
                          </label>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8"
                            onClick={saveEdit}
                            disabled={updateMutation.isPending}
                          >
                            <Check className="h-4 w-4 text-green-600" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8"
                            onClick={cancelEdit}
                          >
                            <X className="h-4 w-4 text-muted-foreground" />
                          </Button>
                        </div>
                      </TableCell>
                    </>
                  ) : (
                    <>
                      <TableCell>
                        <LogoThumb
                          src={b.logo}
                          onClick={() => setLogoDialogBrand(b)}
                        />
                      </TableCell>
                      <TableCell className="font-medium">{b.name}</TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">
                        {b.slug}
                      </TableCell>
                      <TableCell className="font-mono text-sm">
                        {b.skuPrefix || "—"}
                      </TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">
                        {b.skuPrefix ? (b.skuCounter?.counter ?? 0) : "—"}
                      </TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">
                        {nextSkuPreview(b.skuPrefix, b.skuCounter?.counter) ??
                          "—"}
                      </TableCell>
                      <TableCell>
                        {b.renameFolderDefault ? "Có" : "Không"}
                      </TableCell>
                      <TableCell>
                        <span className="text-xs">
                          {b.noScales
                            ? "Không"
                            : b.scaleRuleSetId
                              ? (ruleSets?.find(
                                  (rs) => rs.id === b.scaleRuleSetId,
                                )?.name ?? "-")
                              : "-"}
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8"
                            onClick={() => startEdit(b)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8 text-destructive hover:text-destructive"
                            onClick={() => handleDelete(b)}
                            disabled={deleteMutation.isPending}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {logoDialogBrand && (
        <EntityImageDialog
          open={!!logoDialogBrand}
          onOpenChange={(open) => !open && setLogoDialogBrand(null)}
          title={`Logo: ${logoDialogBrand.name}`}
          currentValue={logoDialogBrand.logo ?? null}
          variant="full"
          aspectRatio="square"
          helperText="Logo thương hiệu được sử dụng trong danh sách sản phẩm, thẻ thông tin và dưới dạng hình ảnh Open Graph trên trang của thương hiệu."
          onSave={async (url) => {
            await updateMutation.mutateAsync({
              id: logoDialogBrand.id,
              logo: url ?? null,
            });
            setLogoDialogBrand(null);
          }}
        />
      )}
    </div>
  );
}

function LogoThumb({
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
      className="h-10 w-10 rounded border border-border/50 bg-muted/30 grid place-items-center overflow-hidden hover:ring-2 hover:ring-primary/50 transition"
      title="Chỉnh sửa logo"
    >
      {src ? (
        <img src={src} alt="" className="h-full w-full object-cover" />
      ) : (
        <ImageIcon className="h-4 w-4 text-muted-foreground" />
      )}
    </button>
  );
}
