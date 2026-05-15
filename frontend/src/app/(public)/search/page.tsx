"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { CatalogPage } from "@/components/catalog/catalog-page";
import { EmptyState } from "@/components/shared/empty-state";

function SearchContent() {
  const searchParams = useSearchParams();
  const q = searchParams.get("q") ?? "";

  if (!q) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-16">
        <EmptyState
          title="Nhập gì đó để tìm kiếm"
          description="Sử dụng thanh tìm kiếm để tìm mô hình."
        />
      </div>
    );
  }

  return (
    <CatalogPage
      title={`Kết quả cho "${q}"`}
      breadcrumb={[
        { name: "Trang chủ", href: "/" },
        { name: `Tìm kiếm: ${q}` },
      ]}
      search={q}
      listId={`search-${q}`}
      listName={`Tìm kiếm: ${q}`}
    />
  );
}

export default function SearchPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-7xl px-4 py-16 text-center text-muted-foreground">
          Đang tải...
        </div>
      }
    >
      <SearchContent />
    </Suspense>
  );
}
