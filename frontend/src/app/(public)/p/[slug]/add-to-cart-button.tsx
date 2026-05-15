"use client";

import { useState } from "react";
import { ShoppingCart, Minus, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api-client";
import { useCartStore } from "@/store/cart-store";

interface Props {
  productId: string;
  productName: string;
}

export function AddToCartButton({ productId }: Props) {
  const [quantity, setQuantity] = useState(1);
  const [loading, setLoading] = useState(false);
  const [added, setAdded] = useState(false);
  const setCart = useCartStore((s) => s.setCart);

  async function handleAddToCart() {
    setLoading(true);
    try {
      const { data } = await api.post("/cart/items", {
        productId,
        quantity,
      });
      setCart(data.data.items, data.data.subtotal);
      setAdded(true);
      setTimeout(() => setAdded(false), 2000);
    } catch {
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <span className="text-sm font-medium">Số lượng:</span>
        <div className="flex items-center border rounded-md">
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9"
            onClick={() => setQuantity(Math.max(1, quantity - 1))}
            disabled={quantity <= 1}
          >
            <Minus className="h-4 w-4" />
          </Button>
          <span className="w-10 text-center text-sm font-medium">
            {quantity}
          </span>
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9"
            onClick={() => setQuantity(quantity + 1)}
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <Button
        size="lg"
        className="w-full"
        onClick={handleAddToCart}
        disabled={loading}
      >
        <ShoppingCart className="mr-2 h-5 w-5" />
        {added ? "Đã thêm!" : loading ? "Đang thêm..." : "Thêm vào giỏ hàng"}
      </Button>
    </div>
  );
}
