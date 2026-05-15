"use client";
import type { ApiRecord } from "@/types/api";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Pencil, Trash2, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
export default function AdminTagsPage() {
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [color, setColor] = useState("");
  const [extraDays, setExtraDays] = useState("");
  const [error, setError] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editColor, setEditColor] = useState("");
  const [editExtraDays, setEditExtraDays] = useState("");
  const [editScaleRuleSetId, setEditScaleRuleSetId] = useState("");
  const [editNoScales, setEditNoScales] = useState(false);

  const { data: ruleSets } = useQuery({
    queryKey: ["admin", "scale-rule-sets"],
    queryFn: async () => {
      const { data } = await api.get("/scales/rule-sets");
      return data.data ?? [];
    },
  });

  const { data: tags, isLoading } = useQuery({
    queryKey: ["admin", "tags"],
    queryFn: async () => {
      const { data } = await api.get("/tags");
      return data.data ?? data;
    },
  });

  const createMutation = useMutation({
    mutationFn: () =>
      api.post("/tags", {
        name,
        color: color || undefined,
        extraDays: extraDays ? parseInt(extraDays, 10) : undefined,
      }),
    onSuccess: () => {
      setError("");
      queryClient.refetchQueries({ queryKey: ["admin", "tags"] });
      setName("");
      setColor("");
      setExtraDays("");
    },
    onError: (err) => {
      setError(extractError(err));
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({
      id,
      body,
    }: {
      id: string;
      body: {
        name: string;
        color?: string;
        extraDays?: number;
        scaleRuleSetId?: string | null;
        noScales?: boolean;
      };
    }) => api.put(`/tags/${id}`, body),
    onSuccess: () => {
      queryClient.refetchQueries({ queryKey: ["admin", "tags"] });
      setEditingId(null);
      setError("");
    },
    onError: (err) => {
      setError(extractError(err));
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/tags/${id}`),
    onSuccess: () => {
      queryClient.refetchQueries({ queryKey: ["admin", "tags"] });
      setError("");
    },
    onError: (err) => {
      setError(extractError(err));
    },
  });

  function startEditing(t: ApiRecord) {
    setEditingId(t.id as string);
    setEditName(t.name as string);
    setEditColor((t.color as string) ?? "");
    setEditExtraDays(t.extraDays != null ? String(t.extraDays) : "");
    setEditScaleRuleSetId((t.scaleRuleSetId as string) ?? "");
    setEditNoScales((t.noScales as boolean) ?? false);
  }

  function handleUpdate() {
    if (editingId && editName.trim()) {
      updateMutation.mutate({
        id: editingId,
        body: {
          name: editName,
          color: editColor || undefined,
          extraDays: editExtraDays ? parseInt(editExtraDays, 10) : undefined,
          scaleRuleSetId: editScaleRuleSetId || null,
          noScales: editNoScales,
        },
      });
    }
  }

  function handleDelete(t: ApiRecord) {
    if (confirm(`Chắc chắn muốn xóa tag "${t.name}"?`)) {
      deleteMutation.mutate(t.id as string);
    }
  }

  return (
    <div>
      <h1 className="text-3xl font-bold mb-6">Tags</h1>
      {error && (
        <div className="bg-destructive/10 text-destructive border border-destructive/20 rounded-md px-4 py-3 mb-4 text-sm">
          {error}
        </div>
      )}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (name.trim()) createMutation.mutate();
        }}
        className="flex gap-2 mb-6 max-w-lg"
      >
        <Input
          placeholder="Tag mới"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <div className="flex items-center gap-1.5">
          <input
            type="color"
            value={color || "#6b7280"}
            onChange={(e) => setColor(e.target.value)}
            className="h-9 w-10 cursor-pointer rounded border border-input bg-transparent p-0.5"
          />
          <Input
            placeholder="#màu sắc"
            value={color}
            onChange={(e) => setColor(e.target.value)}
            className="w-24 text-xs font-mono"
          />
        </div>
        <Input
          type="number"
          placeholder="Ngày sản xuất"
          value={extraDays}
          onChange={(e) => setExtraDays(e.target.value)}
          className="w-28"
          min={0}
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
                <TableHead>Tên</TableHead>
                <TableHead>Slug</TableHead>
                <TableHead>Màu sắc</TableHead>
                <TableHead>Ngày sản xuất</TableHead>
                <TableHead>Quy tắc</TableHead>
                <TableHead className="w-24">Hành động</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tags?.map((t: ApiRecord) => (
                <TableRow key={t.id}>
                  <TableCell className="font-medium">
                    {editingId === t.id ? (
                      <div className="flex items-center gap-1">
                        <Input
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          className="h-8"
                          onKeyDown={(e) => {
                            if (e.key === "Enter") handleUpdate();
                            if (e.key === "Escape") setEditingId(null);
                          }}
                          autoFocus
                        />
                        <input
                          type="color"
                          value={editColor || "#6b7280"}
                          onChange={(e) => setEditColor(e.target.value)}
                          className="h-8 w-9 cursor-pointer rounded border border-input bg-transparent p-0.5"
                        />
                        <Input
                          value={editColor}
                          onChange={(e) => setEditColor(e.target.value)}
                          placeholder="#cor"
                          className="h-8 w-20 text-xs font-mono"
                        />
                        <Input
                          type="number"
                          value={editExtraDays}
                          onChange={(e) => setEditExtraDays(e.target.value)}
                          placeholder="Dias"
                          className="h-8 w-20"
                          min={0}
                        />
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8"
                          onClick={handleUpdate}
                          disabled={updateMutation.isPending}
                        >
                          <Check className="h-4 w-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8"
                          onClick={() => setEditingId(null)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        className="hover:underline cursor-pointer text-left"
                        onClick={() => startEditing(t)}
                      >
                        {t.name as string}
                      </button>
                    )}
                  </TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">
                    {t.slug}
                  </TableCell>
                  <TableCell>
                    {t.color ? (
                      <span
                        className="inline-block w-4 h-4 rounded"
                        style={{ backgroundColor: t.color as string }}
                      />
                    ) : (
                      "-"
                    )}
                  </TableCell>
                  <TableCell>
                    {t.extraDays != null ? String(t.extraDays) : "-"}
                  </TableCell>
                  <TableCell>
                    {editingId === t.id ? (
                      <div className="space-y-1">
                        <select
                          value={editScaleRuleSetId}
                          onChange={(e) =>
                            setEditScaleRuleSetId(e.target.value)
                          }
                          className="h-8 w-full rounded-md border bg-background px-2 text-xs"
                        >
                          <option value="">Không có quy tắc</option>
                          {(
                            ruleSets as Array<{ id: string; name: string }>
                          )?.map((rs) => (
                            <option key={rs.id} value={rs.id}>
                              {rs.name}
                            </option>
                          ))}
                        </select>
                        <label className="flex items-center gap-1 text-xs">
                          <input
                            type="checkbox"
                            checked={editNoScales}
                            onChange={(e) => setEditNoScales(e.target.checked)}
                          />
                          Không có quy tắc
                        </label>
                      </div>
                    ) : (
                      <span className="text-xs">
                        {(t.noScales as boolean)
                          ? "Không có quy tắc"
                          : t.scaleRuleSetId
                            ? ((
                                ruleSets as Array<{ id: string; name: string }>
                              )?.find((rs) => rs.id === t.scaleRuleSetId)
                                ?.name ?? "-")
                            : "-"}
                      </span>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8"
                        onClick={() => startEditing(t)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        onClick={() => handleDelete(t)}
                        disabled={deleteMutation.isPending}
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
    </div>
  );
}
