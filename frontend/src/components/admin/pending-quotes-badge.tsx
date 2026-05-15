"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api-client";

export function PendingQuotesBadge() {
  const { data } = useQuery({
    queryKey: ["admin", "custom-quotes-pending-count"],
    queryFn: async () => {
      const res = await api.get("/admin/custom-quotes/pending-count");
      return res.data as { data: { count: number } };
    },
    refetchInterval: 30_000,
    retry: false,
    staleTime: 15_000,
  });

  const count = data?.data?.count ?? 0;
  if (count <= 0) return null;

  return (
    <span
      className="ml-auto inline-flex items-center justify-center rounded-full bg-magenta text-white text-[10px] font-bold min-w-[18px] h-[18px] px-1.5 [font-family:var(--font-inter)]"
      aria-label={`${count} Báo giá đang chờ xử lý`}
    >
      {count > 99 ? "99+" : count}
    </span>
  );
}
