import type { Metadata } from "next";
import { Suspense } from "react";
import { api } from "@/lib/api-client";
import { buildPageMetadata } from "@/lib/seo";
import { SITE_URL } from "@/lib/constants";
import { CatalogPage } from "@/components/catalog/catalog-page";
import { CatalogSkeleton } from "@/components/catalog/catalog-skeleton";
import { EmptyState } from "@/components/shared/empty-state";
import { BreadcrumbSchema } from "@/components/seo/BreadcrumbSchema";
import { JsonLdScript } from "@/components/seo/JsonLdScript";
import { buildCollectionPageSchema } from "@/components/seo/schemas";
import type { Tag } from "@/types/product";
import type { ApiResponse } from "@/types/api";

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  try {
    const { data } = await api.get<ApiResponse<Tag>>(`/tags/${slug}`);
    const t = data.data;
    return buildPageMetadata({
      title: t.name,
      description: `Mô hình với tag ${t.name}. Tìm các nhân vật sưu tầm bằng nhựa cao cấp.`,
      path: `/t/${t.slug}`,
    });
  } catch {
    return { title: "Tag" };
  }
}

async function getTag(slug: string) {
  try {
    const { data } = await api.get<ApiResponse<Tag>>(`/tags/${slug}`);
    return data.data;
  } catch {
    return null;
  }
}

export default async function TagPage({ params }: Props) {
  const { slug } = await params;
  const tag = await getTag(slug);

  if (!tag) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-16">
        <EmptyState
          title="Không tìm thấy tag"
          description="Tag bạn tìm không tồn tại."
        />
      </div>
    );
  }

  return (
    <>
      <BreadcrumbSchema
        items={[
          { name: "Trang chủ", url: SITE_URL },
          { name: "Sản phẩm", url: `${SITE_URL}/products` },
          { name: tag.name, url: `${SITE_URL}/t/${tag.slug}` },
        ]}
      />
      <JsonLdScript
        data={buildCollectionPageSchema({
          siteUrl: SITE_URL,
          name: tag.name,
          description: `Mô hình với tag ${tag.name}.`,
          url: `${SITE_URL}/t/${tag.slug}`,
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
          title={tag.name}
          breadcrumb={[{ name: "Trang chủ", href: "/" }, { name: tag.name }]}
          tagId={tag.id}
          listId={`tag-${tag.slug}`}
          listName={tag.name}
        />
      </Suspense>
    </>
  );
}
