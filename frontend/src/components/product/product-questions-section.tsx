"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { MessageCircleQuestion, Plus, Trash2 } from "lucide-react";
import { AxiosError } from "axios";
import { api } from "@/lib/api-client";
import { formatDate } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { ProductQuestionForm } from "./product-question-form";

interface ProductQuestionsSectionProps {
  productId: string;
  productName: string;
}

interface PublicQuestion {
  id: string;
  askerName: string;
  question: string;
  answer: string | null;
  answeredAt: string | null;
  createdAt: string;
  isOwn: boolean;
}

export function ProductQuestionsSection({
  productId,
  productName,
}: ProductQuestionsSectionProps) {
  const [formOpen, setFormOpen] = useState(false);
  const qc = useQueryClient();

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["product-questions", productId],
    queryFn: async () => {
      const res = await api.get(`/products/${productId}/questions`);
      return res.data as { data: PublicQuestion[]; meta: { total: number } };
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/product-questions/${id}`);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["product-questions", productId] });
    },
    onError: (err) => {
      const msg =
        (err instanceof AxiosError &&
          (err.response?.data as { error?: { message?: string } } | undefined)
            ?.error?.message) ||
        "Không thể xóa câu hỏi.";
      alert(msg);
    },
  });

  const questions = data?.data ?? [];

  return (
    <div>
      <div className="mb-6 flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-2xl text-white tracking-wider">CÂU HỎI</h2>
          <p className="text-sm text-white/60 mt-1">
            Câu hỏi đã được trả lời bởi Red Figure.
          </p>
        </div>
        {!formOpen && (
          <Button
            onClick={() => setFormOpen(true)}
            className="bg-magenta hover:bg-magenta/90 text-white tracking-wide"
          >
            <Plus className="h-4 w-4 mr-1" />
            Đặt câu hỏi
          </Button>
        )}
      </div>

      {formOpen && (
        <div className="mb-8">
          <ProductQuestionForm
            productId={productId}
            productName={productName}
            onCancel={() => setFormOpen(false)}
            onSuccess={() => {
              setFormOpen(false);
              refetch();
            }}
          />
        </div>
      )}

      {isLoading ? (
        <p className="text-white/50 text-sm">Đang tải...</p>
      ) : questions.length === 0 ? (
        <div className="rounded-xl border border-white/10 bg-ink-soft/30 p-8 text-center">
          <MessageCircleQuestion
            aria-hidden
            className="mx-auto h-10 w-10 text-white/30 mb-3"
          />
          <p className="text-white/70">
            Chưa có câu hỏi nào được trả lời cho sản phẩm này.
          </p>
          <p className="text-sm text-white/50 mt-1">
            Hãy là người đầu tiên đặt câu hỏi — chúng tôi sẽ trả lời qua email.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {questions.map((q) => (
            <article
              key={q.id}
              className="group rounded-xl border border-white/10 bg-ink-soft/30 p-5"
            >
              <div className="flex items-start gap-3 mb-3">
                <MessageCircleQuestion
                  aria-hidden
                  className="h-5 w-5 shrink-0 text-cyan mt-0.5"
                />
                <div className="flex-1 min-w-0">
                  <p className="text-white whitespace-pre-wrap">{q.question}</p>
                  <p className="mt-1 text-xs text-white/50">
                    <strong className="text-white/70">{q.askerName}</strong>
                    <span className="mx-1.5">·</span>
                    {formatDate(q.createdAt)}
                  </p>
                </div>
                {q.isOwn && (
                  <button
                    type="button"
                    onClick={() => {
                      if (
                        confirm(
                          "Bạn có chắc muốn xóa câu hỏi và câu trả lời này không?",
                        )
                      ) {
                        deleteMutation.mutate(q.id);
                      }
                    }}
                    disabled={deleteMutation.isPending}
                    aria-label="Excluir minha pergunta"
                    className="shrink-0 p-1.5 rounded-md text-white/40 hover:text-red-400 hover:bg-red-500/10 transition-colors disabled:opacity-50"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>

              {q.answer && (
                <div className="ml-8 pl-4 border-l-2 border-magenta/70 mt-3">
                  <p className="text-xs text-magenta font-semibold tracking-wider uppercase mb-1">
                    Câu trả lời của Red Figure
                  </p>
                  <p className="text-white/85 whitespace-pre-wrap">
                    {q.answer}
                  </p>
                  {q.answeredAt && (
                    <p className="text-xs text-white/40 mt-2">
                      {formatDate(q.answeredAt)}
                    </p>
                  )}
                </div>
              )}
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
