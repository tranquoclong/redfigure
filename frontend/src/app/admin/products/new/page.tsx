"use client";

import { useEffect, useState } from "react";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ProductForm } from "@/components/admin/product-form";
import {
  useAiProductStore,
  type AiProductData,
} from "@/store/ai-product-store";

const AI_SESSION_KEY = "ai_product_data";

function readSessionAiData(): AiProductData | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(AI_SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as AiProductData;
    if (parsed && typeof parsed.title === "string" && parsed.title) {
      return parsed;
    }
  } catch {}
  return null;
}

export default function NewProductPage() {
  const aiData = useAiProductStore((s) => s.data);
  const setAiData = useAiProductStore((s) => s.setData);
  const clearAiData = useAiProductStore((s) => s.clear);

  const [sessionAiData] = useState<AiProductData | null>(readSessionAiData);

  useEffect(() => {
    if (!aiData && sessionAiData) {
      setAiData(sessionAiData);
    }
  }, [aiData, sessionAiData, setAiData]);

  const effectiveAiData = aiData ?? sessionAiData;

  return (
    <>
      {effectiveAiData && (
        <div className="mb-6 p-4 bg-purple/10 border border-purple/30 rounded-lg flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-purple shrink-0" />
            <span className="text-sm font-medium">
              Form được điền sẵn bằng AI
              {(effectiveAiData.matchedAttributes?.length ?? 0) +
                (effectiveAiData.unmatchedAttributes?.length ?? 0) >
                0 &&
                ` — ${effectiveAiData.matchedAttributes?.length ?? 0} thuộc tính đã tìm thấy, ${effectiveAiData.unmatchedAttributes?.length ?? 0} thuộc tính mới`}
            </span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              clearAiData();
              sessionStorage.removeItem(AI_SESSION_KEY);
              window.location.reload();
            }}
          >
            Xóa dữ liệu AI
          </Button>
        </div>
      )}
      <ProductForm aiData={effectiveAiData} />
    </>
  );
}
