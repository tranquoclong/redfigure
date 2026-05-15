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
export default function AdminMaterialsPage() {
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");

  const { data: materials, isLoading } = useQuery({
    queryKey: ["admin", "materials"],
    queryFn: async () => {
      const { data } = await api.get("/materials");
      return data.data ?? data;
    },
  });

  const createMutation = useMutation({
    mutationFn: () => api.post("/materials", { name }),
    onSuccess: () => {
      setError("");
      queryClient.refetchQueries({ queryKey: ["admin", "materials"] });
      setName("");
    },
    onError: (err) => setError(extractError(err)),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, body }: { id: string; body: { name: string } }) =>
      api.put(`/materials/${id}`, body),
    onSuccess: () => {
      queryClient.refetchQueries({ queryKey: ["admin", "materials"] });
      setEditingId(null);
      setError("");
    },
    onError: (err) => setError(extractError(err)),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/materials/${id}`),
    onSuccess: () => {
      queryClient.refetchQueries({ queryKey: ["admin", "materials"] });
      setError("");
    },
    onError: (err) => setError(extractError(err)),
  });

  function startEditing(m: ApiRecord) {
    setEditingId(m.id as string);
    setEditName(m.name as string);
  }

  function handleUpdate() {
    if (editingId && editName.trim()) {
      updateMutation.mutate({ id: editingId, body: { name: editName } });
    }
  }

  function handleDelete(m: ApiRecord) {
    if (confirm(`Excluir o material "${m.name}"?`)) {
      deleteMutation.mutate(m.id as string);
    }
  }

  return (
    <div>
      <h1 className="text-3xl font-bold mb-2">Vật liệu</h1>
      <p className="text-sm text-muted-foreground mb-6">
        Danh sách tập trung các loại vật liệu được sử dụng trong sản phẩm và
        danh mục (Ví dụ: Resin, PLA, ABS). Giá trị được gửi dưới dạng chuỗi đến
        feed của Google Merchant và Meta Catalog.
      </p>
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
        className="flex gap-2 mb-6 max-w-md"
      >
        <Input
          placeholder="Vật liệu mới (Ví dụ: Resin)"
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
                <TableHead>Tên</TableHead>
                <TableHead>Slug</TableHead>
                <TableHead className="w-24">Hành động</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {materials?.map((m: ApiRecord) => (
                <TableRow key={m.id as string}>
                  <TableCell className="font-medium">
                    {editingId === m.id ? (
                      <div className="flex items-center gap-1">
                        <Input
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          className="h-8 max-w-xs"
                          onKeyDown={(e) => {
                            if (e.key === "Enter") handleUpdate();
                            if (e.key === "Escape") setEditingId(null);
                          }}
                          autoFocus
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
                        onClick={() => startEditing(m)}
                      >
                        {m.name as string}
                      </button>
                    )}
                  </TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">
                    {m.slug as string}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8"
                        onClick={() => startEditing(m)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        onClick={() => handleDelete(m)}
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
