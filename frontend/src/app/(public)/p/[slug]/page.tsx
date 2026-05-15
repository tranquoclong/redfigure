import type { Metadata } from "next";
import Link from "next/link";
import { api } from "@/lib/api-client";
import { ROUTES, SITE_URL, SITE_NAME } from "@/lib/constants";
import { getGeneral } from "@/lib/site-content/general";
import { EmptyState } from "@/components/shared/empty-state";
import { ProductCard } from "@/components/product/product-card";
import { ReviewsSection } from "@/components/product/reviews-section";
import { ProductQuestionsSection } from "@/components/product/product-questions-section";
import { ProductSchema } from "@/components/seo/ProductSchema";
import { BreadcrumbSchema } from "@/components/seo/BreadcrumbSchema";
import { Breadcrumb } from "@/components/layout/breadcrumb";
import { ProductMain } from "./product-main";
import { AdminEditButton } from "./admin-edit-button";
import { ProductViewTracker } from "./product-view-tracker";
import { ProductTabs } from "./product-tabs";
import { BrandStrip } from "@/components/product/brand-strip";
import {
  DescriptionSection,
  type DescSidebarRow,
} from "@/components/product/description-section";
import { PdpSectionHeader } from "@/components/product/pdp-section-header";
import type { Product, ProductAttribute } from "@/types/product";
import type { ApiResponse } from "@/types/api";

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  try {
    const [{ data }, general] = await Promise.all([
      api.get<ApiResponse<Product>>(`/products/${slug}`),
      getGeneral(),
    ]);
    const p = data.data ?? data;
    const title = (p as Product & { metaTitle?: string }).metaTitle || p.name;
    const description = p.shortDescription ?? p.description;
    const canonical = `/p/${p.slug}`;
    const mainImg =
      p.images?.find((img) => img.isMain)?.mediaFile ??
      p.images?.[0]?.mediaFile;
    const mainImageUrl = mainImg?.full;

    const fallbackOg = general.ogImageUrl ?? `${SITE_URL}/og-image.jpg`;

    const variations = p.variations ?? [];
    const isVariable = p.type === "variable" && variations.length > 0;
    const prices = isVariable
      ? variations.map((v) => v.salePrice ?? v.price)
      : [p.salePrice ?? p.basePrice];
    const minPrice = Math.min(...prices);
    const maxPrice = Math.max(...prices);
    const priceLabel =
      minPrice === maxPrice
        ? `${minPrice.toFixed(2)}đ  `
        : `${minPrice.toFixed(2)}đ - ${maxPrice.toFixed(2)}đ`;

    const inStock =
      p.manageStock === false ||
      (p.stock ?? 0) > 0 ||
      (isVariable &&
        variations.some((v) => v.manageStock === false || (v.stock ?? 0) > 0));

    return {
      title,
      description,
      alternates: { canonical },
      robots: {
        index: true,
        follow: true,
        "max-snippet": -1 as unknown as undefined,
        "max-video-preview": -1 as unknown as undefined,
        "max-image-preview": "large" as unknown as undefined,
      },
      openGraph: {
        type: "website",
        title,
        description,
        url: `${SITE_URL}${canonical}`,
        siteName: SITE_NAME,
        locale: "vi_VN",
        images: mainImageUrl
          ? [
              {
                url: mainImageUrl,
                width: 1200,
                height: 1200,
                alt: mainImg?.alt ?? p.name,
                type: "image/webp",
              },
            ]
          : [{ url: fallbackOg, width: 1200, height: 630, alt: p.name }],
      },
      twitter: {
        card: "summary_large_image",
        title,
        description,
        images: [mainImageUrl ?? fallbackOg],
      },
      other: {
        "product:brand": p.brand?.name ?? "",
        "product:availability": inStock ? "Còn hàng" : "Hết hàng",
        "product:retailer_item_id": p.sku ?? "",

        "twitter:label1": "Giá",
        "twitter:data1": priceLabel,
        "twitter:label2": "Tình trạng",
        "twitter:data2": inStock ? "Còn hàng" : "Hết hàng",
      },
    };
  } catch {
    return { title: "Sản phẩm" };
  }
}

interface RawReview {
  rating: number;
  comment: string | null;
  createdAt: string;
  user?: { name: string | null };
}

