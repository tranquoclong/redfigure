"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, ChevronDown, ChevronUp, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { api } from "@/lib/api-client";
import { ImageUpload, type ProductImageData } from "./image-upload";

export interface VariationData {
  id?: string;
  name: string;
  sku: string;
  gtin?: string;
  price: number;
  salePrice?: number;
  manageStock?: boolean;
  stock: number;
  weight?: number;
  width?: number;
  height?: number;
  length?: number;
  image?: string;
  images?: ProductImageData[];
  attributeValueId?: string;
}

interface VariationEditorProps {
  variations: VariationData[];
  onChange: (variations: VariationData[]) => void;
  parentSku?: string;

  onMediaMetaSave?: (
    mediaFileId: string,
    patch: {
      alt?: string;
      title?: string;
      description?: string;
      caption?: string;
    },
  ) => unknown;
}

interface AttributeValue {
  id: string;
  value: string;
  slug: string;
}

interface Attribute {
  id: string;
  name: string;
  slug: string;
  values: AttributeValue[];
}

export function VariationEditor({
  variations,
  onChange,
  parentSku,
  onMediaMetaSave,
}: VariationEditorProps) {
  const queryClient = useQueryClient();
  const [selectedAttributeId, setSelectedAttributeId] = useState<string>("");
  const [checkedValueIds, setCheckedValueIds] = useState<Set<string>>(
    new Set(),
  );
  const [collapsedCards, setCollapsedCards] = useState<Set<number>>(new Set());
  const [newValueText, setNewValueText] = useState("");
  const [creatingValue, setCreatingValue] = useState(false);

  async function handleCreateValue() {
    const text = newValueText.trim();
    if (!text || !selectedAttributeId || creatingValue) return;
    setCreatingValue(true);
    try {
      const { data } = await api.post(
        `/attributes/${selectedAttributeId}/values`,
        { value: text },
      );
      const created = (data.data ?? data) as { id: string; value: string };

      await queryClient.invalidateQueries({ queryKey: ["attributes"] });

      setCheckedValueIds((prev) => new Set(prev).add(created.id));
      setNewValueText("");
    } catch {
    } finally {
      setCreatingValue(false);
    }
  }

  function updateImages(index: number, images: ProductImageData[]) {
    const updated = [...variations];
    updated[index] = { ...updated[index], images };
    onChange(updated);
  }

  const { data: attributes } = useQuery({
    queryKey: ["attributes"],
    queryFn: async () => {
      const { data } = await api.get("/attributes");
      return (data.data ?? data) as Attribute[];
    },
  });

  const selectedAttribute = attributes?.find(
    (a) => a.id === selectedAttributeId,
  );

  function toggleValueChecked(valueId: string) {
    setCheckedValueIds((prev) => {
      const next = new Set(prev);
      if (next.has(valueId)) {
        next.delete(valueId);
      } else {
        next.add(valueId);
      }
      return next;
    });
  }

  function generateVariations() {
    if (!selectedAttribute) return;

    const existingValueIds = new Set(
      variations.map((v) => v.attributeValueId).filter(Boolean),
    );

    const newVariations: VariationData[] = [];
    for (const valueId of checkedValueIds) {
      if (existingValueIds.has(valueId)) continue;
      const attrValue = selectedAttribute.values.find((v) => v.id === valueId);
      if (!attrValue) continue;
      newVariations.push({
        name: attrValue.value,
        sku: parentSku ? `${parentSku}${attrValue.value}` : "",
        price: 0,
        manageStock: false,
        stock: 0,
        attributeValueId: valueId,
      });
    }

    if (newVariations.length > 0) {
      onChange([...variations, ...newVariations]);
    }
  }

  function addManualVariation() {
    onChange([
      ...variations,
      {
        name: "",
        sku: "",
        price: 0,
        manageStock: false,
        stock: 0,
      },
    ]);
  }

  function updateVariation(
    index: number,
    field: keyof VariationData,
    value: string | number | boolean | undefined,
  ) {
    const updated = [...variations];
    updated[index] = { ...updated[index], [field]: value };
    onChange(updated);
  }

  function removeVariation(index: number) {
    onChange(variations.filter((_, i) => i !== index));
  }

  function toggleCollapse(index: number) {
    setCollapsedCards((prev) => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">
            Tạo phiên bản từ một thuộc tính
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1">
            <Label className="text-xs">Thuộc tính để tạo phiên bản</Label>
            <select
              value={selectedAttributeId}
              onChange={(e) => {
                setSelectedAttributeId(e.target.value);
                setCheckedValueIds(new Set());
              }}
              className="flex h-9 w-full rounded-md border bg-background px-3 py-1 text-sm"
            >
              <option value="">Chọn thuộc tính...</option>
              {attributes?.map((attr) => (
                <option key={attr.id} value={attr.id}>
                  {attr.name} ({attr.values.length} thuộc tính)
                </option>
              ))}
            </select>
          </div>

          {selectedAttribute && (
            <div className="space-y-2">
              {selectedAttribute.values.length > 0 ? (
                <>
                  <Label className="text-xs">
                    Chọn các giá trị để tạo phiên bản
                  </Label>
                  <div className="flex flex-wrap gap-2">
                    {selectedAttribute.values.map((val) => {
                      const isChecked = checkedValueIds.has(val.id);
                      const alreadyExists = variations.some(
                        (v) => v.attributeValueId === val.id,
                      );
                      return (
                        <label
                          key={val.id}
                          className={`flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm cursor-pointer transition-colors ${
                            alreadyExists
                              ? "border-muted bg-muted text-muted-foreground cursor-not-allowed"
                              : isChecked
                                ? "border-primary bg-primary/10 text-primary"
                                : "border-border hover:border-primary/50"
                          }`}
                        >
                          <input
                            type="checkbox"
                            className="sr-only"
                            checked={isChecked || alreadyExists}
                            disabled={alreadyExists}
                            onChange={() => toggleValueChecked(val.id)}
                          />
                          {val.value}
                          {alreadyExists && (
                            <span className="text-xs text-muted-foreground">
                              (Đã tạo)
                            </span>
                          )}
                        </label>
                      );
                    })}
                  </div>
                </>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Chưa có giá trị nào được tạo. Tạo giá trị đầu tiên bên dưới.
                </p>
              )}

              <div className="flex gap-2 pt-2 border-t">
                <Input
                  value={newValueText}
                  onChange={(e) => setNewValueText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleCreateValue();
                    }
                  }}
                  placeholder="Tạo giá trị mới (ví dụ: Xanh nhạt)"
                  className="h-9 flex-1"
                  maxLength={80}
                  disabled={creatingValue}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleCreateValue}
                  disabled={!newValueText.trim() || creatingValue}
                >
                  <Plus className="h-4 w-4 mr-1" />
                  {creatingValue ? "Đang tạo…" : "Tạo phiên bản"}
                </Button>
              </div>

              {selectedAttribute.values.length > 0 && (
                <Button
                  type="button"
                  variant="default"
                  size="sm"
                  onClick={generateVariations}
                  disabled={checkedValueIds.size === 0}
                >
                  <Wand2 className="h-4 w-4 mr-2" />
                  Tạo phiên bản ({checkedValueIds.size})
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {variations.map((v, i) => {
        const isCollapsed = collapsedCards.has(i);

        const linkedAttr = v.attributeValueId
          ? attributes?.find((a) =>
              a.values.some((av) => av.id === v.attributeValueId),
            )
          : undefined;
        const linkedValue = linkedAttr?.values.find(
          (av) => av.id === v.attributeValueId,
        );
        const isLinked = !!linkedAttr && !!linkedValue;
        return (
          <Card key={v.attributeValueId ?? `manual-${i}`}>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <button
                  type="button"
                  className="flex items-center gap-2 text-left"
                  onClick={() => toggleCollapse(i)}
                >
                  {isCollapsed ? (
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <ChevronUp className="h-4 w-4 text-muted-foreground" />
                  )}
                  <CardTitle className="text-sm">
                    Phiên bản {i + 1}: {v.name || "(Không tên)"}
                    {v.price > 0 && (
                      <span className="ml-2 font-normal text-muted-foreground">
                        — {v.price.toFixed(2)}đ
                      </span>
                    )}
                  </CardTitle>
                </button>
                <div className="flex items-center gap-2">
                  {isLinked && (
                    <span className="rounded-full border border-primary/40 bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary uppercase tracking-wider">
                      {linkedAttr!.name} → {linkedValue!.value}
                    </span>
                  )}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-destructive"
                    onClick={() => removeVariation(i)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>

            {!isCollapsed && (
              <CardContent className="space-y-3">
                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">
                      Tên
                      {isLinked && (
                        <span className="ml-1 text-[10px] text-muted-foreground">
                          (Thông qua thuộc tính)
                        </span>
                      )}
                    </Label>
                    <Input
                      value={v.name}
                      onChange={(e) =>
                        updateVariation(i, "name", e.target.value)
                      }
                      placeholder="Tên phiên bản"
                      className="h-9"
                      disabled={isLinked}
                      readOnly={isLinked}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Mã SKU</Label>
                    <Input
                      value={v.sku}
                      onChange={(e) =>
                        updateVariation(i, "sku", e.target.value)
                      }
                      placeholder="Tùy chọn"
                      className="h-9"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Mã GTIN</Label>
                    <Input
                      value={v.gtin || ""}
                      onChange={(e) =>
                        updateVariation(i, "gtin", e.target.value || undefined)
                      }
                      placeholder="Tùy chọn"
                      className="h-9"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">
                      Giá (VNĐ) <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      value={v.price || ""}
                      onChange={(e) =>
                        updateVariation(
                          i,
                          "price",
                          parseFloat(e.target.value) || 0,
                        )
                      }
                      className="h-9"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Giá khuyến mãi (VNĐ)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      value={v.salePrice || ""}
                      onChange={(e) =>
                        updateVariation(
                          i,
                          "salePrice",
                          e.target.value
                            ? parseFloat(e.target.value)
                            : undefined,
                        )
                      }
                      placeholder="Tùy chọn"
                      className="h-9"
                    />
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center justify-between mb-1">
                      <Label className="text-xs">Kho hàng</Label>
                      <label className="flex items-center gap-1.5 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={v.manageStock !== false}
                          onChange={(e) =>
                            updateVariation(i, "manageStock", e.target.checked)
                          }
                          className="rounded h-3.5 w-3.5"
                        />
                        <span className="text-[10px] text-muted-foreground">
                          Quản lý
                        </span>
                      </label>
                    </div>
                    {v.manageStock !== false ? (
                      <Input
                        type="number"
                        min="0"
                        value={v.stock}
                        onChange={(e) =>
                          updateVariation(
                            i,
                            "stock",
                            parseInt(e.target.value, 10) || 0,
                          )
                        }
                        className="h-9"
                      />
                    ) : (
                      <p className="text-xs text-muted-foreground h-9 flex items-center">
                        Vô hạn
                      </p>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-4 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Khối lượng (kg)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      value={v.weight ?? ""}
                      onChange={(e) =>
                        updateVariation(
                          i,
                          "weight",
                          e.target.value
                            ? parseFloat(e.target.value)
                            : undefined,
                        )
                      }
                      placeholder="Kế thừa từ sản phẩm"
                      className="h-9"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Chiều rộng (cm)</Label>
                    <Input
                      type="number"
                      step="0.1"
                      min="0"
                      value={v.width ?? ""}
                      onChange={(e) =>
                        updateVariation(
                          i,
                          "width",
                          e.target.value
                            ? parseFloat(e.target.value)
                            : undefined,
                        )
                      }
                      placeholder="Kế thừa từ sản phẩm"
                      className="h-9"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Chiều cao (cm)</Label>
                    <Input
                      type="number"
                      step="0.1"
                      min="0"
                      value={v.height ?? ""}
                      onChange={(e) =>
                        updateVariation(
                          i,
                          "height",
                          e.target.value
                            ? parseFloat(e.target.value)
                            : undefined,
                        )
                      }
                      placeholder="Kế thừa từ sản phẩm"
                      className="h-9"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Chiều dài (cm)</Label>
                    <Input
                      type="number"
                      step="0.1"
                      min="0"
                      value={v.length ?? ""}
                      onChange={(e) =>
                        updateVariation(
                          i,
                          "length",
                          e.target.value
                            ? parseFloat(e.target.value)
                            : undefined,
                        )
                      }
                      placeholder="Kế thừa từ sản phẩm"
                      className="h-9"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs">Hình ảnh phiên bản</Label>
                  <ImageUpload
                    images={v.images ?? []}
                    onChange={(imgs) => updateImages(i, imgs)}
                    onMediaMetaSave={onMediaMetaSave}
                  />
                </div>
              </CardContent>
            )}
          </Card>
        );
      })}

      <Button type="button" variant="outline" onClick={addManualVariation}>
        <Plus className="h-4 w-4 mr-2" />
        Thêm phiên bản thủ công
      </Button>
    </div>
  );
}
