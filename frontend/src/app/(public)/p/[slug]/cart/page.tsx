import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { CheckCircle2 } from "lucide-react";
import { api } from "@/lib/api-client";
import { ROUTES, formatCurrency } from "@/lib/constants";
import { CartItemDetails } from "@/components/shared/item-details";
import { ProductCard } from "@/components/product/product-card";
import type { Product } from "@/types/product";
import type { ApiResponse } from "@/types/api";
import { PreCartActions } from "./pre-cart-actions";

const DEFAULT_PRE_CART_MAX_PRICE = 59.9;

async function getPreCartMaxPrice(): Promise<number> {
  try {
    const { data } = await api.get("/shipping/settings");
    const settings = data.data ?? {};
    const val = parseFloat(settings.pre_cart_max_price);
    return val > 0 ? val : DEFAULT_PRE_CART_MAX_PRICE;
  } catch {
    return DEFAULT_PRE_CART_MAX_PRICE;
  }
}

interface Props {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{
    variationLabel?: string;
    variation?: string;
    scale?: string;
    price?: string;
  }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const product = await getProduct(slug);
  const title = product
    ? `${product.name} — Đã thêm vào giỏ hàng`
    : "Đã thêm vào giỏ hàng";
  return { title, alternates: { canonical: `/p/${slug}/cart` } };
}

async function getProduct(slug: string): Promise<Product | null> {
  try {
    const { data } = await api.get<ApiResponse<Product>>(`/products/${slug}`);
    return data.data ?? data;
  } catch {
    return null;
  }
}

async function getSameBrandProducts(
  brandId: string,
  productId: string,
  maxPrice: number,
) {
  try {
    const { data } = await api.get("/products", {
      params: { brandId, priceMax: maxPrice, perPage: 10, isActive: true },
    });
    const items = data.data ?? [];
    return items.filter((p: Product) => p.id !== productId).slice(0, 6);
  } catch {
    return [];
  }
}

async function getRelatedProducts(
  categoryId: string | undefined,
  productId: string,
) {
  if (!categoryId) return [];
  try {
    const { data } = await api.get("/products", {
      params: { categoryId, perPage: 10 },
    });
    const items = data.data ?? [];
    return items.filter((p: Product) => p.id !== productId).slice(0, 6);
  } catch {
    return [];
  }
}

export default async function PreCartPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const sp = await searchParams;
  const product = await getProduct(slug);

  if (!product) {
    return (
      <div className="mx-auto max-w-[1400px] px-4 py-16 text-center">
        <p className="text-white/60">Không tìm thấy sản phẩm.</p>
        <Link
          href="/products"
          className="mt-4 inline-block text-cyan hover:underline"
        >
          Xem danh mục →
        </Link>
      </div>
    );
  }

  const primaryCategoryId =
    product.productCategories?.[0]?.categoryId ?? product.categoryId;
  const maxPrice = await getPreCartMaxPrice();

  const [sameBrand, related] = await Promise.all([
    product.brandId
      ? getSameBrandProducts(product.brandId, product.id, maxPrice)
      : [],
    getRelatedProducts(primaryCategoryId, product.id),
  ]);

  const sameBrandIds = new Set(sameBrand.map((p: Product) => p.id));
  const relatedFiltered = related.filter(
    (p: Product) => !sameBrandIds.has(p.id),
  );

  const mainImage =
    product.images?.find((img) => img.isMain)?.mediaFile?.thumb ??
    product.images?.[0]?.mediaFile?.thumb ??
    product.images?.[0]?.url;

  const selectedPrice = sp.price ? parseFloat(sp.price) : null;
  const displayPrice =
    selectedPrice && selectedPrice > 0
      ? selectedPrice
      : (product.salePrice ?? product.basePrice);

  return (
    <div className="mx-auto max-w-[1400px] px-4 sm:px-6 lg:px-8 py-8">
      <nav className="mb-6 text-xs text-white/50">
        <Link href={ROUTES.home} className="hover:text-cyan">
          Trang chủ
        </Link>
        <span className="mx-2">·</span>
        <Link href={`/p/${product.slug}`} className="hover:text-cyan">
          {product.name}
        </Link>
        <span className="mx-2">·</span>
        <span className="text-cyan">Đã thêm vào giỏ hàng</span>
      </nav>

      <div className="rounded-2xl border border-purple/25 bg-white/[0.03] p-6 backdrop-blur-sm">
        <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-green-500/20 text-green-400">
              <CheckCircle2 className="h-6 w-6" />
            </div>
            {mainImage && (
              <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-lg border border-white/10">
                <Image
                  src={mainImage}
                  alt={product.name}
                  fill
                  className="object-cover"
                  sizes="80px"
                />
              </div>
            )}
            <div className="min-w-0">
              <p className="text-sm text-green-400 font-medium">
                Đã thêm vào giỏ hàng
              </p>
              <Link
                href={`/p/${product.slug}`}
                className="mt-1 block text-white font-medium truncate hover:text-cyan transition-colors"
              >
                {product.name}
              </Link>
              <CartItemDetails
                variationLabel={sp.variationLabel}
                variationName={sp.variation}
                scaleName={sp.scale}
                price={displayPrice}
                className="flex flex-wrap items-center gap-x-1 text-sm text-white/60"
              />
            </div>
          </div>

          <PreCartActions productSlug={product.slug} />
        </div>
      </div>

      {sameBrand.length > 0 && (
        <section className="mt-10">
          <h2 className="mb-5 text-lg text-white [font-family:var(--font-orbitron)] tracking-wider">
            ĐỂ CÓ GIÁ TỐT NHẤT {formatCurrency(maxPrice)}
          </h2>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
            {sameBrand.map((p: Product) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </section>
      )}

      {relatedFiltered.length > 0 && (
        <section className="mt-10">
          <h2 className="mb-5 text-lg text-white [font-family:var(--font-orbitron)] tracking-wider">
            SẢN PHẨM LIÊN QUAN
          </h2>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
            {relatedFiltered.map((p: Product) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
