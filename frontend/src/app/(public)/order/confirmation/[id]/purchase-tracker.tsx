"use client";

import { useEffect } from "react";
import { api } from "@/lib/api-client";
import { trackPurchase, type GA4CheckoutItem } from "@/lib/ga4-events";
import {
  trackPurchase as trackMetaPurchase,
  type MetaCheckoutItem,
} from "@/lib/meta-pixel";

interface OrderItem {
  productId: string;
  variationId?: string;
  quantity: number;
  price: number;
  product?: { name: string };
  variation?: { name: string };
}

interface OrderResponse {
  id: string;
  number: string;
  total: number;
  shipping: number;
  items: OrderItem[];
  couponCode?: string;
}

interface Props {
  orderId: string;
}

const GA4_GUARD_PREFIX = "ga4_purchase_fired_";
const META_GUARD_PREFIX = "meta_purchase_fired_";

export function PurchaseTracker({ orderId }: Props) {
  useEffect(() => {
    const ga4Guard = `${GA4_GUARD_PREFIX}${orderId}`;
    const metaGuard = `${META_GUARD_PREFIX}${orderId}`;
    const ga4Done = !!sessionStorage.getItem(ga4Guard);
    const metaDone = !!sessionStorage.getItem(metaGuard);
    if (ga4Done && metaDone) return;

    let cancelled = false;
    api
      .get<{ data: OrderResponse } | OrderResponse>(`/orders/${orderId}`)
      .then(({ data }) => {
        if (cancelled) return;
        const order =
          (data as { data?: OrderResponse }).data ?? (data as OrderResponse);
        if (!order?.items?.length) return;

        const ga4Items: GA4CheckoutItem[] = order.items.map((it) => ({
          productId: it.productId,
          variationId: it.variationId,
          variationName: it.variation?.name,
          name: it.product?.name ?? "Sản phẩm",
          price: it.price,
          quantity: it.quantity,
        }));

        if (!ga4Done) {
          trackPurchase({
            transactionId: order.number ?? order.id,
            items: ga4Items,
            value: order.total,
            shipping: order.shipping,
            coupon: order.couponCode,
          });
          sessionStorage.setItem(ga4Guard, "1");
        }

        if (!metaDone) {
          const metaItems: MetaCheckoutItem[] = order.items.map((it) => ({
            productId: it.productId,
            variationId: it.variationId,
            name: it.product?.name ?? "Sản phẩm",
            price: it.price,
            quantity: it.quantity,
          }));
          trackMetaPurchase({
            orderNumber: order.number ?? order.id,
            value: order.total,
            items: metaItems,
          });
          sessionStorage.setItem(metaGuard, "1");
        }
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [orderId]);

  return null;
}
