"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Filter, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "@/lib/api-client";

interface FilterSidebarProps {
  onFilterChange: (filters: {
    attributeValueIds: string[];
    brandId?: string;
    priceMin?: number;
    priceMax?: number;
  }) => void;
}

export function FilterSidebar({ onFilterChange }: FilterSidebarProps) {
  const [selectedValues, setSelectedValues] = useState<string[]>([]);
  const [selectedBrand, setSelectedBrand] = useState("");
  const [priceMin, setPriceMin] = useState("");
  const [priceMax, setPriceMax] = useState("");

  const { data: attributes } = useQuery({
    queryKey: ["attributes-filter"],
    queryFn: async () => {
      const { data } = await api.get("/attributes");
      return (data.data ?? data) as Array<{
        id: string;
        name: string;
        values: Array<{ id: string; value: string }>;
      }>;
    },
  });

  const { data: brands } = useQuery({
    queryKey: ["brands-filter"],
    queryFn: async () => {
      const { data } = await api.get("/brands");
      return (data.data ?? data) as Array<{ id: string; name: string }>;
    },
  });

  function toggleValue(valueId: string) {
    const next = selectedValues.includes(valueId)
      ? selectedValues.filter((id) => id !== valueId)
      : [...selectedValues, valueId];
    setSelectedValues(next);
    applyFilters(next, selectedBrand, priceMin, priceMax);
  }

  function applyFilters(
    vals: string[],
    brand: string,
    min: string,
    max: string,
  ) {
    onFilterChange({
      attributeValueIds: vals,
      brandId: brand || undefined,
      priceMin: min ? parseFloat(min) : undefined,
      priceMax: max ? parseFloat(max) : undefined,
    });
  }

  function clearAll() {
    setSelectedValues([]);
    setSelectedBrand("");
    setPriceMin("");
    setPriceMax("");
    onFilterChange({ attributeValueIds: [] });
  }

  const hasFilters =
    selectedValues.length > 0 || selectedBrand || priceMin || priceMax;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <Filter className="h-4 w-4" />
          Bộ lọc
        </h3>
        {hasFilters && (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs"
            onClick={clearAll}
          >
            <X className="h-3 w-3 mr-1" />
            Xóa
          </Button>
        )}
      </div>

      <div className="space-y-2">
        <Label className="text-xs font-medium">Giá</Label>
        <div className="flex gap-2">
          <Input
            type="number"
            placeholder="Min"
            value={priceMin}
            onChange={(e) => {
              setPriceMin(e.target.value);
              applyFilters(
                selectedValues,
                selectedBrand,
                e.target.value,
                priceMax,
              );
            }}
            className="h-8 text-xs"
          />
          <Input
            type="number"
            placeholder="Max"
            value={priceMax}
            onChange={(e) => {
              setPriceMax(e.target.value);
              applyFilters(
                selectedValues,
                selectedBrand,
                priceMin,
                e.target.value,
              );
            }}
            className="h-8 text-xs"
          />
        </div>
      </div>

      {brands && brands.length > 0 && (
        <div className="space-y-2">
          <Label className="text-xs font-medium">Thương hiệu</Label>
          <div className="space-y-1">
            {brands.map((brand) => (
              <label
                key={brand.id}
                className="flex items-center gap-2 text-sm cursor-pointer"
              >
                <input
                  type="radio"
                  name="brand"
                  checked={selectedBrand === brand.id}
                  onChange={() => {
                    const next = selectedBrand === brand.id ? "" : brand.id;
                    setSelectedBrand(next);
                    applyFilters(selectedValues, next, priceMin, priceMax);
                  }}
                  className="accent-primary"
                />
                {brand.name}
              </label>
            ))}
          </div>
        </div>
      )}

      {attributes?.map((attr) => (
        <div key={attr.id} className="space-y-2">
          <Label className="text-xs font-medium">{attr.name}</Label>
          <div className="space-y-1">
            {attr.values.map((val) => (
              <label
                key={val.id}
                className="flex items-center gap-2 text-sm cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={selectedValues.includes(val.id)}
                  onChange={() => toggleValue(val.id)}
                  className="accent-primary"
                />
                {val.value}
              </label>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
