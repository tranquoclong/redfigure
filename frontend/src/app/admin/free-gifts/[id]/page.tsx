"use client";

import { use } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { FreeGiftForm } from "@/components/admin/free-gift-form";
import { api } from "@/lib/api-client";

interface FreeGiftRow {
  id: string;
  productId: string;
  minOrderAmount: number;
  label: string;
  startsAt: string | null;
  endsAt: string | null;
  isActive: boolean;
}

export default function EditFreeGiftPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["admin", "free-gifts", id],
    queryFn: async () => {
      const { data: res } = await api.get(`/free-gifts/${id}`);
      return res.data as FreeGiftRow;
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Đang tải…
      </div>
    );
  }

  if (isError || !data) {
    return <p className="text-destructive">Không tìm thấy quà tặng.</p>;
  }

  const toDateInput = (iso: string | null) =>
    iso ? new Date(iso).toISOString().slice(0, 10) : "";

  return (
    <FreeGiftForm
      initial={{
        id: data.id,
        productId: data.productId,
        minOrderAmount: data.minOrderAmount,
        label: data.label,
        startsAt: toDateInput(data.startsAt),
        endsAt: toDateInput(data.endsAt),
        isActive: data.isActive,
      }}
    />
  );
}
