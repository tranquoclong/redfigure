"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, ArrowUp, ArrowDown, Save, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { api } from "@/lib/api-client";
import { extractError } from "@/lib/extract-error";
import { revalidateFooter } from "../_actions";

interface FooterColumn {
  title: string;
  links: Array<{ label: string; href: string }>;
}

interface FooterSocial {
  platform: "instagram" | "facebook" | "twitter" | "youtube" | "tiktok";
  href: string;
}

interface FooterConfig {
  columns: FooterColumn[];
  socials: FooterSocial[];
  legal: { copyright: string; mst?: string };
}

const SOCIAL_PLATFORMS: FooterSocial["platform"][] = [
  "instagram",
  "facebook",
  "twitter",
  "youtube",
  "tiktok",
];

const emptyFooter: FooterConfig = {
  columns: [],
  socials: [],
  legal: { copyright: "" },
};

export default function FooterAdminPage() {
  const queryClient = useQueryClient();
  const [config, setConfig] = useState<FooterConfig>(emptyFooter);
  const [serverKey, setServerKey] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [dirty, setDirty] = useState(false);

  const query = useQuery({
    queryKey: ["admin", "footer"],
    queryFn: async () => {
      const { data } = await api.get<{ data: FooterConfig }>("/site/footer");
      return data.data;
    },
  });

  if (query.data) {
    const fresh = JSON.stringify(query.data);
    if (fresh !== serverKey) {
      setServerKey(fresh);
      setConfig(query.data);
      setDirty(false);
    }
  }

  const saveMutation = useMutation({
    mutationFn: async () => {
      await api.put("/admin/site/footer", config);
      await revalidateFooter();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "footer"] });
      setError("");
      setSaved(true);
      setDirty(false);
      setTimeout(() => setSaved(false), 2500);
    },
    onError: (err) => setError(extractError(err)),
  });

  function patch(p: Partial<FooterConfig>) {
    setConfig((c) => ({ ...c, ...p }));
    setDirty(true);
  }

  function addColumn() {
    patch({
      columns: [...config.columns, { title: "CỘT MỚI", links: [] }],
    });
  }

  function patchColumn(idx: number, p: Partial<FooterColumn>) {
    patch({
      columns: config.columns.map((c, i) => (i === idx ? { ...c, ...p } : c)),
    });
  }

  function removeColumn(idx: number) {
    patch({ columns: config.columns.filter((_, i) => i !== idx) });
  }

  function moveColumn(idx: number, direction: "up" | "down") {
    const next = [...config.columns];
    const swap = direction === "up" ? idx - 1 : idx + 1;
    if (swap < 0 || swap >= next.length) return;
    [next[idx], next[swap]] = [next[swap], next[idx]];
    patch({ columns: next });
  }

  function addLink(colIdx: number) {
    patchColumn(colIdx, {
      links: [...config.columns[colIdx].links, { label: "", href: "" }],
    });
  }

  function patchLink(
    colIdx: number,
    linkIdx: number,
    p: { label?: string; href?: string },
  ) {
    patchColumn(colIdx, {
      links: config.columns[colIdx].links.map((l, i) =>
        i === linkIdx ? { ...l, ...p } : l,
      ),
    });
  }

  function removeLink(colIdx: number, linkIdx: number) {
    patchColumn(colIdx, {
      links: config.columns[colIdx].links.filter((_, i) => i !== linkIdx),
    });
  }

  function addSocial() {
    const used = new Set(config.socials.map((s) => s.platform));
    const next = SOCIAL_PLATFORMS.find((p) => !used.has(p));
    if (!next) return;
    patch({ socials: [...config.socials, { platform: next, href: "" }] });
  }

  function patchSocial(idx: number, p: Partial<FooterSocial>) {
    patch({
      socials: config.socials.map((s, i) => (i === idx ? { ...s, ...p } : s)),
    });
  }

  function removeSocial(idx: number) {
    patch({ socials: config.socials.filter((_, i) => i !== idx) });
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold">Footer</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Edit các cột, mạng xã hội và văn bản của footer trang web.
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
                <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Lưu…
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" /> Lưu footer
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
          <Loader2 className="h-4 w-4 animate-spin" /> Đang tải...
        </div>
      ) : (
        <div className="space-y-6">
          <Card>
            <CardHeader className="flex-row items-center justify-between pb-3">
              <CardTitle className="text-base">Cột liên kết</CardTitle>
              <Button size="sm" variant="outline" onClick={addColumn}>
                <Plus className="h-3 w-3 mr-1" /> Thêm cột
              </Button>
            </CardHeader>
            <CardContent className="space-y-4">
              {config.columns.map((col, colIdx) => (
                <div
                  key={colIdx}
                  className="rounded-lg border border-border bg-card p-4 space-y-3"
                >
                  <div className="flex items-center gap-2">
                    <Input
                      value={col.title}
                      onChange={(e) =>
                        patchColumn(colIdx, { title: e.target.value })
                      }
                      placeholder="Tiêu đề cột (ví dụ: shop)"
                      className="flex-1 uppercase text-sm"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => moveColumn(colIdx, "up")}
                      disabled={colIdx === 0}
                    >
                      <ArrowUp className="h-4 w-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => moveColumn(colIdx, "down")}
                      disabled={colIdx === config.columns.length - 1}
                    >
                      <ArrowDown className="h-4 w-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        if (confirm(`Xóa cột "${col.title}"?`))
                          removeColumn(colIdx);
                      }}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>

                  <div className="space-y-1.5">
                    {col.links.map((link, linkIdx) => (
                      <div key={linkIdx} className="flex items-center gap-1.5">
                        <Input
                          value={link.label}
                          onChange={(e) =>
                            patchLink(colIdx, linkIdx, {
                              label: e.target.value,
                            })
                          }
                          placeholder="Danh mục"
                          className="text-xs"
                        />
                        <Input
                          value={link.href}
                          onChange={(e) =>
                            patchLink(colIdx, linkIdx, {
                              href: e.target.value,
                            })
                          }
                          placeholder="/products"
                          className="text-xs font-mono"
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => removeLink(colIdx, linkIdx)}
                        >
                          <Trash2 className="h-3 w-3 text-destructive" />
                        </Button>
                      </div>
                    ))}
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => addLink(colIdx)}
                      className="w-full text-[11px]"
                    >
                      <Plus className="h-3 w-3 mr-1" /> link
                    </Button>
                  </div>
                </div>
              ))}
              {config.columns.length === 0 && (
                <p className="text-xs text-muted-foreground text-center py-4">
                  Không có cột. Nhấp vào &quot;Thêm cột&quot;.
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex-row items-center justify-between pb-3">
              <CardTitle className="text-base">Mạng xã hội</CardTitle>
              <Button
                size="sm"
                variant="outline"
                onClick={addSocial}
                disabled={config.socials.length >= SOCIAL_PLATFORMS.length}
              >
                <Plus className="h-3 w-3 mr-1" /> Thêm
              </Button>
            </CardHeader>
            <CardContent className="space-y-2">
              {config.socials.map((s, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <Select
                    value={s.platform}
                    onValueChange={(v) =>
                      patchSocial(idx, {
                        platform: (v ??
                          "instagram") as FooterSocial["platform"],
                      })
                    }
                  >
                    <SelectTrigger className="w-40">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {SOCIAL_PLATFORMS.map((p) => (
                        <SelectItem key={p} value={p}>
                          {p}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input
                    value={s.href}
                    onChange={(e) => patchSocial(idx, { href: e.target.value })}
                    placeholder="https://instagram.com/redfigure"
                    className="flex-1 text-xs font-mono"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => removeSocial(idx)}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              ))}
              {config.socials.length === 0 && (
                <p className="text-xs text-muted-foreground text-center py-4">
                  Không có mạng xã hội nào được thêm.
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Văn bản pháp lý</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <Label className="text-xs">Copyright *</Label>
                <Input
                  value={config.legal.copyright}
                  onChange={(e) =>
                    patch({
                      legal: { ...config.legal, copyright: e.target.value },
                    })
                  }
                  placeholder="© 2026 Red Figure · redfigure.com"
                />
              </div>
              <div>
                <Label className="text-xs">MST (tùy chọn)</Label>
                <Input
                  value={config.legal.mst ?? ""}
                  onChange={(e) =>
                    patch({
                      legal: {
                        ...config.legal,
                        mst: e.target.value || undefined,
                      },
                    })
                  }
                  placeholder="XX.XXX.XXX/0001-XX"
                />
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
