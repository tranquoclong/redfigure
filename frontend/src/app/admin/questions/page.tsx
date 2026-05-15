"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Pagination } from "@/components/shared/pagination";
import { api } from "@/lib/api-client";
import { formatDateTime } from "@/lib/constants";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { extractApiError } from "@/lib/extract-error";

type Status = "PENDING" | "ANSWERED" | "REJECTED";
const TABS: { key: Status | "ALL"; label: string }[] = [
  { key: "PENDING", label: "Đang chờ" },
  { key: "ANSWERED", label: "Đã trả lời" },
  { key: "REJECTED", label: "Bị từ chối" },
  { key: "ALL", label: "Tất cả" },
];

interface AdminQuestion {
  id: string;
  productId: string;
  askerName: string;
  askerEmail: string;
  question: string;
  answer: string | null;
  status: Status;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
  answeredAt: string | null;
  product: { id: string; name: string; slug: string };
}

const STATUS_COLOR: Record<Status, string> = {
  PENDING: "bg-amber-500/20 text-amber-300 border-amber-500/40",
  ANSWERED: "bg-emerald-500/20 text-emerald-300 border-emerald-500/40",
  REJECTED: "bg-rose-500/20 text-rose-300 border-rose-500/40",
};

export default function AdminQuestionsPage() {
  const qc = useQueryClient();
  const [tab, setTab] = useState<Status | "ALL">("PENDING");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<AdminQuestion | null>(null);
  const [answerText, setAnswerText] = useState("");
  const [mutationError, setMutationError] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["admin", "product-questions", tab, page],
    queryFn: async () => {
      const params: Record<string, string | number> = { page, perPage: 20 };
      if (tab !== "ALL") params.status = tab;
      const { data } = await api.get("/admin/product-questions", { params });
      return data as {
        data: AdminQuestion[];
        meta: {
          total: number;
          page: number;
          perPage: number;
          lastPage: number;
        };
      };
    },
  });

  const answerMutation = useMutation({
    mutationFn: async ({ id, answer }: { id: string; answer: string }) => {
      await api.patch(`/admin/product-questions/${id}/answer`, { answer });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "product-questions"] });
      setSelected(null);
      setAnswerText("");
      setMutationError(null);
    },
    onError: (err) =>
      setMutationError(extractApiError(err, "Thất bại. Vui lòng thử lại.")),
  });

  const rejectMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.patch(`/admin/product-questions/${id}/reject`, {});
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "product-questions"] });
      setSelected(null);
      setAnswerText("");
      setMutationError(null);
    },
    onError: (err) =>
      setMutationError(extractApiError(err, "Thất bại. Vui lòng thử lại.")),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/admin/product-questions/${id}`);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "product-questions"] });
      qc.invalidateQueries({
        queryKey: ["admin", "product-questions-pending-count"],
      });
      setSelected(null);
      setAnswerText("");
      setMutationError(null);
    },
    onError: (err) =>
      setMutationError(extractApiError(err, "Thất bại. Vui lòng thử lại.")),
  });

  const questions = data?.data ?? [];
  const meta = data?.meta;

  return (
    <div>
      <h1 className="text-3xl font-bold mb-2">Câu hỏi về sản phẩm</h1>
      <p className="text-sm text-muted-foreground mb-6">
        Hàng đợi kiểm duyệt. Những câu hỏi đang chờ sẽ được trả lời để hiển thị
        trên trang web.
      </p>

      <div className="flex gap-2 mb-5 border-b border-white/10 overflow-x-auto">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => {
              setTab(t.key);
              setPage(1);
            }}
            className={`px-4 py-2.5 text-sm font-semibold whitespace-nowrap transition-colors border-b-2 ${
              tab === t.key
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <p className="text-muted-foreground">Đang tải...</p>
      ) : questions.length === 0 ? (
        <div className="rounded-lg border p-10 text-center text-muted-foreground">
          Không có câu hỏi trong tab này.
        </div>
      ) : (
        <>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Trạng thái</TableHead>
                <TableHead>Sản phẩm</TableHead>
                <TableHead>Tác giả</TableHead>
                <TableHead>Câu hỏi</TableHead>
                <TableHead>Nhận được</TableHead>
                <TableHead className="text-right">Hành động</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {questions.map((q) => (
                <TableRow key={q.id}>
                  <TableCell>
                    <span
                      className={`inline-block rounded-md border px-2 py-0.5 text-xs font-medium ${STATUS_COLOR[q.status]}`}
                    >
                      {q.status === "PENDING"
                        ? "Đang chờ"
                        : q.status === "ANSWERED"
                          ? "Đã trả lời"
                          : "Bị từ chối"}
                    </span>
                  </TableCell>
                  <TableCell className="max-w-[200px] truncate">
                    <a
                      href={`/p/${q.product.slug}#sec-qa`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-cyan hover:underline text-sm"
                    >
                      {q.product.name}
                    </a>
                  </TableCell>
                  <TableCell className="text-sm">
                    <div>{q.askerName}</div>
                    <div className="text-xs text-muted-foreground">
                      {q.askerEmail}
                    </div>
                  </TableCell>
                  <TableCell className="max-w-[360px] text-sm">
                    <p className="line-clamp-2">{q.question}</p>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {formatDateTime(q.createdAt)}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setSelected(q);
                        setAnswerText(q.answer ?? "");
                        setMutationError(null);
                      }}
                    >
                      {q.status === "PENDING" ? "Trả lời" : "Chi tiết"}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          {meta && meta.lastPage > 1 && (
            <div className="mt-5">
              <Pagination
                page={meta.page}
                lastPage={meta.lastPage}
                onPageChange={setPage}
              />
            </div>
          )}
        </>
      )}

      <Dialog
        open={!!selected}
        onOpenChange={(open) => {
          if (!open) {
            setSelected(null);
            setAnswerText("");
            setMutationError(null);
          }
        }}
      >
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>
              {selected?.status === "PENDING"
                ? "Trả lời câu hỏi"
                : "Chi tiết câu hỏi"}
            </DialogTitle>
          </DialogHeader>

          {selected && (
            <div className="space-y-4">
              <div className="rounded-lg bg-muted p-3 text-sm">
                <p className="text-xs text-muted-foreground mb-1">
                  {selected.askerName} · {selected.askerEmail}
                </p>
                <p className="whitespace-pre-wrap">{selected.question}</p>
                {selected.ipAddress && (
                  <p className="text-[11px] text-muted-foreground mt-2 font-mono">
                    IP: {selected.ipAddress}
                  </p>
                )}
              </div>

              <div>
                <label className="text-sm font-medium block mb-1">
                  Trả lời {selected.status !== "PENDING" && "(edit)"}
                </label>
                <Textarea
                  value={answerText}
                  onChange={(e) => setAnswerText(e.target.value)}
                  rows={5}
                  placeholder="Viết câu trả lời..."
                  disabled={
                    answerMutation.isPending || rejectMutation.isPending
                  }
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Plain text — HTML e URLs sẽ được làm sạch khi lưu.
                </p>
              </div>

              {mutationError && (
                <div className="rounded-lg border-l-4 border-rose-500 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">
                  {mutationError}
                </div>
              )}

              <div className="flex gap-2 flex-wrap pt-2">
                <Button
                  onClick={() =>
                    answerMutation.mutate({
                      id: selected.id,
                      answer: answerText,
                    })
                  }
                  disabled={
                    !answerText.trim() ||
                    answerMutation.isPending ||
                    rejectMutation.isPending ||
                    deleteMutation.isPending
                  }
                  className="bg-primary"
                >
                  {answerMutation.isPending
                    ? "Gửi..."
                    : selected.status === "PENDING"
                      ? "Gửi trả lời & xuất bản"
                      : "Cập nhật câu trả lời"}
                </Button>
                {selected.status === "PENDING" && (
                  <Button
                    variant="outline"
                    onClick={() => rejectMutation.mutate(selected.id)}
                    disabled={
                      answerMutation.isPending ||
                      rejectMutation.isPending ||
                      deleteMutation.isPending
                    }
                    className="border-rose-500/40 text-rose-400 hover:bg-rose-500/10"
                  >
                    {rejectMutation.isPending ? "Từ chối..." : "Từ chối"}
                  </Button>
                )}
                <Button
                  variant="outline"
                  onClick={() => {
                    if (
                      confirm(
                        "Excluir permanentemente esta pergunta? Esta ação não pode ser desfeita.",
                      )
                    ) {
                      deleteMutation.mutate(selected.id);
                    }
                  }}
                  disabled={
                    answerMutation.isPending ||
                    rejectMutation.isPending ||
                    deleteMutation.isPending
                  }
                  className="border-rose-500/60 bg-rose-500/10 text-rose-300 hover:bg-rose-500/20"
                >
                  {deleteMutation.isPending ? "Xóa..." : "Xóa vĩnh viễn"}
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => setSelected(null)}
                  disabled={
                    answerMutation.isPending ||
                    rejectMutation.isPending ||
                    deleteMutation.isPending
                  }
                >
                  Hủy
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
