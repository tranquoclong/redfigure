import { Suspense } from "react";
import { buildPageMetadata } from "@/lib/seo";
import { CatalogPage } from "@/components/catalog/catalog-page";
import { CatalogSkeleton } from "@/components/catalog/catalog-skeleton";
import { BreadcrumbSchema } from "@/components/seo/BreadcrumbSchema";
import { SITE_URL } from "@/lib/constants";
import { JsonLdScript } from "@/components/seo/JsonLdScript";
import { buildCollectionPageSchema } from "@/components/seo/schemas";

export const metadata = buildPageMetadata({
  title: "Sản phẩm Mô hình",
  description:
    "Khám phá toàn bộ mô hình. Các tác phẩm điêu khắc bằng nhựa resin chi tiết dành cho người sưu tầm.",
  path: "/products",
});

export default function ProductsPage() {
  return (
    <>
      <BreadcrumbSchema
        items={[
          { name: "Trang chủ", url: SITE_URL },
          { name: "Sản phẩm", url: `${SITE_URL}/products` },
        ]}
      />
      <JsonLdScript
        data={buildCollectionPageSchema({
          siteUrl: SITE_URL,
          name: "Sản phẩm Mô hình",
          description:
            "Khám phá toàn bộ mô hình. Các tác phẩm điêu khắc bằng nhựa resin chi tiết dành cho người sưu tầm.",
          url: `${SITE_URL}/products`,
        })}
      />
      <Suspense
        fallback={
          <div className="mx-auto max-w-[1400px] px-4 py-8 sm:px-6 lg:px-8">
            <CatalogSkeleton />
          </div>
        }
      >
        <CatalogPage
          title="Sản phẩm"
          breadcrumb={[{ name: "Trang chủ", href: "/" }, { name: "Sản phẩm" }]}
          listId="all-products"
          listName="Sản phẩm"
        />
      </Suspense>
    </>
  );
}
