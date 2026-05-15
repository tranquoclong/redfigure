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
import type { Category } from "@/types/product";
import type { ApiResponse } from "@/types/api";

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  try {
    const [{ data }, general] = await Promise.all([
      api.get<ApiResponse<Category>>(`/categories/${slug}`),
      getGeneral(),
    ]);
    const c = data.data;
    return buildPageMetadata({
      title: c.name,
      description:
        c.description ??
        `Mô hình của danh mục ${c.name}. Mô hình sưu tập với chất lượng cao.`,
      path: `/c/${c.slug}`,
      image: c.image,
      fallbackImage: general.ogImageUrl,
    });
  } catch {
    return { title: "Danh mục" };
  }
}

async function getCategory(slug: string) {
  try {
    const { data } = await api.get<ApiResponse<Category>>(
      `/categories/${slug}`,
    );
    return data.data;
  } catch {
    return null;
  }
}

export default async function CategoryPage({ params }: Props) {
  const { slug } = await params;
  const category = await getCategory(slug);

  if (!category) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-16">
        <EmptyState
          title="Danh mục không tìm thấy"
          description="Không tìm thấy danh mục"
        />
      </div>
    );
  }

  const description =
    category.description ?? `Mô hình của danh mục ${category.name}.`;

  return (
    <>
      <BreadcrumbSchema
        items={[
          { name: "Trang chủ", url: SITE_URL },
          { name: "Sản phẩm", url: `${SITE_URL}/products` },
          { name: category.name, url: `${SITE_URL}/c/${category.slug}` },
        ]}
      />
      <JsonLdScript
        data={buildCollectionPageSchema({
          siteUrl: SITE_URL,
          name: category.name,
          description,
          url: `${SITE_URL}/c/${category.slug}`,
          image: category.image,
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
          title={category.name}
          description={category.description}
          breadcrumb={[
            { name: "Trang chủ", href: "/" },
            { name: "Sản phẩm", href: "/products" },
            { name: category.name },
          ]}
          categoryId={category.id}
          listId={`category-${category.slug}`}
          listName={category.name}
        />
      </Suspense>
    </>
  );
}