async function getReviewsData(productId: string) {
  try {
    const { data } = await api.get(`/products/${productId}/reviews`);
    const body = data.data ?? data;
    const rawList: RawReview[] = body.reviews ?? [];

    const reviews = rawList.slice(0, 10).map((r) => ({
      authorName: r.user?.name ?? "",
      rating: r.rating,
      comment: r.comment,
      createdAt: r.createdAt,
    }));
    return {
      rating: { average: body.average ?? 0, count: body.count ?? 0 },
      reviews,
    };
  } catch {
    return { rating: { average: 0, count: 0 }, reviews: [] };
  }
}

async function getProduct(slug: string) {
  try {
    const { data } = await api.get(`/products/${slug}`);
    return data.data ?? data;
  } catch {
    return null;
  }
}

async function getRelatedProducts(
  categoryId: string | undefined,
  productId: string,
  perPage = 4,
) {
  if (!categoryId) return [];
  try {
    const { data } = await api.get("/products", {
      params: { categoryId, perPage: perPage + 4 },
    });
    const items = data.data ?? [];
    return items
      .filter((p: { id: string }) => p.id !== productId)
      .slice(0, perPage);
  } catch {
    return [];
  }
}

async function getScaleData(productId: string) {
  try {
    const { data } = await api.get(`/scales/for-product/${productId}`);
    return data.data ?? null;
  } catch {
    return null;
  }
}

interface PaymentMethodSummary {
  id: string;
  enabled: boolean;
  discount: number;
}

function groupAttributes(attributes: ProductAttribute[]) {
  const map = new Map<string, string[]>();
  const order: string[] = [];
  for (const pa of attributes) {
    const name = pa.attributeValue.attribute.name;
    if (!map.has(name)) {
      map.set(name, []);
      order.push(name);
    }
    map.get(name)!.push(pa.attributeValue.value);
  }
  return order.map((name) => ({ name, value: map.get(name)!.join(", ") }));
}

