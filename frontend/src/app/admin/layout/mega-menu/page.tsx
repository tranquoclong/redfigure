"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Plus,
  Trash2,
  ArrowUp,
  ArrowDown,
  Save,
  Loader2,
  Layers,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api-client";
import { revalidateMegaMenu } from "../_actions";
import { cn } from "@/lib/utils";
import type { MegaMenuItem, MegaMenuConfig } from "@/lib/site-content";

import { extractError } from "@/lib/extract-error";
function genId(): string {
  return "item_" + Math.random().toString(36).slice(2, 10);
}

export default function MegaMenuAdminPage() {
  const queryClient = useQueryClient();
  const [items, setItems] = useState<MegaMenuItem[]>([]);
  const [serverKey, setServerKey] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [dirty, setDirty] = useState(false);

  const query = useQuery({
    queryKey: ["admin", "megamenu"],
    queryFn: async () => {
      const { data } = await api.get<{ data: MegaMenuConfig }>(
        "/site/megamenu",
      );
      return data.data;
    },
  });

  if (query.data) {
    const fresh = JSON.stringify(query.data.items);
    if (fresh !== serverKey) {
      setServerKey(fresh);
      setItems(query.data.items);
      setSelectedId(query.data.items[0]?.id ?? null);
      setDirty(false);
    }
  }

  const saveMutation = useMutation({
    mutationFn: async () => {
      await api.put("/admin/site/megamenu", { items });
      await revalidateMegaMenu();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "megamenu"] });
      setError("");
      setSaved(true);
      setDirty(false);
      setTimeout(() => setSaved(false), 2500);
    },
    onError: (err) => setError(extractError(err)),
  });

  function patchItem(id: string, patch: Partial<MegaMenuItem>) {
    setItems((prev) =>
      prev.map((it) => (it.id === id ? { ...it, ...patch } : it)),
    );
    setDirty(true);
  }

  function addRoot() {
    const id = genId();
    setItems((prev) => [...prev, { id, label: "Mục mới", href: "/" }]);
    setSelectedId(id);
    setDirty(true);
  }

  function removeRoot(id: string) {
    setItems((prev) => prev.filter((it) => it.id !== id));
    if (selectedId === id) setSelectedId(null);
    setDirty(true);
  }

  function moveRoot(id: string, direction: "up" | "down") {
    setItems((prev) => {
      const idx = prev.findIndex((it) => it.id === id);
      if (idx === -1) return prev;
      const next = [...prev];
      const swap = direction === "up" ? idx - 1 : idx + 1;
      if (swap < 0 || swap >= next.length) return prev;
      [next[idx], next[swap]] = [next[swap], next[idx]];
      return next;
    });
    setDirty(true);
  }

  function addColumn(itemId: string) {
    const item = items.find((i) => i.id === itemId);
    if (!item) return;
    patchItem(itemId, {
      columns: [...(item.columns ?? []), { title: "Cột mới", links: [] }],
    });
  }

  function patchColumn(
    itemId: string,
    colIdx: number,
    patch: { title?: string },
  ) {
    const item = items.find((i) => i.id === itemId);
    if (!item || !item.columns) return;
    patchItem(itemId, {
      columns: item.columns.map((c, i) =>
        i === colIdx ? { ...c, ...patch } : c,
      ),
    });
  }

  function removeColumn(itemId: string, colIdx: number) {
    const item = items.find((i) => i.id === itemId);
    if (!item || !item.columns) return;
    patchItem(itemId, {
      columns: item.columns.filter((_, i) => i !== colIdx),
    });
  }

  function addLink(itemId: string, colIdx: number) {
    const item = items.find((i) => i.id === itemId);
    if (!item || !item.columns) return;
    patchItem(itemId, {
      columns: item.columns.map((c, i) =>
        i === colIdx
          ? { ...c, links: [...c.links, { label: "", href: "" }] }
          : c,
      ),
    });
  }

  function patchLink(
    itemId: string,
    colIdx: number,
    linkIdx: number,
    patch: { label?: string; href?: string },
  ) {
    const item = items.find((i) => i.id === itemId);
    if (!item || !item.columns) return;
    patchItem(itemId, {
      columns: item.columns.map((c, i) =>
        i === colIdx
          ? {
              ...c,
              links: c.links.map((l, li) =>
                li === linkIdx ? { ...l, ...patch } : l,
              ),
            }
          : c,
      ),
    });
  }

  function removeLink(itemId: string, colIdx: number, linkIdx: number) {
    const item = items.find((i) => i.id === itemId);
    if (!item || !item.columns) return;
    patchItem(itemId, {
      columns: item.columns.map((c, i) =>
        i === colIdx
          ? { ...c, links: c.links.filter((_, li) => li !== linkIdx) }
          : c,
      ),
    });
  }

  const selected = items.find((i) => i.id === selectedId) ?? null;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold">Mega Menu</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Danh mục chính của header. Mỗi danh mục có thể có menu thả xuống
            mega tùy chọn với các cột và liên kết.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {saved && (
            <span className="text-sm text-green-500">
              Đã lưu! Trang web đã được cập nhật.
            </span>
          )}
          <Button
            onClick={() => saveMutation.mutate()}
            disabled={saveMutation.isPending || !dirty}
          >
            {saveMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Đang lưu…
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" /> Lưu mega menu
              </>
            )}
          </Button>
        </div>
      </div>

      {error && (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {query.isLoading ? (
        <div className="flex items-center gap-2 py-12 justify-center text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Đang tải…
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-6">
          <Card>
            <CardHeader className="flex-row items-center justify-between pb-3">
              <CardTitle className="text-sm">Danh mục</CardTitle>
              <Button size="sm" variant="outline" onClick={addRoot}>
                <Plus className="h-3 w-3 mr-1" /> Thêm
              </Button>
            </CardHeader>
            <CardContent className="space-y-1">
              {items.map((item, idx) => (
                <div
                  key={item.id}
                  className={cn(
                    "group flex items-center gap-1 rounded-lg border px-2 py-2 text-sm cursor-pointer transition-colors",
                    selectedId === item.id
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-muted-foreground/30",
                  )}
                  onClick={() => setSelectedId(item.id)}
                >
                  <span className="flex-1 truncate">
                    {item.label || "(không có tên)"}
                  </span>
                  {item.columns && item.columns.length > 0 && (
                    <Layers className="h-3 w-3 text-cyan shrink-0" />
                  )}
                  {item.badge && (
                    <span className="text-[9px] uppercase text-magenta shrink-0">
                      {item.badge}
                    </span>
                  )}
                  <div className="hidden group-hover:flex items-center gap-0.5">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={(e) => {
                        e.stopPropagation();
                        moveRoot(item.id, "up");
                      }}
                      disabled={idx === 0}
                    >
                      <ArrowUp className="h-3 w-3" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={(e) => {
                        e.stopPropagation();
                        moveRoot(item.id, "down");
                      }}
                      disabled={idx === items.length - 1}
                    >
                      <ArrowDown className="h-3 w-3" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (confirm(`Xóa "${item.label}"?`))
                          removeRoot(item.id);
                      }}
                    >
                      <Trash2 className="h-3 w-3 text-destructive" />
                    </Button>
                  </div>
                </div>
              ))}
              {items.length === 0 && (
                <p className="text-xs text-muted-foreground text-center py-4">
                  Không có mục. Nhấn &quot;Thêm&quot;.
                </p>
              )}
            </CardContent>
          </Card>

          {selected ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">
                  Chỉnh sửa: {selected.label || "(không có tên)"}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">Label *</Label>
                    <Input
                      value={selected.label}
                      onChange={(e) =>
                        patchItem(selected.id, { label: e.target.value })
                      }
                      placeholder="Danh mục"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Link *</Label>
                    <Input
                      value={selected.href}
                      onChange={(e) =>
                        patchItem(selected.id, { href: e.target.value })
                      }
                      placeholder="/products"
                    />
                  </div>
                </div>

                <div>
                  <Label className="text-xs">Badge (optional)</Label>
                  <div className="flex gap-2 mt-1">
                    {(["NEW", "HOT", "SALE"] as const).map((b) => (
                      <button
                        key={b}
                        type="button"
                        onClick={() =>
                          patchItem(selected.id, {
                            badge: selected.badge === b ? undefined : b,
                          })
                        }
                        className={cn(
                          "text-[10px] uppercase font-bold rounded-full border px-2 py-1 [font-family:var(--font-orbitron)]",
                          selected.badge === b
                            ? "border-cyan bg-cyan/15 text-cyan"
                            : "border-border text-muted-foreground hover:border-muted-foreground/50",
                        )}
                      >
                        {b}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="border-t border-border pt-4">
                  <div className="flex items-center justify-between mb-3">
                    <Label className="text-xs">
                      Mega-dropdown ({(selected.columns ?? []).length} cột)
                    </Label>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => addColumn(selected.id)}
                    >
                      <Plus className="h-3 w-3 mr-1" /> Cột
                    </Button>
                  </div>
                  <p className="text-[11px] text-muted-foreground mb-3">
                    Không có cột, mục này sẽ trở thành một liên kết đơn giản
                    trong header. Có cột sẽ mở ra menu thả xuống khi di chuột
                    vào.
                  </p>

                  {selected.columns?.map((col, colIdx) => (
                    <div
                      key={colIdx}
                      className="space-y-2 rounded-lg border border-border p-3 mb-3"
                    >
                      <div className="flex items-center gap-2">
                        <Input
                          value={col.title}
                          onChange={(e) =>
                            patchColumn(selected.id, colIdx, {
                              title: e.target.value,
                            })
                          }
                          placeholder="Tiêu đề cột"
                          className="flex-1 text-xs uppercase"
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => removeColumn(selected.id, colIdx)}
                        >
                          <Trash2 className="h-3 w-3 text-destructive" />
                        </Button>
                      </div>

                      <div className="space-y-1.5">
                        {col.links.map((link, linkIdx) => (
                          <div
                            key={linkIdx}
                            className="flex items-center gap-1.5"
                          >
                            <Input
                              value={link.label}
                              onChange={(e) =>
                                patchLink(selected.id, colIdx, linkIdx, {
                                  label: e.target.value,
                                })
                              }
                              placeholder="anime"
                              className="text-xs"
                            />
                            <Input
                              value={link.href}
                              onChange={(e) =>
                                patchLink(selected.id, colIdx, linkIdx, {
                                  href: e.target.value,
                                })
                              }
                              placeholder="/c/anime"
                              className="text-xs font-mono"
                            />
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={() =>
                                removeLink(selected.id, colIdx, linkIdx)
                              }
                            >
                              <Trash2 className="h-3 w-3 text-destructive" />
                            </Button>
                          </div>
                        ))}
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => addLink(selected.id, colIdx)}
                          className="w-full text-[11px]"
                        >
                          <Plus className="h-3 w-3 mr-1" /> link
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="py-16 text-center text-sm text-muted-foreground">
                Chọn một mục ở bên trái để chỉnh sửa, hoặc nhấp &quot;Thêm&quot;
                để tạo một mới.
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
