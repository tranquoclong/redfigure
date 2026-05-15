"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Plus,
  Trash2,
  Pencil,
  ArrowLeft,
  Save,
  X,
  ArrowUp,
  ArrowDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
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
interface ScaleItem {
  id: string;
  name: string;
  percentageIncrease: number;
  sortOrder: number;
}

interface ScaleRuleSet {
  id: string;
  name: string;
  items: ScaleItem[];
}

export default function AdminScalesPage() {
  const queryClient = useQueryClient();
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [activeRuleSetId, setActiveRuleSetId] = useState<string | null>(null);

  const [newRuleName, setNewRuleName] = useState("");

  const [editingRuleName, setEditingRuleName] = useState(false);
  const [editName, setEditName] = useState("");

  const [newItemName, setNewItemName] = useState("");
  const [newItemPercentage, setNewItemPercentage] = useState("0");

  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editItemName, setEditItemName] = useState("");
  const [editItemPercentage, setEditItemPercentage] = useState("");

  const showSuccess = (msg: string) => {
    setSuccess(msg);
    setError("");
    setTimeout(() => setSuccess(""), 3000);
  };

  const { data: ruleSets, isLoading } = useQuery({
    queryKey: ["admin", "scale-rule-sets"],
    queryFn: async () => {
      const { data } = await api.get("/scales/rule-sets");
      return (data.data ?? []) as ScaleRuleSet[];
    },
  });

  const activeRuleSet = ruleSets?.find((rs) => rs.id === activeRuleSetId);

  const createRuleSetMutation = useMutation({
    mutationFn: (name: string) => api.post("/scales/rule-sets", { name }),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ["admin", "scale-rule-sets"] });
      setNewRuleName("");
      const created = res.data.data;
      setActiveRuleSetId(created.id);
      showSuccess(
        `Quy tắc "${created.name}" đã được tạo. Thêm các tỉ lệ bên dưới.`,
      );
    },
    onError: (err) => setError(extractError(err)),
  });

  const updateRuleSetMutation = useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) =>
      api.put(`/scales/rule-sets/${id}`, { name }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "scale-rule-sets"] });
      setEditingRuleName(false);
      showSuccess("Cập nhật tên thành công");
    },
    onError: (err) => setError(extractError(err)),
  });

  const deleteRuleSetMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/scales/rule-sets/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "scale-rule-sets"] });
      setActiveRuleSetId(null);
      showSuccess("Đã xóa quy tắc");
    },
    onError: (err) => setError(extractError(err)),
  });

  const addItemMutation = useMutation({
    mutationFn: (dto: {
      ruleSetId: string;
      name: string;
      percentageIncrease: number;
      sortOrder: number;
    }) =>
      api.post(`/scales/rule-sets/${dto.ruleSetId}/items`, {
        name: dto.name,
        percentageIncrease: dto.percentageIncrease,
        sortOrder: dto.sortOrder,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "scale-rule-sets"] });
      setNewItemName("");
      setNewItemPercentage("0");
      showSuccess("Đã thêm tỉ lệ");
    },
    onError: (err) => setError(extractError(err)),
  });

  const updateItemMutation = useMutation({
    mutationFn: ({
      id,
      ...dto
    }: {
      id: string;
      name?: string;
      percentageIncrease?: number;
    }) => api.put(`/scales/items/${id}`, dto),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "scale-rule-sets"] });
      setEditingItemId(null);
      showSuccess("Cập nhật tỉ lệ thành công");
    },
    onError: (err) => setError(extractError(err)),
  });

  const deleteItemMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/scales/items/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "scale-rule-sets"] });
      showSuccess("Xóa tỉ lệ thành công");
    },
    onError: (err) => setError(extractError(err)),
  });

  const reorderMutation = useMutation({
    mutationFn: ({
      ruleSetId,
      itemIds,
    }: {
      ruleSetId: string;
      itemIds: string[];
    }) => api.put(`/scales/rule-sets/${ruleSetId}/reorder`, { itemIds }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "scale-rule-sets"] });
    },
    onError: (err) => setError(extractError(err)),
  });

  function handleCreateRuleSet(e: React.FormEvent) {
    e.preventDefault();
    if (!newRuleName.trim()) return;
    createRuleSetMutation.mutate(newRuleName.trim());
  }

  function handleAddItem(e: React.FormEvent) {
    e.preventDefault();
    if (!activeRuleSetId || !newItemName.trim()) return;
    addItemMutation.mutate({
      ruleSetId: activeRuleSetId,
      name: newItemName.trim(),
      percentageIncrease: parseFloat(newItemPercentage) || 0,
      sortOrder: activeRuleSet?.items.length ?? 0,
    });
  }

  function handleMoveItem(index: number, direction: "up" | "down") {
    if (!activeRuleSetId || !activeRuleSet) return;
    const sorted = [...activeRuleSet.items].sort(
      (a, b) => a.sortOrder - b.sortOrder,
    );
    const newIndex = direction === "up" ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= sorted.length) return;
    [sorted[index], sorted[newIndex]] = [sorted[newIndex], sorted[index]];
    reorderMutation.mutate({
      ruleSetId: activeRuleSetId,
      itemIds: sorted.map((i) => i.id),
    });
  }

  function startEditItem(item: ScaleItem) {
    setEditingItemId(item.id);
    setEditItemName(item.name);
    setEditItemPercentage(String(item.percentageIncrease));
  }

  function saveEditItem() {
    if (!editingItemId) return;
    updateItemMutation.mutate({
      id: editingItemId,
      name: editItemName.trim(),
      percentageIncrease: parseFloat(editItemPercentage) || 0,
    });
  }

  if (activeRuleSetId && activeRuleSet) {
    return (
      <div>
        <Button
          variant="ghost"
          size="sm"
          className="mb-4"
          onClick={() => {
            setActiveRuleSetId(null);
            setError("");
            setSuccess("");
          }}
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Quay lại
        </Button>

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

        <div className="flex items-center gap-3 mb-6">
          {editingRuleName ? (
            <>
              <Input
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="text-2xl font-bold h-12 max-w-md"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Enter")
                    updateRuleSetMutation.mutate({
                      id: activeRuleSetId,
                      name: editName.trim(),
                    });
                  if (e.key === "Escape") setEditingRuleName(false);
                }}
              />
              <Button
                size="icon"
                variant="ghost"
                onClick={() =>
                  updateRuleSetMutation.mutate({
                    id: activeRuleSetId,
                    name: editName.trim(),
                  })
                }
              >
                <Save className="h-4 w-4" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                onClick={() => setEditingRuleName(false)}
              >
                <X className="h-4 w-4" />
              </Button>
            </>
          ) : (
            <>
              <h1 className="text-3xl font-bold">{activeRuleSet.name}</h1>
              <Button
                size="icon"
                variant="ghost"
                onClick={() => {
                  setEditName(activeRuleSet.name);
                  setEditingRuleName(true);
                }}
              >
                <Pencil className="h-4 w-4" />
              </Button>
            </>
          )}
        </div>

        <p className="text-sm text-muted-foreground mb-6">
          Thêm các tỉ lệ có sẵn vào quy tắc này. tỉ lệ 0% là mức giá cơ bản.
        </p>

        <form
          onSubmit={handleAddItem}
          className="flex gap-3 mb-6 items-end max-w-xl"
        >
          <div className="flex-1 space-y-1">
            <Label className="text-xs">Tên tỉ lệ</Label>
            <Input
              placeholder="Ví dụ: 28mm, 32mm, 75mm"
              value={newItemName}
              onChange={(e) => setNewItemName(e.target.value)}
              required
            />
          </div>
          <div className="w-32 space-y-1">
            <Label className="text-xs">Phần trăm tăng (%)</Label>
            <Input
              type="number"
              min="0"
              step="1"
              placeholder="0"
              value={newItemPercentage}
              onChange={(e) => setNewItemPercentage(e.target.value)}
            />
          </div>
          <Button type="submit" disabled={addItemMutation.isPending}>
            <Plus className="h-4 w-4 mr-2" />
            Thêm vào
          </Button>
        </form>

        {activeRuleSet.items.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            Không có tỉ lệ nào được thêm vào quy tắc này. Thêm tỉ lệ ở trên.
          </p>
        ) : (
          <div className="border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[70px]">Thứ tự</TableHead>
                  <TableHead>tỉ lệ</TableHead>
                  <TableHead className="w-40">Tăng thêm (%)</TableHead>
                  <TableHead className="w-[100px]">Hành động</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {[...activeRuleSet.items]
                  .sort((a, b) => a.sortOrder - b.sortOrder)
                  .map((item, index, arr) => (
                    <TableRow key={item.id}>
                      <TableCell>
                        <div className="flex gap-0.5">
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7"
                            onClick={() => handleMoveItem(index, "up")}
                            disabled={index === 0 || reorderMutation.isPending}
                          >
                            <ArrowUp className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7"
                            onClick={() => handleMoveItem(index, "down")}
                            disabled={
                              index === arr.length - 1 ||
                              reorderMutation.isPending
                            }
                          >
                            <ArrowDown className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                      <TableCell className="font-medium">
                        {editingItemId === item.id ? (
                          <Input
                            value={editItemName}
                            onChange={(e) => setEditItemName(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") saveEditItem();
                              if (e.key === "Escape") setEditingItemId(null);
                            }}
                            className="h-8"
                            autoFocus
                          />
                        ) : (
                          <span
                            className="cursor-pointer hover:text-primary hover:underline"
                            onClick={() => startEditItem(item)}
                          >
                            {item.name}
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        {editingItemId === item.id ? (
                          <div className="flex items-center gap-1">
                            <Input
                              type="number"
                              min="0"
                              step="1"
                              value={editItemPercentage}
                              onChange={(e) =>
                                setEditItemPercentage(e.target.value)
                              }
                              onKeyDown={(e) => {
                                if (e.key === "Enter") saveEditItem();
                                if (e.key === "Escape") setEditingItemId(null);
                              }}
                              className="h-8 w-24"
                            />
                            <span className="text-xs text-muted-foreground">
                              %
                            </span>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8"
                              onClick={saveEditItem}
                            >
                              <Save className="h-4 w-4 text-green-600" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8"
                              onClick={() => setEditingItemId(null)}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        ) : (
                          <span
                            className="cursor-pointer hover:text-primary hover:underline"
                            onClick={() => startEditItem(item)}
                          >
                            {item.percentageIncrease === 0 ? (
                              <span className="text-muted-foreground">
                                Cơ bản (0%)
                              </span>
                            ) : (
                              <span className="text-primary font-medium">
                                +{item.percentageIncrease}%
                              </span>
                            )}
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8"
                            onClick={() => startEditItem(item)}
                            title="Chỉnh sửa"
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8 text-destructive hover:text-destructive"
                            onClick={() => {
                              if (confirm(`Xóa tỉ lệ "${item.name}"?`))
                                deleteItemMutation.mutate(item.id);
                            }}
                            disabled={deleteItemMutation.isPending}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          </div>
        )}

        <div className="mt-8 pt-6 border-t">
          <Button
            variant="destructive"
            size="sm"
            onClick={() => {
              if (
                confirm(
                  `Xóa quy tắc "${activeRuleSet.name}" và tất cả các tỉ lệ của nó?`,
                )
              )
                deleteRuleSetMutation.mutate(activeRuleSetId);
            }}
            disabled={deleteRuleSetMutation.isPending}
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Xóa quy tắc
          </Button>
          <p className="text-xs text-muted-foreground mt-1">
            Tất cả các tỉ lệ trong quy tắc này sẽ bị xóa cùng.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-3xl font-bold mb-2">Quy tắc tỉ lệ</h1>
      <p className="text-sm text-muted-foreground mb-6">
        Quy tắc tỉ lệ xác định một tập hợp các tỉ lệ với giá cả. Chỉ định quy
        tắc cho sản phẩm, thẻ hoặc danh mục.
      </p>

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

      <form
        onSubmit={handleCreateRuleSet}
        className="flex gap-3 mb-6 items-end max-w-md"
      >
        <div className="flex-1 space-y-1">
          <Label className="text-xs">Tên quy tắc</Label>
          <Input
            placeholder="Ví dụ: Quy tắc chung"
            value={newRuleName}
            onChange={(e) => setNewRuleName(e.target.value)}
            required
          />
        </div>
        <Button type="submit" disabled={createRuleSetMutation.isPending}>
          <Plus className="h-4 w-4 mr-2" />
          Tạo quy tắc
        </Button>
      </form>

      {isLoading ? (
        <p className="text-muted-foreground">Đang tải...</p>
      ) : ruleSets?.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          Không có quy tắc nào được thêm vào. Tạo quy tắc ở trên.
        </p>
      ) : (
        <div className="space-y-3">
          {ruleSets?.map((rs) => (
            <Card
              key={rs.id}
              className="cursor-pointer hover:border-primary/50 transition-colors"
              onClick={() => {
                setActiveRuleSetId(rs.id);
                setError("");
                setSuccess("");
              }}
            >
              <CardContent className="py-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-medium text-base">{rs.name}</h3>
                    <p className="text-sm text-muted-foreground mt-1">
                      {rs.items.length === 0
                        ? "Chưa có tỉ lệ — click để thêm"
                        : `${rs.items.length} tỉ lệ: ${rs.items.map((i) => i.name).join(", ")}`}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {rs.items.map((item) => (
                      <span
                        key={item.id}
                        className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs"
                      >
                        {item.name}
                        {item.percentageIncrease > 0 && (
                          <span className="text-primary font-medium">
                            +{item.percentageIncrease}%
                          </span>
                        )}
                        {item.percentageIncrease === 0 && (
                          <span className="text-muted-foreground">Cơ bản</span>
                        )}
                      </span>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