export default async function ProductPage({ params }: Props) {
  const { slug } = await params;
  const product = await getProduct(slug);

  if (!product) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-16">
        <EmptyState
          title="Không tìm thấy sản phẩm"
          description="Sản phẩm bạn đang tìm kiếm không tồn tại hoặc đã bị xóa."
        />
      </div>
    );
  }

  const primaryCategory =
    product.productCategories?.[0]?.category ?? product.category;

  const [related, scaleData, reviewsData] = await Promise.all([
    getRelatedProducts(
      product.productCategories?.[0]?.categoryId ?? product.categoryId,
      product.id,
      4,
    ),
    getScaleData(product.id),
    getReviewsData(product.id),
  ]);
  const { rating, reviews } = reviewsData;

  const images = product.images ?? [];
  const variations = product.variations ?? [];
  const tags = product.tags ?? [];
  const attributes = product.attributes ?? [];

  let productionDays = 0;
  if (product.extraDays != null && product.extraDays > 0) {
    productionDays = product.extraDays;
  } else {
    const tagDays = tags
      .map((t: { extraDays?: number | null }) => t.extraDays ?? 0)
      .filter((n: number) => n > 0);
    if (tagDays.length > 0) {
      productionDays = Math.max(...tagDays);
    } else if (
      primaryCategory?.extraDays != null &&
      primaryCategory.extraDays > 0
    ) {
      productionDays = primaryCategory.extraDays;
    }
  }

  const specRows: { name: string; value: string }[] = [];
  if (productionDays > 0) {
    specRows.push({
      name: "Thời gian sản xuất",
      value: `${productionDays} ngày`,
    });
  }
  if (product.sku) specRows.push({ name: "SKU", value: product.sku });
  if (product.color)
    specRows.push({ name: "Màu sắc", value: product.color.name });
  if (product.material)
    specRows.push({ name: "Chất liệu", value: product.material.name });
  if (product.weight)
    specRows.push({ name: "Trọng lượng", value: `${product.weight} g` });
  if (product.height || product.width || product.length) {
    const dims = [product.height, product.width, product.length]
      .filter(Boolean)
      .map((d) => `${d} cm`)
      .join(" × ");
    specRows.push({ name: "Kích thước (Cao × Rộng × Dài)", value: dims });
  }
  specRows.push(...groupAttributes(attributes));
  const hasSpecs = specRows.length > 0;

  const isNsfw = tags.some(
    (t: { slug: string }) =>
      t.slug === "+18" ||
      t.slug === "+18-nsfw" ||
      t.slug === "nsfw" ||
      t.slug === "adulto",
  );
  const descSidebar: DescSidebarRow[] = [];
  if (product.brand)
    descSidebar.push({ key: "Studio", value: product.brand.name });
  if (primaryCategory)
    descSidebar.push({ key: "Danh mục", value: primaryCategory.name });
  if (isNsfw)
    descSidebar.push({ key: "Đánh giá", value: "+18 NSFW", hot: true });
  if (variations.length > 0) {
    descSidebar.push({
      key: "Phân loại",
      value: `${variations.length} loại đang có`,
      cyan: true,
    });
  }
  if (product.sku)
    descSidebar.push({ key: "SKU", value: product.sku, cyan: true });

  const breadcrumbItems = [
    { name: "Trang chủ", url: SITE_URL },
    { name: "Sản phẩm", url: `${SITE_URL}/products` },
    ...(primaryCategory
      ? [
          {
            name: primaryCategory.name,
            url: `${SITE_URL}/c/${primaryCategory.slug}`,
          },
        ]
      : []),
    { name: product.name, url: `${SITE_URL}/p/${product.slug}` },
  ];

  const productTabs = [
    ...(product.description || product.content || descSidebar.length > 0
      ? [
          {
            id: "desc",
            label: "Mô tả",
            content: (
              <DescriptionSection
                html={product.content || product.description}
                productionDays={productionDays}
                sidebar={descSidebar}
              />
            ),
          },
        ]
      : []),
    ...(hasSpecs
      ? [
          {
            id: "specs",
            label: "Thông số kĩ thuật",
            content: (
              <div className="grid max-w-4xl gap-x-12 gap-y-0 sm:grid-cols-2">
                {specRows.map((row, idx) => (
                  <div
                    key={row.name + idx}
                    className="flex justify-between gap-3 border-b border-white/10 py-3.5 text-sm"
                  >
                    <span className="text-white/55">{row.name}</span>
                    <span className="text-right font-medium text-white">
                      {row.value}
                    </span>
                  </div>
                ))}
              </div>
            ),
          },
        ]
      : []),
    {
      id: "reviews",
      label: "Đánh giá",
      count: rating.count > 0 ? rating.count : undefined,
      content: <ReviewsSection productId={product.id} />,
    },
    {
      id: "qa",
      label: "Hỏi đáp",
      content: (
        <ProductQuestionsSection
          productId={product.id}
          productName={product.name}
        />
      ),
    },
  ];

  return (
    <div className="mx-auto max-w-[1400px] px-4 sm:px-6 lg:px-8 py-8">
      <ProductSchema
        product={product}
        siteUrl={SITE_URL}
        rating={rating}
        reviews={reviews}
      />
      <BreadcrumbSchema items={breadcrumbItems} />
      <ProductViewTracker product={product} />

      <div id="product-top-anchor" />

      <Breadcrumb
        items={[
          { name: "Trang chủ", href: ROUTES.home },
          { name: "Sản phẩm", href: "/products" },
          ...(primaryCategory
            ? [
                {
                  name: primaryCategory.name,
                  href: ROUTES.category(primaryCategory.slug),
                },
              ]
            : []),
          { name: product.name },
        ]}
      />

      <div className="mb-4 flex justify-end">
        <AdminEditButton productId={product.id} />
      </div>

      <ProductMain
        product={product}
        images={images}
        variations={variations}
        scaleData={scaleData}
        brand={
          product.brand
            ? {
                id: product.brand.id,
                name: product.brand.name,
                slug: product.brand.slug,
                description: product.brand.description ?? null,
                productsCount: (product.brand as { productsCount?: number })
                  .productsCount,
              }
            : null
        }
        averageRating={rating.average}
        reviewCount={rating.count}
        productionDays={productionDays}
        isNsfw={isNsfw}
        category={
          primaryCategory
            ? { name: primaryCategory.name, slug: primaryCategory.slug }
            : null
        }
      />

      {product.brand && (
        <section className="mt-12">
          <BrandStrip
            brand={{
              id: product.brand.id,
              name: product.brand.name,
              slug: product.brand.slug,
              description: product.brand.description ?? null,
              productsCount: (product.brand as { productsCount?: number })
                .productsCount,
            }}
          />
        </section>
      )}

      <ProductTabs tabs={productTabs} />

      {related.length > 0 && (
        <section className="border-t border-white/10 py-12">
          <PdpSectionHeader
            num="04"
            eyebrow="Sản phẩm tương tự"
            title="Sản phẩm tương tự"
            more={{ href: "/products" }}
          />
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            {related.map((p: Product) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
