"use client";

import Link from "next/link";
import { Pencil } from "lucide-react";
import { useAuthStore } from "@/store/auth-store";

export function AdminEditButton({ productId }: { productId: string }) {
  const { user, isAuthenticated } = useAuthStore();

  if (!isAuthenticated || user?.role !== "ADMIN") return null;

  return (
    <Link
      href={`/admin/products/${productId}`}
      className="inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors"
    >
      <Pencil className="h-3 w-3" />
      Sửa sản phẩm
    </Link>
  );
}
