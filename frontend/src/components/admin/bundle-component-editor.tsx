"use client";

import { useState, useEffect, useRef } from "react";
import { Search, X, Plus } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { api } from "@/lib/api-client";
import { formatCurrency } from "@/lib/constants";
import type { Product } from "@/types/product";

interface BundleComponentData {
  childProductId: string;
  childProductName?: string;
  childVariationId?: string;
  childVariationName?: string;
  childProductPrice?: number;
  quantity: number;
  sortOrder: number;
}

interface Props {
  components: BundleComponentData[];
  onChange: (components: BundleComponentData[]) => void;
  discount: number;
}

export function BundleComponentEditor({
  components,
  onChange,
  discount,
}: Props) {
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Product[]>([]);
  const [searching, setSearching] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [selectedVariationId, setSelectedVariationId] = useState("");
  const searchRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (searchQuery.length < 2) {
      setSearchResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const { data } = await api.get("/products/admin", {
          params: { search: searchQuery, perPage: 8 },
        });

        const results = (data.data ?? []).filter(
          (p: Product) => p.type !== "bundle",
        );
        setSearchResults(results);
        setShowResults(true);
      } catch {
        setSearchResults([]);
      } finally {
        setSearching(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowResults(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  function handleSelectProduct(product: Product) {
    if (product.type === "variable" && product.variations?.length) {
      setSelectedProduct(product);
      setSelectedVariationId("");
      setShowResults(false);
      setSearchQuery("");
    } else {
      addComponent(product);
    }
  }

  function addComponent(product: Product, variationId?: string) {
    const variation = variationId
      ? product.variations?.find((v) => v.id === variationId)
      : undefined;

    const price = variation
      ? (variation.salePrice ?? variation.price)
      : (product.salePrice ?? product.basePrice);

    const exists = components.some(
      (c) =>
        c.childProductId === product.id &&
        (c.childVariationId ?? "") === (variationId ?? ""),
    );
    if (exists) return;

    onChange([
      ...components,
      {
        childProductId: product.id,
        childProductName: product.name,
        childVariationId: variationId,
        childVariationName: variation?.name,
        childProductPrice: price,
        quantity: 1,
        sortOrder: components.length,
      },
    ]);

    setSelectedProduct(null);
    setSearchQuery("");
    setSearchResults([]);
  }

  function updateQuantity(index: number, quantity: number) {
    const updated = [...components];
    updated[index] = { ...updated[index], quantity: Math.max(1, quantity) };
    onChange(updated);
  }

  function removeComponent(index: number) {
    onChange(components.filter((_, i) => i !== index));
  }

  const totalBeforeDiscount = components.reduce(
    (sum, c) => sum + (c.childProductPrice ?? 0) * c.quantity,
    0,
  );
  const totalAfterDiscount =
    Math.round(totalBeforeDiscount * (1 - discount / 100) * 100) / 100;

  return (
    <div className="space-y-4">
      <Label className="text-sm font-medium">
        Các thành phần của bộ sưu tập
      </Label>

      <div ref={searchRef} className="relative">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Tìm kiếm sản phẩm để thêm..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onFocus={() => searchResults.length > 0 && setShowResults(true)}
            className="pl-9"
          />
          {searching && (
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
              Đang tìm kiếm...
            </span>
          )}
        </div>

        {showResults && searchResults.length > 0 && (
          <div className="absolute z-50 mt-1 w-full rounded-lg border bg-popover shadow-lg max-h-60 overflow-y-auto">
            {searchResults.map((product) => (
              <button
                key={product.id}
                type="button"
                onClick={() => handleSelectProduct(product)}
                className="w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-accent transition-colors text-sm"
              >
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{product.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {product.sku ?? "-"} ·{" "}
                    {formatCurrency(product.salePrice ?? product.basePrice)}
                    {product.type === "variable" &&
                      ` · ${product.variations?.length ?? 0} phiên bản`}
                  </p>
                </div>
                <Plus className="h-4 w-4 text-muted-foreground shrink-0" />
              </button>
            ))}
          </div>
        )}
      </div>

      {selectedProduct && (
        <div className="rounded-lg border p-3 bg-muted/30 space-y-2">
          <p className="text-sm font-medium">
            Chọn phiên bản của <strong>{selectedProduct.name}</strong>:
          </p>
          <div className="flex gap-2 flex-wrap">
            {selectedProduct.variations?.map((v) => (
              <Button
                key={v.id}
                variant={selectedVariationId === v.id ? "default" : "outline"}
                size="sm"
                onClick={() => {
                  setSelectedVariationId(v.id);
                  addComponent(selectedProduct, v.id);
                }}
              >
                {v.name} — {formatCurrency(v.salePrice ?? v.price)}
              </Button>
            ))}
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSelectedProduct(null)}
          >
            Hủy
          </Button>
        </div>
      )}

      {components.length > 0 ? (
        <div className="space-y-2">
          {components.map((comp, i) => (
            <div
              key={`${comp.childProductId}-${comp.childVariationId ?? ""}`}
              className="flex items-center gap-2 border rounded-lg p-2.5"
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">
                  {comp.childProductName || comp.childProductId}
                </p>
                {comp.childVariationName && (
                  <p className="text-xs text-muted-foreground">
                    {comp.childVariationName}
                  </p>
                )}
              </div>
              {comp.childProductPrice != null && (
                <span className="text-xs text-muted-foreground shrink-0">
                  {formatCurrency(comp.childProductPrice)}
                </span>
              )}
              <span className="text-xs text-muted-foreground">×</span>
              <Input
                type="number"
                min="1"
                value={comp.quantity}
                onChange={(e) =>
                  updateQuantity(i, parseInt(e.target.value, 10) || 1)
                }
                className="w-16 text-center"
              />
              <Button
                variant="ghost"
                size="sm"
                onClick={() => removeComponent(i)}
                className="text-red-400 hover:text-red-300 shrink-0"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground py-4 text-center border rounded-lg border-dashed">
          Chưa có thành phần nào được thêm. Sử dụng tìm kiếm ở trên để thêm sản
          phẩm vào bộ sưu tập.
        </p>
      )}

      {components.length > 0 && (
        <div className="rounded-lg border bg-muted/20 p-3 space-y-1 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Tổng các thành phần:</span>
            <span>{formatCurrency(totalBeforeDiscount)}</span>
          </div>
          {discount > 0 && (
            <div className="flex justify-between text-green-400">
              <span>Giảm giá ({discount}%):</span>
              <span>
                -{formatCurrency(totalBeforeDiscount - totalAfterDiscount)}
              </span>
            </div>
          )}
          <div className="flex justify-between font-bold border-t pt-1 mt-1">
            <span>Giá bộ sưu tập:</span>
            <span>{formatCurrency(totalAfterDiscount)}</span>
          </div>
        </div>
      )}
    </div>
  );
}
