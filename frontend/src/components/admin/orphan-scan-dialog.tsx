"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, ShieldCheck, Trash2, ScanSearch } from "lucide-react";
import Image from "next/image";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api-client";
import { extractError } from "@/lib/extract-error";

interface OrphanMedia {
  id: string;
  filename: string;
  thumb: string;
  card: string;
  whitelistedAt: string | null;
  createdAt: string;
}

interface BulkResult {
  deleted: string[];
  skipped: { id: string; reason: string }[];
}

export function OrphanScanDialog() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [orphans, setOrphans] = useState<OrphanMedia[] | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [scanError, setScanError] = useState("");
  const [bulkResult, setBulkResult] = useState<BulkResult | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const scanMutation = useMutation({
    mutationFn: async () => {
      const res = await api.get<{ data: OrphanMedia[] }>("/media/orphan-scan");
      return res.data.data;
    },
    onSuccess: (data) => {
      setOrphans(data);
      setSelected(new Set());
      setBulkResult(null);
      setScanError("");
    },
    onError: (err) => setScanError(extractError(err)),
  });

  const handleOpen = () => {
    setOpen(true);
    setBulkResult(null);
    if (!orphans) scanMutation.mutate();
  };

  const handleRescan = () => {
    setBulkResult(null);
    setSelected(new Set());
    scanMutation.mutate();
  };

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (!orphans) return;
    if (selected.size === orphans.length) setSelected(new Set());
    else setSelected(new Set(orphans.map((o) => o.id)));
  };

  const whitelistMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      await Promise.all(ids.map((id) => api.patch(`/media/${id}/whitelist`)));
    },
    onSuccess: () => {
      handleRescan();
      queryClient.invalidateQueries({ queryKey: ["admin", "gallery"] });
    },
    onError: (err) => setScanError(extractError(err)),
  });

  const deleteMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      const res = await api.post<{ data: BulkResult }>(
        "/media/orphan-scan/bulk-delete",
        { ids },
      );
      return res.data.data;
    },
    onSuccess: (result) => {
      setBulkResult(result);
      setConfirmDelete(false);
      handleRescan();
      queryClient.invalidateQueries({ queryKey: ["admin", "gallery"] });
    },
    onError: (err) => {
      setScanError(extractError(err));
      setConfirmDelete(false);
    },
  });

  const selectedCount = selected.size;
  const allSelected =
    orphans !== null && orphans.length > 0 && selected.size === orphans.length;

  return (
    <>
      <Button
        variant="outline"
        onClick={handleOpen}
        title="Xác định hình ảnh không được sử dụng trong sản phẩm, danh mục, blog, banner, trang, opengraph, nội dung HTML hoặc cài đặt."
      >
        <ScanSearch className="h-4 w-4 mr-2" />
        Kiểm tra ảnh rác
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>Ảnh không sử dụng</DialogTitle>
            <DialogDescription>
              Hình ảnh không được sử dụng trong sản phẩm, danh mục, blog,
              banner, trang, opengraph, nội dung HTML hoặc cài đặt. "Whitelist"
              bảo vệ khỏi bị xóa — lần quét tiếp theo sẽ bỏ qua.
            </DialogDescription>
          </DialogHeader>

          {scanError && (
            <div className="bg-destructive/10 text-destructive border border-destructive/20 rounded-md px-3 py-2 text-sm">
              {scanError}
            </div>
          )}

          {bulkResult && (
            <div
              className={`border rounded-md px-3 py-2 text-sm ${
                bulkResult.skipped.length === 0
                  ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                  : "bg-amber-500/10 text-amber-400 border-amber-500/20"
              }`}
            >
              <p>
                {bulkResult.deleted.length} hình ảnh đã bị xóa khỏi S3/DB.
                {bulkResult.skipped.length > 0 &&
                  ` ${bulkResult.skipped.length} hình ảnh đã bị bỏ qua — xem chi tiết:`}
              </p>
              {bulkResult.skipped.length > 0 && (
                <ul className="list-disc pl-5 mt-1 text-xs space-y-0.5">
                  {bulkResult.skipped.slice(0, 5).map((s) => (
                    <li key={s.id}>
                      <code>{s.id.slice(0, 10)}…</code>: {s.reason}
                    </li>
                  ))}
                  {bulkResult.skipped.length > 5 && (
                    <li>+ {bulkResult.skipped.length - 5} hình ảnh khác</li>
                  )}
                </ul>
              )}
            </div>
          )}

          {scanMutation.isPending && (
            <div className="flex items-center gap-2 text-muted-foreground py-8 justify-center">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Đang phân tích việc sử dụng của từng hình ảnh...</span>
            </div>
          )}

          {orphans !== null && !scanMutation.isPending && (
            <>
              <div className="flex items-center justify-between gap-3 px-1">
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={toggleAll}
                    disabled={orphans.length === 0}
                    aria-label="Chọn tất cả"
                  />
                  <span className="text-sm text-muted-foreground">
                    {orphans.length === 0
                      ? "Không tìm thấy ảnh rác — môi trường sạch."
                      : `${orphans.length} ảnh rác · ${selectedCount} ảnh được chọn`}
                  </span>
                </div>
                <Button size="sm" variant="ghost" onClick={handleRescan}>
                  Quét lại
                </Button>
              </div>

              {orphans.length > 0 && (
                <div className="overflow-y-auto flex-1 -mx-4 px-4 border rounded-md mt-2">
                  <ul className="divide-y">
                    {orphans.map((m) => (
                      <li
                        key={m.id}
                        className="flex items-center gap-3 py-2 px-1"
                      >
                        <input
                          type="checkbox"
                          checked={selected.has(m.id)}
                          onChange={() => toggle(m.id)}
                          aria-label={`Chọn ${m.filename}`}
                        />
                        <Image
                          src={m.thumb}
                          alt={m.filename}
                          width={48}
                          height={48}
                          className="rounded object-cover w-12 h-12"
                          unoptimized
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">
                            {m.filename}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            <code>{m.id.slice(0, 12)}…</code> · tạo ngày{" "}
                            {new Date(m.createdAt).toLocaleDateString("vi-VN")}
                          </p>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {selectedCount > 0 && (
                <div className="flex items-center justify-end gap-2 pt-2 border-t">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      whitelistMutation.mutate(Array.from(selected))
                    }
                    disabled={whitelistMutation.isPending}
                  >
                    {whitelistMutation.isPending ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <ShieldCheck className="h-4 w-4 mr-2" />
                    )}
                    Bỏ qua ({selectedCount})
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => setConfirmDelete(true)}
                    disabled={deleteMutation.isPending}
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Xóa ({selectedCount})
                  </Button>
                </div>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Xác nhận xóa</DialogTitle>
            <DialogDescription>
              {selectedCount} ảnh sẽ được xóa khỏi S3 và DB. Thao tác này là
              không thể hoàn tác. Backend sẽ xác nhận lại từng ảnh là ảnh rác
              trước khi xóa — nếu có ảnh nào được sử dụng sau khi quét, nó sẽ tự
              động bị bỏ qua.
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-center justify-end gap-2 pt-2">
            <Button
              variant="ghost"
              onClick={() => setConfirmDelete(false)}
              disabled={deleteMutation.isPending}
            >
              Hủy
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteMutation.mutate(Array.from(selected))}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4 mr-2" />
              )}
              Xóa vĩnh viễn
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
