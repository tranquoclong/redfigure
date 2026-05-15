import type { Metadata } from "next";
import { Suspense } from "react";
import { api } from "@/lib/api-client";
import { buildPageMetadata } from "@/lib/seo";
import { getGeneral } from "@/lib/site-content/general";
import { SITE_URL } from "@/lib/constants";
import { CatalogPage } from "@/components/catalog/catalog-page";
import { CatalogSkeleton } from "@/components/catalog/catalog-skeleton";
import { EmptyState } from "@/components/shared/empty-state";
import { BreadcrumbSchema } from "@/components/seo/BreadcrumbSchema";
import { JsonLdScript } from "@/components/seo/JsonLdScript";
import { buildCollectionPageSchema } from "@/components/seo/schemas";
import type { Brand } from "@/types/product";
import type { ApiResponse } from "@/types/api";

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  try {
    const [{ data }, general] = await Promise.all([
      api.get<ApiResponse<Brand>>(`/brands/${slug}`),
      getGeneral(),
    ]);
    const b = data.data;
    return buildPageMetadata({
      title: b.name,
      description:
        b.description ??
        `Mô hình của thương hiệu ${b.name}. Mô hình sưu tập cao cấp.`,
      path: `/m/${b.slug}`,
      image: b.logo,
      fallbackImage: general.ogImageUrl,
    });
  } catch {
    return { title: "Marca" };
  }
}

async function getBrand(slug: string) {
  try {
    const { data } = await api.get<ApiResponse<Brand>>(`/brands/${slug}`);
    return data.data;
  } catch {
    return null;
  }
}

export default async function BrandPage({ params }: Props) {
  const { slug } = await params;
  const brand = await getBrand(slug);

  if (!brand) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-16">
        <EmptyState
          title="Không tìm thấy thương hiệu"
          description="Thương hiệu bạn tìm không tồn tại."
        />
      </div>
    );
  }

  const description =
    brand.description ?? `Mô hình của thương hiệu ${brand.name}.`;

  return (
    <>
      <BreadcrumbSchema
        items={[
          { name: "Trang chủ", url: SITE_URL },
          { name: "Sản phẩm", url: `${SITE_URL}/products` },
          { name: brand.name, url: `${SITE_URL}/m/${brand.slug}` },
        ]}
      />
      <JsonLdScript
        data={buildCollectionPageSchema({
          siteUrl: SITE_URL,
          name: brand.name,
          description,
          url: `${SITE_URL}/m/${brand.slug}`,
          image: brand.logo,
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
          title={brand.name}
          description={brand.description}
          breadcrumb={[
            { name: "Trang chủ", href: "/" },
            { name: "Thương hiệu" },
            { name: brand.name },
          ]}
          brandId={brand.id}
          listId={`brand-${brand.slug}`}
          listName={brand.name}
        />
      </Suspense>
    </>
  );
}
