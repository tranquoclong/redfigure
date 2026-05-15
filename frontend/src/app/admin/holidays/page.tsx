"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { api } from "@/lib/api-client";
import { formatDate } from "@/lib/constants";

interface Holiday {
  id: string;
  date: string;
  name: string;
}

export default function AdminHolidaysPage() {
  const queryClient = useQueryClient();
  const [newDate, setNewDate] = useState("");
  const [newName, setNewName] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const { data: holidays, isLoading } = useQuery({
    queryKey: ["admin", "holidays"],
    queryFn: async () => {
      const { data } = await api.get("/holidays");
      return (data.data ?? []) as Holiday[];
    },
  });

  const createMutation = useMutation({
    mutationFn: (dto: { date: string; name: string }) =>
      api.post("/holidays", dto),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "holidays"] });
      setNewDate("");
      setNewName("");
      setError("");
      setSuccess("Feriado adicionado");
      setTimeout(() => setSuccess(""), 3000);
    },
    onError: (err) => {
      const msg =
        (err as { response?: { data?: { error?: { message?: string } } } })
          ?.response?.data?.error?.message ?? "Lỗi khi tạo ngày lễ";
      setError(msg);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/holidays/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "holidays"] });
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!newDate || !newName.trim()) return;
    createMutation.mutate({ date: newDate, name: newName.trim() });
  }

  return (
    <div>
      <h1 className="text-3xl font-bold mb-2">Ngày lễ</h1>
      <p className="text-sm text-muted-foreground mb-6">
        Thêm ngày lễ để hệ thống tính toán ngày giao hàng.
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
        onSubmit={handleSubmit}
        className="flex gap-3 mb-6 items-end max-w-xl"
      >
        <div className="space-y-1">
          <Label className="text-xs">Ngày</Label>
          <Input
            type="date"
            value={newDate}
            onChange={(e) => setNewDate(e.target.value)}
            required
          />
        </div>
        <div className="flex-1 space-y-1">
          <Label className="text-xs">Tên ngày lễ</Label>
          <Input
            placeholder="Ex: Lễ Quốc Khánh, Tết Dương Lịch"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            required
          />
        </div>
        <Button type="submit" disabled={createMutation.isPending}>
          <Plus className="h-4 w-4 mr-2" />
          Thêm
        </Button>
      </form>

      {isLoading ? (
        <p className="text-muted-foreground">Đang tải...</p>
      ) : !holidays?.length ? (
        <p className="text-muted-foreground text-sm">Chưa có ngày lễ nào.</p>
      ) : (
        <div className="border rounded-lg max-w-xl">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Ngày</TableHead>
                <TableHead>Tên ngày lễ</TableHead>
                <TableHead className="w-[60px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {holidays.map((h) => (
                <TableRow key={h.id}>
                  <TableCell>{formatDate(h.date)}</TableCell>
                  <TableCell className="font-medium">{h.name}</TableCell>
                  <TableCell>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 text-destructive"
                      onClick={() => {
                        if (confirm(`Chắc chắn muốn xóa "${h.name}"?`))
                          deleteMutation.mutate(h.id);
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
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
