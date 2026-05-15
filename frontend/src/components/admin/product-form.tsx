"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Save,
  Plus,
  Package,
  Clock,
  Layers,
  GitBranch,
  CheckCircle,
  ExternalLink,
  History,
  ShoppingBag,
  Search,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { api } from "@/lib/api-client";
import { RichTextEditor } from "./rich-text-editor";
import { ImageUpload, type ProductImageData } from "./image-upload";
import { VariationEditor, type VariationData } from "./variation-editor";
import {
  applyMediaMetaPatch,
  applyMediaMetaPatchToVariations,
  type MediaMetaPatch,
} from "@/lib/media-meta-sync";
import { AttributeSelector } from "./attribute-selector";
import type { BundleComponent } from "@/types/product";
import { BundleComponentEditor } from "./bundle-component-editor";
import { useAiProductStore } from "@/store/ai-product-store";
import { StockAuditLog } from "./stock-audit-log";
import { GoogleCategoryPicker } from "./google-category-picker";
import slugify from "slug";

interface ProductFormProps {
  productId?: string;
  aiData?: import("@/store/ai-product-store").AiProductData | null;
}

interface CategoryNode {
  id: string;
  name: string;
  children?: CategoryNode[];
}

function CategoryTreePicker({
  categories,
  selectedIds,
  primaryId,
  onToggle,
  onPrimary,
  depth = 0,
}: {
  categories: CategoryNode[];
  selectedIds: string[];
  primaryId: string | null;
  onToggle: (id: string) => void;
  onPrimary: (id: string) => void;
  depth?: number;
}) {
  return (
    <>
      {categories.map((cat) => {
        const isSelected = selectedIds.includes(cat.id);
        const isPrimary = primaryId === cat.id;
        return (
          <div key={cat.id}>
            <div
              className="flex items-center gap-2 py-1 px-1 rounded hover:bg-muted/40 text-sm"
              style={{ paddingLeft: `${depth * 16 + 4}px` }}
            >
              <input
                type="checkbox"
                checked={isSelected}
                onChange={() => onToggle(cat.id)}
                className="rounded"
              />
              <span
                className="flex-1 cursor-pointer"
                onClick={() => onToggle(cat.id)}
              >
                {cat.name}
              </span>
              {isSelected && (
                <label
                  className="flex items-center gap-1 text-[10px] text-muted-foreground cursor-pointer"
                  title="Đặt làm danh mục chính"
                >
                  <input
                    type="radio"
                    name="primary-category"
                    checked={isPrimary}
                    onChange={() => onPrimary(cat.id)}
                    className="cursor-pointer"
                  />
                  chính
                </label>
              )}
            </div>
            {cat.children && cat.children.length > 0 && (
              <CategoryTreePicker
                categories={cat.children}
                selectedIds={selectedIds}
                primaryId={primaryId}
                onToggle={onToggle}
                onPrimary={onPrimary}
                depth={depth + 1}
              />
            )}
          </div>
        );
      })}
    </>
  );
}

const DATA_TABS = [
  { id: "inventory", label: "Kho", icon: Package },
  { id: "catalog", label: "Danh mục", icon: ShoppingBag },
  { id: "delivery", label: "Sản xuất", icon: Clock },
  { id: "attributes", label: "Thuộc tính", icon: Layers },
  { id: "seo", label: "SEO", icon: Search },
] as const;

type DataTabId =
  | (typeof DATA_TABS)[number]["id"]
  | "variations"
  | "bundle-components"
  | "stock-log";

export function ProductForm({ productId, aiData }: ProductFormProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const isEdit = !!productId;

  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugManual, setSlugManual] = useState(false);
  const [description, setDescription] = useState("");
  const [shortDescription, setShortDescription] = useState("");
  const [type, setType] = useState("simple");
  const [basePrice, setBasePrice] = useState("");
  const [salePrice, setSalePrice] = useState("");
  const [sku, setSku] = useState("");
  const [gtin, setGtin] = useState("");
  const [mpn, setMpn] = useState("");
  const [condition, setCondition] = useState("new");

  const [colorId, setColorId] = useState("");
  const [materialId, setMaterialId] = useState("");
  const [googleCategoryId, setGoogleCategoryId] = useState<string | null>(null);
  const [salePriceStartDate, setSalePriceStartDate] = useState("");
  const [salePriceEndDate, setSalePriceEndDate] = useState("");
  const [manageStock, setManageStock] = useState(false);
  const [stock, setStock] = useState("0");
  const [stockAdjustmentNote, setStockAdjustmentNote] = useState("");
  const [lowStockThreshold, setLowStockThreshold] = useState("");
  const [weight, setWeight] = useState("");
  const [width, setWidth] = useState("");
  const [height, setHeight] = useState("");
  const [length, setLength] = useState("");
  const [extraDays, setExtraDays] = useState("");
  const [productImages, setProductImages] = useState<ProductImageData[]>([]);
  const [variations, setVariations] = useState<VariationData[]>([]);
  const [attributeValueIds, setAttributeValueIds] = useState<string[]>([]);
  const [categoryIds, setCategoryIds] = useState<string[]>([]);
  const [primaryCategoryId, setPrimaryCategoryId] = useState<string | null>(
    null,
  );
  const [brandId, setBrandId] = useState("");
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [scaleRuleSetId, setScaleRuleSetId] = useState("");
  const [noScales, setNoScales] = useState(false);

  const [bundleDiscount, setBundleDiscount] = useState("0");
  const [bundleComponents, setBundleComponents] = useState<
    Array<{
      childProductId: string;
      childProductName?: string;
      childVariationId?: string;
      childVariationName?: string;
      quantity: number;
      sortOrder: number;
    }>
  >([]);

  const [aiMatchedLocal, setAiMatchedLocal] = useState<
    NonNullable<typeof aiData>["matchedAttributes"] | undefined
  >();
  const [aiUnmatchedLocal, setAiUnmatchedLocal] = useState<
    NonNullable<typeof aiData>["unmatchedAttributes"] | undefined
  >();
  const [aiPendingCount, setAiPendingCount] = useState(0);

  const [metaTitle, setMetaTitle] = useState("");
  const [seoKeywords, setSeoKeywords] = useState("");

  const [isDraft, setIsDraft] = useState(false);
  const [isActive, setIsActive] = useState(true);
  const [featured, setFeatured] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [createdProductId, setCreatedProductId] = useState<string | null>(null);

  const [dropboxReturnPath, setDropboxReturnPath] = useState<string | null>(
    null,
  );

  const [suggestedSku, setSuggestedSku] = useState("");
  const [skuManual, setSkuManual] = useState(false);

  const [newCatName, setNewCatName] = useState("");
  const [newBrandName, setNewBrandName] = useState("");
  const [newTagName, setNewTagName] = useState("");

  const [activeDataTab, setActiveDataTab] = useState<DataTabId>("inventory");

  const { data: existingProduct } = useQuery({
    queryKey: ["admin", "product", productId],
    queryFn: async () => {
      const { data } = await api.get(`/products/${productId}`);
      return data.data ?? data;
    },
    enabled: isEdit,
  });

  const { data: categories } = useQuery({
    queryKey: ["admin", "categories"],
    queryFn: async () => {
      const { data } = await api.get("/categories");
      return data.data ?? data;
    },
  });

  const { data: brands } = useQuery({
    queryKey: ["admin", "brands"],
    queryFn: async () => {
      const { data } = await api.get("/brands");
      return data.data ?? data;
    },
  });

  const { data: tags } = useQuery({
    queryKey: ["admin", "tags"],
    queryFn: async () => {
      const { data } = await api.get("/tags");
      return data.data ?? data;
    },
  });

  const { data: ruleSets } = useQuery({
    queryKey: ["admin", "scale-rule-sets"],
    queryFn: async () => {
      const { data } = await api.get("/scales/rule-sets");
      return data.data ?? [];
    },
  });

  const { data: colors } = useQuery({
    queryKey: ["admin", "colors"],
    queryFn: async () => {
      const { data } = await api.get("/colors");
      return data.data ?? [];
    },
  });

  const { data: materials } = useQuery({
    queryKey: ["admin", "materials"],
    queryFn: async () => {
      const { data } = await api.get("/materials");
      return data.data ?? [];
    },
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    const returnPath = sessionStorage.getItem("dropbox_parent_path");
    if (returnPath !== null) setDropboxReturnPath(returnPath);
    const justSaved = sessionStorage.getItem("product_just_saved");
    if (justSaved) {
      setSuccessMsg(justSaved);
      sessionStorage.removeItem("product_just_saved");
    }
  }, []);

  useEffect(() => {
    if (existingProduct) {
      setName(existingProduct.name ?? "");
      setSlug(existingProduct.slug ?? "");
      setSlugManual(true);
      setDescription(
        existingProduct.content || existingProduct.description || "",
      );
      setShortDescription(existingProduct.shortDescription ?? "");
      setType(existingProduct.type ?? "simple");
      setBasePrice(String(existingProduct.basePrice ?? ""));
      setSalePrice(
        existingProduct.salePrice ? String(existingProduct.salePrice) : "",
      );
      setSku(existingProduct.sku ?? "");
      setGtin(existingProduct.gtin ?? "");
      setMpn(existingProduct.mpn ?? "");
      setCondition(existingProduct.condition ?? "new");
      setColorId(existingProduct.colorId ?? "");
      setMaterialId(existingProduct.materialId ?? "");
      setGoogleCategoryId(existingProduct.googleCategoryId ?? null);
      setSalePriceStartDate(
        existingProduct.salePriceStartDate
          ? existingProduct.salePriceStartDate.slice(0, 10)
          : "",
      );
      setSalePriceEndDate(
        existingProduct.salePriceEndDate
          ? existingProduct.salePriceEndDate.slice(0, 10)
          : "",
      );
      setManageStock(existingProduct.manageStock ?? true);
      setStock(String(existingProduct.stock ?? 0));
      setLowStockThreshold(
        existingProduct.lowStockThreshold != null
          ? String(existingProduct.lowStockThreshold)
          : "",
      );
      setWeight(existingProduct.weight ? String(existingProduct.weight) : "");
      setWidth(existingProduct.width ? String(existingProduct.width) : "");
      setHeight(existingProduct.height ? String(existingProduct.height) : "");
      setLength(existingProduct.length ? String(existingProduct.length) : "");
      setExtraDays(
        existingProduct.extraDays != null
          ? String(existingProduct.extraDays)
          : "",
      );
      const pcs: Array<{ categoryId: string; isPrimary?: boolean }> =
        existingProduct.productCategories ?? [];
      setCategoryIds(pcs.map((pc) => pc.categoryId));
      const primary = pcs.find((pc) => pc.isPrimary);
      setPrimaryCategoryId(primary?.categoryId ?? pcs[0]?.categoryId ?? null);
      setBrandId(existingProduct.brandId ?? "");
      setSelectedTagIds(
        existingProduct.tags?.map((t: { id: string }) => t.id) ?? [],
      );
      setScaleRuleSetId(existingProduct.scaleRuleSetId ?? "");
      setNoScales(existingProduct.noScales ?? false);

      setBundleDiscount(String(existingProduct.bundleDiscount ?? 0));
      if (existingProduct.bundleComponents?.length) {
        setBundleComponents(
          existingProduct.bundleComponents.map(
            (c: BundleComponent, i: number) => ({
              childProductId: c.childProductId ?? c.childProduct?.id,
              childProductName: c.childProduct?.name,
              childVariationId: c.childVariationId,
              childVariationName: c.childVariation?.name,
              quantity: c.quantity,
              sortOrder: c.sortOrder ?? i,
            }),
          ),
        );
      }
      setIsDraft(existingProduct.isDraft ?? false);
      setIsActive(existingProduct.isActive ?? true);

      if (productId) {
        api
          .get(`/seo/meta/product/${productId}`)
          .then(({ data }) => {
            const meta = data.data ?? data;
            if (meta?.title) setMetaTitle(meta.title);
            if (meta?.keywords) setSeoKeywords(meta.keywords);
          })
          .catch(() => {});
      }
      setFeatured(existingProduct.featured ?? false);

      setProductImages(
        existingProduct.images?.map(
          (img: {
            id: string;
            mediaFileId: string;
            isMain: boolean;
            order: number;
            mediaFile?: {
              id: string;
              thumb: string;
              card: string;
              gallery: string;
              full: string;
              alt?: string;
              title?: string;
              description?: string;
              caption?: string | null;
              captionPresetId?: string | null;
              captionPreset?: { id: string; name: string; text: string } | null;
            };
          }) => ({
            mediaFileId: img.mediaFileId,
            thumb: img.mediaFile?.thumb ?? "",
            card: img.mediaFile?.card ?? "",
            gallery: img.mediaFile?.gallery ?? "",
            full: img.mediaFile?.full ?? "",
            alt: img.mediaFile?.alt ?? undefined,
            title: img.mediaFile?.title ?? undefined,
            description: img.mediaFile?.description ?? undefined,
            caption: img.mediaFile?.caption ?? undefined,
            captionPresetId:
              img.mediaFile?.captionPreset?.id ??
              img.mediaFile?.captionPresetId ??
              null,
            captionPresetName: img.mediaFile?.captionPreset?.name ?? null,
            isMain: img.isMain,
            order: img.order,
          }),
        ) ?? [],
      );

      setVariations(
        existingProduct.variations?.map(
          (v: {
            id: string;
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
            attributeValueId?: string;
            images?: Array<{
              id: string;
              mediaFileId: string;
              isMain: boolean;
              order: number;
              mediaFile?: {
                id: string;
                thumb: string;
                card: string;
                gallery: string;
                full: string;
                alt?: string;
                title?: string;
                description?: string;
                caption?: string | null;
                captionPresetId?: string | null;
                captionPreset?: {
                  id: string;
                  name: string;
                  text: string;
                } | null;
              };
            }>;
          }) => ({
            id: v.id,
            name: v.name,
            sku: v.sku,
            gtin: v.gtin,
            price: v.price,
            salePrice: v.salePrice,
            manageStock: v.manageStock !== false,
            stock: v.stock,
            weight: v.weight,
            width: v.width,
            height: v.height,
            length: v.length,
            image: v.image,
            attributeValueId: v.attributeValueId,
            images:
              v.images?.map((img) => ({
                id: img.id,
                mediaFileId: img.mediaFileId,
                thumb: img.mediaFile?.thumb ?? "",
                card: img.mediaFile?.card ?? "",
                gallery: img.mediaFile?.gallery ?? "",
                full: img.mediaFile?.full ?? "",
                alt: img.mediaFile?.alt,
                title: img.mediaFile?.title,
                description: img.mediaFile?.description,
                caption: img.mediaFile?.caption ?? undefined,
                captionPresetId:
                  img.mediaFile?.captionPreset?.id ??
                  img.mediaFile?.captionPresetId ??
                  null,
                captionPresetName: img.mediaFile?.captionPreset?.name ?? null,
                isMain: img.isMain,
                order: img.order,
              })) ?? [],
          }),
        ) ?? [],
      );

      setAttributeValueIds(
        existingProduct.attributes?.map(
          (pa: { attributeValueId: string }) => pa.attributeValueId,
        ) ?? [],
      );
    }
  }, [existingProduct, productId]);

  useEffect(() => {
    if (productId) return;
    api
      .get("/settings/product-defaults")
      .then(({ data }) => {
        const d = data.data;
        if (d?.weight) setWeight((prev) => prev || d.weight);
        if (d?.width) setWidth((prev) => prev || d.width);
        if (d?.height) setHeight((prev) => prev || d.height);
        if (d?.length) setLength((prev) => prev || d.length);
        if (d?.condition)
          setCondition((prev) => (prev === "new" ? d.condition : prev));
        if (d?.colorId) setColorId((prev) => prev || d.colorId);
        if (d?.materialId) setMaterialId((prev) => prev || d.materialId);
      })
      .catch(() => {});
  }, [productId]);

  useEffect(() => {
    if (productId || !brandId || skuManual) {
      if (!brandId) setSuggestedSku("");
      return;
    }
    let cancelled = false;
    api
      .get(`/products/next-sku?brandId=${brandId}`)
      .then(({ data }) => {
        if (!cancelled) {
          const nextSku = data.data?.sku ?? "";
          setSuggestedSku(nextSku);
          setSku((prev) => prev || nextSku);
        }
      })
      .catch(() => {
        if (!cancelled) setSuggestedSku("");
      });
    return () => {
      cancelled = true;
    };
  }, [brandId, productId, skuManual]);

  const aiConsumedRef = React.useRef(false);
  const clearAiStore = useAiProductStore((s) => s.clear);
  useEffect(() => {
    if (!aiData || aiConsumedRef.current) return;
    aiConsumedRef.current = true;

    setName(aiData.title ?? "");
    setSlug(aiData.slug ?? "");
    setSlugManual(true);
    setDescription(aiData.longDescription ?? "");
    setShortDescription(aiData.shortDescription ?? "");
    setBrandId(aiData.brandId ?? "");

    if (aiData.metaTitle) setMetaTitle(aiData.metaTitle);
    if (aiData.seoKeywords?.length)
      setSeoKeywords(aiData.seoKeywords.join(", "));

    setAiMatchedLocal(aiData.matchedAttributes);
    setAiUnmatchedLocal(aiData.unmatchedAttributes);
    const matchedIds = (aiData.matchedAttributes ?? []).map(
      (a) => a.attributeValueId,
    );
    if (aiData.collectionAttributeValueId) {
      matchedIds.push(aiData.collectionAttributeValueId);
    }
    const dedupedIds = Array.from(new Set(matchedIds));
    if (dedupedIds.length) setAttributeValueIds(dedupedIds);

    if (aiData.preUploadedMedia?.length) {
      setProductImages(
        aiData.preUploadedMedia.map((m, i) => ({
          mediaFileId: m.mediaFileId,
          thumb: m.thumb,
          card: m.card,
          gallery: m.gallery,
          full: m.full,
          alt: m.alt,
          title: m.title,
          description: m.description,
          isMain: i === 0,
          order: i,
        })),
      );
    }

    const dropboxJson = sessionStorage.getItem("dropbox_media_files");
    if (dropboxJson) {
      try {
        const dropboxImages: ProductImageData[] = JSON.parse(dropboxJson);
        if (dropboxImages.length > 0) setProductImages(dropboxImages);
      } catch {}
      sessionStorage.removeItem("dropbox_media_files");
    }

    sessionStorage.removeItem("ai_product_data");

    setTimeout(() => clearAiStore(), 0);
  }, [aiData, clearAiStore]);

  useEffect(() => {
    if (productId || aiData) return;
    const dropboxJson = sessionStorage.getItem("dropbox_media_files");
    if (dropboxJson) {
      try {
        const dropboxImages: ProductImageData[] = JSON.parse(dropboxJson);
        if (dropboxImages.length > 0) setProductImages(dropboxImages);
      } catch {}
      sessionStorage.removeItem("dropbox_media_files");
    }
  }, [productId, aiData]);

  function handleNameChange(val: string) {
    setName(val);
    if (!slugManual) {
      setSlug(slugify(val, { lower: true }));
    }
  }

  const createCat = useMutation({
    mutationFn: (n: string) => api.post("/categories", { name: n }),
    onSuccess: (res) => {
      const created = res.data.data ?? res.data;
      setCategoryIds((prev) => [...prev, created.id]);
      setNewCatName("");
      queryClient.invalidateQueries({ queryKey: ["admin", "categories"] });
    },
  });

  const createBrand = useMutation({
    mutationFn: (n: string) => api.post("/brands", { name: n }),
    onSuccess: (res) => {
      const created = res.data.data ?? res.data;
      setBrandId(created.id);
      setNewBrandName("");
      queryClient.invalidateQueries({ queryKey: ["admin", "brands"] });
    },
  });

  const createTag = useMutation({
    mutationFn: (n: string) => api.post("/tags", { name: n }),
    onSuccess: (res) => {
      const created = res.data.data ?? res.data;
      setSelectedTagIds((prev) => [...prev, created.id]);
      setNewTagName("");
      queryClient.invalidateQueries({ queryKey: ["admin", "tags"] });
    },
  });

  const resetForm = useCallback(() => {
    setName("");
    setSlug("");
    setSlugManual(false);
    setDescription("");
    setShortDescription("");
    setType("simple");
    setBasePrice("");
    setSalePrice("");
    setSku("");
    setGtin("");
    setMpn("");
    setCondition("new");
    setColorId("");
    setMaterialId("");
    setGoogleCategoryId(null);
    setSalePriceStartDate("");
    setSalePriceEndDate("");
    setManageStock(true);
    setStock("0");
    setWeight("");
    setWidth("");
    setHeight("");
    setLength("");
    setExtraDays("");
    setProductImages([]);
    setVariations([]);
    setAttributeValueIds([]);
    setCategoryIds([]);
    setPrimaryCategoryId(null);
    setBrandId("");
    setSelectedTagIds([]);
    setScaleRuleSetId("");
    setNoScales(false);
    setIsActive(true);
    setFeatured(false);
    setSuccessMsg("");
    setCreatedProductId(null);
    setError("");
  }, []);

  const pendingMetaSavesRef = useRef<Set<Promise<unknown>>>(new Set());

  const metaSaveControllersRef = useRef<Map<string, AbortController>>(
    new Map(),
  );

  const handleMediaMetaSave = useCallback(
    (mediaFileId: string, patch: MediaMetaPatch) => {
      const ALLOWED_FIELDS: ReadonlyArray<keyof MediaMetaPatch> = [
        "alt",
        "title",
        "description",
        "caption",
        "captionPresetId",
      ];
      const controller = new AbortController();
      const touchedKeys: string[] = [];
      for (const field of Object.keys(patch)) {
        if (!ALLOWED_FIELDS.includes(field as keyof MediaMetaPatch)) continue;
        const key = `${mediaFileId}:${field}`;
        metaSaveControllersRef.current.get(key)?.abort();
        metaSaveControllersRef.current.set(key, controller);
        touchedKeys.push(key);
      }

      const putPromise = api.put(`/media/${mediaFileId}`, patch, {
        signal: controller.signal,
      });
      pendingMetaSavesRef.current.add(putPromise);
      void putPromise
        .then(() => {
          setProductImages((imgs) =>
            applyMediaMetaPatch(imgs, mediaFileId, patch),
          );
          setVariations((vs) =>
            applyMediaMetaPatchToVariations(vs, mediaFileId, patch),
          );
          queryClient.invalidateQueries({ queryKey: ["gallery-picker"] });
        })
        .catch((err) => {
          const name = (err as { name?: string })?.name;
          const code = (err as { code?: string })?.code;
          if (
            name === "CanceledError" ||
            name === "AbortError" ||
            code === "ERR_CANCELED"
          ) {
            return;
          }
          console.error(`Media meta auto-save failed for ${mediaFileId}:`, err);
          setError(
            "Lỗi khi lưu thông tin ảnh. Hãy thử lại, chỉnh sửa trực tiếp trong thư viện ảnh",
          );
        })
        .finally(() => {
          pendingMetaSavesRef.current.delete(putPromise);

          for (const key of touchedKeys) {
            if (metaSaveControllersRef.current.get(key) === controller) {
              metaSaveControllersRef.current.delete(key);
            }
          }
        });
      return putPromise;
    },
    [queryClient],
  );

  async function handleSubmit(draftOverride?: boolean) {
    const savingAsDraft = draftOverride ?? isDraft;
    setError("");
    setSuccessMsg("");
    setSaving(true);

    const body: Record<string, unknown> = {
      name,
      slug: slug || undefined,
      description: description || " ",
      shortDescription: shortDescription || undefined,
      content: description || undefined,
      type,
      basePrice:
        type === "variable" || type === "bundle" ? 0 : parseFloat(basePrice),
      salePrice: salePrice ? parseFloat(salePrice) : undefined,
      sku: sku || undefined,
      gtin: gtin || undefined,
      mpn: mpn || undefined,
      condition,
      colorId: colorId || null,
      materialId: materialId || null,
      googleCategoryId: googleCategoryId || null,
      salePriceStartDate: salePriceStartDate || undefined,
      salePriceEndDate: salePriceEndDate || undefined,
      manageStock,
      stock: manageStock ? parseInt(stock, 10) : undefined,
      ...(productId && stockAdjustmentNote.trim()
        ? { stockAdjustmentNote: stockAdjustmentNote.trim() }
        : {}),
      lowStockThreshold: lowStockThreshold
        ? parseInt(lowStockThreshold, 10)
        : null,
      weight: weight ? parseFloat(weight) : undefined,
      width: width ? parseFloat(width) : undefined,
      height: height ? parseFloat(height) : undefined,
      length: length ? parseFloat(length) : undefined,
      extraDays: extraDays ? parseInt(extraDays, 10) : undefined,
      categoryIds: categoryIds.length ? categoryIds : undefined,
      primaryCategoryId:
        categoryIds.length &&
        primaryCategoryId &&
        categoryIds.includes(primaryCategoryId)
          ? primaryCategoryId
          : undefined,
      brandId: brandId || undefined,
      tagIds: selectedTagIds,
      attributeValueIds,
      images: productImages.map((img, i) => ({
        mediaFileId: img.mediaFileId,
        isMain: img.isMain,
        order: i,
      })),
      scaleRuleSetId: scaleRuleSetId || undefined,
      noScales,
      isDraft: savingAsDraft,
      isActive,
      featured,
    };

    if (!isEdit) {
      const dropboxPath = sessionStorage.getItem("dropbox_folder_path");
      if (dropboxPath) {
        body.dropboxFolderPath = dropboxPath;
        body.renameDropboxFolder = true;
      }
    }

    if (type === "variable") {
      body.variations = variations.map((v) => ({
        ...(v.id ? { id: v.id } : {}),
        name: v.name,
        sku: v.sku || undefined,
        gtin: v.gtin || undefined,
        price: v.price,
        salePrice: v.salePrice ?? undefined,
        manageStock: v.manageStock !== false,
        stock: v.manageStock !== false ? (v.stock ?? 0) : 0,
        weight: v.weight ?? undefined,
        width: v.width ?? undefined,
        height: v.height ?? undefined,
        length: v.length ?? undefined,
        image: v.image || undefined,
        attributeValueId: v.attributeValueId || undefined,
        images: (v.images ?? []).map((img, i) => ({
          mediaFileId: img.mediaFileId,
          isMain: img.isMain,
          order: img.order ?? i,
        })),
      }));
    }

    if (type === "bundle") {
      body.bundleDiscount = parseFloat(bundleDiscount) || 0;
      body.bundleComponents = bundleComponents.map((c, i) => ({
        childProductId: c.childProductId,
        childVariationId: c.childVariationId || undefined,
        quantity: c.quantity,
        sortOrder: i,
      }));
      body.manageStock = false;
    }

    try {
      if (pendingMetaSavesRef.current.size > 0) {
        const waitPending = Promise.allSettled([
          ...pendingMetaSavesRef.current,
        ]);
        let timerId: ReturnType<typeof setTimeout> | undefined;
        const timeout = new Promise((resolve) => {
          timerId = setTimeout(() => resolve("timeout"), 3000);
        });
        await Promise.race([waitPending, timeout]);
        if (timerId !== undefined) clearTimeout(timerId);
      }
      let savedProductId = productId;

      if (isEdit) {
        await api.put(`/products/${productId}`, body);
      } else {
        const res = await api.post("/products", body);
        const created = res.data.data ?? res.data;
        savedProductId = created.id;
        setCreatedProductId(created.id);
      }

      if (savedProductId && (metaTitle || seoKeywords)) {
        await api
          .put("/seo/meta", {
            entityType: "product",
            entityId: savedProductId,
            title: metaTitle || undefined,
            keywords: seoKeywords || undefined,
            description: body.shortDescription || undefined,
          })
          .catch(() => {});
      }

      const dropboxParentPath = sessionStorage.getItem("dropbox_parent_path");
      sessionStorage.removeItem("dropbox_folder_path");
      if (dropboxParentPath !== null) {
        setDropboxReturnPath(dropboxParentPath);
      }
      const successText = "Đã lưu sản phẩm thành công!";
      setSuccessMsg(successText);

      if (!isEdit && savedProductId) {
        sessionStorage.setItem("product_just_saved", successText);

        router.replace(`/admin/products/${savedProductId}`);
      }
    } catch (err) {
      const resp = (
        err as {
          response?: {
            data?: { error?: { message?: string; details?: string[] } };
          };
        }
      )?.response?.data;
      setError(
        resp?.error?.details?.join(". ") ??
          resp?.error?.message ??
          "Lỗi khi lưu",
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    setDeleting(true);
    try {
      await api.delete(`/products/${productId}`);
      router.push("/admin/products");
    } catch (err) {
      const resp = (
        err as { response?: { data?: { error?: { message?: string } } } }
      )?.response?.data;
      setError(resp?.error?.message ?? "Lỗi khi xóa sản phẩm");
      setShowDeleteDialog(false);
    } finally {
      setDeleting(false);
    }
  }

  const allDataTabs: Array<{
    id: DataTabId;
    label: string;
    icon: typeof Package;
  }> = [
    ...DATA_TABS,
    ...(type === "variable"
      ? [
          {
            id: "variations" as DataTabId,
            label: "Các phiên bản",
            icon: GitBranch,
          },
        ]
      : []),
    ...(type === "bundle"
      ? [
          {
            id: "bundle-components" as DataTabId,
            label: "Các thành phần của bộ sưu tập",
            icon: Package,
          },
        ]
      : []),
    ...(isEdit
      ? [
          {
            id: "stock-log" as DataTabId,
            label: "Lịch sử kho hàng",
            icon: History,
          },
        ]
      : []),
  ];

  return (
    <div className="text-base">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">
          {isEdit ? "Cập nhật Sản phẩm" : "Thêm mới Sản phẩm"}
        </h1>
      </div>

      {error && (
        <p className="text-sm text-destructive mb-4 p-3 bg-destructive/10 rounded-md">
          {error}
        </p>
      )}

      {successMsg && (
        <div className="mb-4 p-3 bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 rounded-md flex items-center gap-3 flex-wrap">
          <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400 shrink-0" />
          <span className="text-sm text-green-700 dark:text-green-300 font-medium">
            {successMsg}
          </span>
          <div className="ml-auto flex items-center gap-2 flex-wrap">
            {dropboxReturnPath !== null && (
              <Button
                size="sm"
                variant="default"
                onClick={() => {
                  sessionStorage.setItem(
                    "dropbox_initial_path",
                    dropboxReturnPath,
                  );
                  sessionStorage.removeItem("dropbox_parent_path");
                  router.push("/admin/products/dropbox");
                }}
              >
                <ExternalLink className="h-3 w-3 mr-1" />
                Quay lại Dropbox
              </Button>
            )}
            {!isEdit && createdProductId && (
              <>
                <Button size="sm" variant="outline" onClick={resetForm}>
                  <Plus className="h-3 w-3 mr-1" />
                  Thêm mới
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => router.push("/admin/products")}
                >
                  <ExternalLink className="h-3 w-3 mr-1" />
                  Xem danh sách
                </Button>
              </>
            )}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_460px] gap-6">
        <div className="space-y-6 min-w-0">
          <Card>
            <CardContent className="pt-6 space-y-3">
              <div className="space-y-2">
                <Label className="text-sm font-medium">Tên sản phẩm</Label>
                <Input
                  value={name}
                  onChange={(e) => handleNameChange(e.target.value)}
                  placeholder="Ví dụ: songoku SSJ2"
                  className="text-lg h-12"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-sm font-medium">URL (slug)</Label>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground whitespace-nowrap">
                    /p/
                  </span>
                  <Input
                    value={slug}
                    onChange={(e) => {
                      setSlug(e.target.value);
                      setSlugManual(true);
                    }}
                    placeholder="songoku-ssj2"
                  />
                </div>
                {isEdit && slug && (
                  <a
                    href={`/p/${encodeURIComponent(slug)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-primary hover:underline inline-flex items-center gap-1 mt-1"
                  >
                    <ExternalLink className="h-3 w-3" />
                    Xem sản phẩm: /p/{slug}
                  </a>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Mô tả chi tiết</CardTitle>
            </CardHeader>
            <CardContent>
              <RichTextEditor
                value={description}
                onChange={setDescription}
                placeholder="Mô tả chi tiết với định dạng. Có thể chèn hình ảnh."
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Thông tin chi tiết</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="flex border-t">
                <div className="w-[180px] shrink-0 border-r bg-muted/30">
                  {allDataTabs.map((tab) => {
                    const Icon = tab.icon;
                    const isActiveTab = activeDataTab === tab.id;
                    return (
                      <button
                        key={tab.id}
                        type="button"
                        onClick={() => setActiveDataTab(tab.id)}
                        className={`w-full flex items-center gap-2 px-4 py-3 text-sm font-medium text-left border-b transition-colors ${
                          isActiveTab
                            ? "bg-background text-foreground border-l-2 border-l-primary"
                            : "text-muted-foreground hover:bg-muted/50 border-l-2 border-l-transparent"
                        }`}
                      >
                        <Icon className="h-4 w-4 shrink-0" />
                        {tab.label}
                        {tab.id === "attributes" && aiPendingCount > 0 && (
                          <span className="ml-auto rounded-full bg-blue-500 text-white text-[10px] font-bold px-1.5 py-0.5 leading-none">
                            {aiPendingCount}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>

                <div className="flex-1 min-w-0">
                  <div
                    className={
                      activeDataTab === "inventory" ? "block" : "hidden"
                    }
                  >
                    <div className="p-6 space-y-6">
                      <div>
                        <h3 className="text-sm font-medium mb-3">
                          Giá và định danh
                        </h3>
                        {type === "variable" ? (
                          <p className="text-sm text-muted-foreground bg-muted/50 rounded-lg p-3 mb-4">
                            Sản phẩm có nhiều phiên bản — giá được xác định
                            trong mỗi phiên bản ở tab Phiên bản.
                          </p>
                        ) : type === "bundle" ? (
                          <p className="text-sm text-muted-foreground bg-muted/50 rounded-lg p-3 mb-4">
                            Bộ sưu tập — giá được tính tự động từ các thành
                            phần.
                          </p>
                        ) : (
                          <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <Label className="text-sm font-medium">
                                Giá gốc
                              </Label>
                              <Input
                                type="number"
                                step="0.01"
                                min="0.01"
                                value={basePrice}
                                onChange={(e) => setBasePrice(e.target.value)}
                                placeholder="100.000"
                              />
                            </div>
                            <div className="space-y-2">
                              <Label className="text-sm font-medium">
                                Giá khuyến mãi
                              </Label>
                              <Input
                                type="number"
                                step="0.01"
                                min="0.01"
                                value={salePrice}
                                onChange={(e) => setSalePrice(e.target.value)}
                                placeholder="80.000"
                              />
                            </div>
                          </div>
                        )}
                        <div className="grid grid-cols-2 gap-4 mt-4">
                          <div className="space-y-2">
                            <Label className="text-sm font-medium">SKU</Label>
                            <Input
                              value={sku}
                              onChange={(e) => {
                                setSku(e.target.value);
                                setSkuManual(!!e.target.value);
                              }}
                              placeholder={suggestedSku || "SONGOKU-SSJ2-001"}
                            />
                            {suggestedSku && !productId && (
                              <p className="text-xs text-muted-foreground">
                                Gợi ý:{" "}
                                <button
                                  type="button"
                                  className="font-mono underline hover:text-foreground"
                                  onClick={() => {
                                    setSku(suggestedSku);
                                    setSkuManual(false);
                                  }}
                                >
                                  {suggestedSku}
                                </button>
                              </p>
                            )}
                          </div>
                          <div className="space-y-2">
                            <Label className="text-sm font-medium">
                              GTIN / EAN
                            </Label>
                            <Input
                              value={gtin}
                              onChange={(e) => setGtin(e.target.value)}
                              placeholder="7890123456789"
                            />
                          </div>
                        </div>
                      </div>

                      <hr />

                      {type !== "variable" && (
                        <div>
                          <h3 className="text-sm font-medium mb-3">Kho</h3>
                          <div className="flex items-center gap-2 mb-3">
                            <Switch
                              checked={manageStock}
                              onCheckedChange={setManageStock}
                            />
                            <Label className="text-sm font-medium">
                              Quản lý tồn kho
                            </Label>
                          </div>
                          {manageStock && (
                            <div className="space-y-4">
                              <div className="space-y-2">
                                <Label className="text-sm font-medium">
                                  Số lượng tồn kho
                                </Label>
                                <Input
                                  type="number"
                                  min="0"
                                  value={stock}
                                  onChange={(e) => setStock(e.target.value)}
                                  className="max-w-[160px]"
                                />
                              </div>
                              <div className="space-y-2">
                                <Label className="text-sm font-medium">
                                  Ngưỡng tồn kho thấp
                                </Label>
                                <Input
                                  type="number"
                                  min="0"
                                  value={lowStockThreshold}
                                  onChange={(e) =>
                                    setLowStockThreshold(e.target.value)
                                  }
                                  className="max-w-[160px]"
                                  placeholder="Để trống để sử dụng giá trị toàn cục từ cài đặt."
                                />
                                <p className="text-xs text-muted-foreground">
                                  Để trống để sử dụng giá trị toàn cục từ cài
                                  đặt.
                                </p>
                              </div>
                              {productId && (
                                <>
                                  <div className="space-y-2">
                                    <Label className="text-sm font-medium">
                                      Ghi chú điều chỉnh (tùy chọn)
                                    </Label>
                                    <Input
                                      type="text"
                                      maxLength={500}
                                      value={stockAdjustmentNote}
                                      onChange={(e) =>
                                        setStockAdjustmentNote(e.target.value)
                                      }
                                      placeholder="Ví dụ: sản phẩm bị hư hỏng, lỗi trong quá trình đếm..."
                                    />
                                    <p className="text-xs text-muted-foreground">
                                      Được ghi lại trong lịch sử nếu kho hàng bị
                                      thay đổi trong lần chỉnh sửa này.
                                    </p>
                                  </div>
                                  <a
                                    href={`/admin/products/${productId}/historico-stock`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-block text-xs text-primary underline"
                                  >
                                    Xem lịch sử kho hàng →
                                  </a>
                                </>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                      {type === "variable" && (
                        <p className="text-sm text-muted-foreground">
                          Sản phẩm biến thể: quản lý tồn kho ở từng biến thể.
                        </p>
                      )}

                      <hr />

                      <div>
                        <h3 className="text-sm font-medium mb-3">
                          Cân nặng và Kích thước
                        </h3>
                        <div className="space-y-2 mb-4">
                          <Label className="text-sm font-medium">
                            Cân nặng (kg)
                          </Label>
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            value={weight}
                            onChange={(e) => setWeight(e.target.value)}
                            placeholder="0.10"
                            className="max-w-[160px]"
                          />
                        </div>
                        <div className="grid grid-cols-3 gap-4">
                          <div className="space-y-2">
                            <Label className="text-sm font-medium">
                              Chiều rộng (cm)
                            </Label>
                            <Input
                              type="number"
                              step="0.1"
                              min="0"
                              value={width}
                              onChange={(e) => setWidth(e.target.value)}
                              placeholder="5.0"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label className="text-sm font-medium">
                              Chiều cao (cm)
                            </Label>
                            <Input
                              type="number"
                              step="0.1"
                              min="0"
                              value={height}
                              onChange={(e) => setHeight(e.target.value)}
                              placeholder="8.0"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label className="text-sm font-medium">
                              Chiều dài (cm)
                            </Label>
                            <Input
                              type="number"
                              step="0.1"
                              min="0"
                              value={length}
                              onChange={(e) => setLength(e.target.value)}
                              placeholder="3.0"
                            />
                          </div>
                        </div>
                        <p className="text-xs text-muted-foreground mt-2">
                          Được sử dụng để tính phí vận chuyển.
                        </p>
                      </div>
                    </div>
                  </div>

                  <div
                    className={activeDataTab === "catalog" ? "block" : "hidden"}
                  >
                    <div className="p-6 space-y-6">
                      <p className="text-sm text-muted-foreground">
                        Thông tin cho Google Merchant Center và Meta Catalog.
                        Điền ở đây sẽ được sử dụng trong các nguồn cấp dữ liệu
                        tự động.
                      </p>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label className="text-sm font-medium">GTIN</Label>
                          <Input
                            value={gtin}
                            onChange={(e) => setGtin(e.target.value)}
                            placeholder="7890123456789"
                          />
                          <p className="text-xs text-muted-foreground">
                            Mã vạch EAN/UPC/ISBN
                          </p>
                        </div>
                        <div className="space-y-2">
                          <Label className="text-sm font-medium">MPN</Label>
                          <Input
                            value={mpn}
                            onChange={(e) => setMpn(e.target.value)}
                            placeholder="ABC-12345"
                          />
                          <p className="text-xs text-muted-foreground">
                            Mã của nhà sản xuất (Manufacturer Part Number)
                          </p>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label className="text-sm font-medium">
                          Tình trạng
                        </Label>
                        <select
                          value={condition}
                          onChange={(e) => setCondition(e.target.value)}
                          className="flex h-10 w-full max-w-[250px] rounded-md border bg-background px-3 py-2 text-sm"
                        >
                          <option value="new">Mới</option>
                          <option value="refurbished">Tái chế</option>
                          <option value="used">Đã qua sử dụng</option>
                        </select>
                      </div>

                      <div className="space-y-2">
                        <Label className="text-sm font-medium">Màu sắc</Label>
                        <select
                          value={colorId}
                          onChange={(e) => setColorId(e.target.value)}
                          className="flex h-10 w-full max-w-[300px] rounded-md border bg-background px-3 py-2 text-sm"
                        >
                          <option value="">
                            — kế thừa từ danh mục chính —
                          </option>
                          {(
                            colors as
                              | Array<{ id: string; name: string }>
                              | undefined
                          )?.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.name}
                            </option>
                          ))}
                        </select>
                        <p className="text-xs text-muted-foreground">
                          Để trống để kế thừa từ danh mục chính. Quản lý tập
                          trung tại{" "}
                          <a href="/admin/colors" className="underline">
                            /admin/colors
                          </a>
                          .
                        </p>
                      </div>

                      <div className="space-y-2">
                        <Label className="text-sm font-medium">Chất liệu</Label>
                        <select
                          value={materialId}
                          onChange={(e) => setMaterialId(e.target.value)}
                          className="flex h-10 w-full max-w-[300px] rounded-md border bg-background px-3 py-2 text-sm"
                        >
                          <option value="">
                            — kế thừa từ danh mục chính —
                          </option>
                          {(
                            materials as
                              | Array<{ id: string; name: string }>
                              | undefined
                          )?.map((m) => (
                            <option key={m.id} value={m.id}>
                              {m.name}
                            </option>
                          ))}
                        </select>
                        <p className="text-xs text-muted-foreground">
                          Quản lý tập trung tại{" "}
                          <a href="/admin/materials" className="underline">
                            /admin/materials
                          </a>
                          .
                        </p>
                      </div>

                      <div className="space-y-2">
                        <Label className="text-sm font-medium">
                          Danh mục của Google
                        </Label>
                        <GoogleCategoryPicker
                          value={googleCategoryId}
                          onChange={setGoogleCategoryId}
                        />
                        <p className="text-xs text-muted-foreground">
                          Danh mục chính thức của Google Merchant Center. Để
                          trống để kế thừa từ danh mục chính.
                        </p>
                      </div>

                      <hr />

                      <div>
                        <h3 className="text-sm font-medium mb-3">
                          Thời gian khuyến mãi
                        </h3>
                        <p className="text-xs text-muted-foreground mb-3">
                          Xác định thời điểm giá khuyến mãi xuất hiện trong các
                          nguồn cấp dữ liệu của Google/Meta.
                        </p>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label className="text-sm font-medium">
                              Bắt đầu
                            </Label>
                            <Input
                              type="date"
                              value={salePriceStartDate}
                              onChange={(e) =>
                                setSalePriceStartDate(e.target.value)
                              }
                            />
                          </div>
                          <div className="space-y-2">
                            <Label className="text-sm font-medium">
                              Kết thúc
                            </Label>
                            <Input
                              type="date"
                              value={salePriceEndDate}
                              onChange={(e) =>
                                setSalePriceEndDate(e.target.value)
                              }
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div
                    className={
                      activeDataTab === "delivery" ? "block" : "hidden"
                    }
                  >
                    <div className="p-6 space-y-4">
                      <p className="text-sm text-muted-foreground">
                        Ảnh in cần có thời gian để sản xuất. Thời gian này được
                        cộng thêm vào thời gian giao hàng của nhà vận chuyển. Ưu
                        tiên: sản phẩm {">"} tag {">"} danh mục.
                      </p>
                      <div className="space-y-2">
                        <Label className="text-sm font-medium">
                          Số ngày cần thiết để sản xuất
                        </Label>
                        <Input
                          type="number"
                          min="0"
                          value={extraDays}
                          onChange={(e) => setExtraDays(e.target.value)}
                          placeholder="Để trống để sử dụng tiêu chuẩn tag/danh mục"
                          className="max-w-[200px]"
                        />
                      </div>
                      <div className="bg-muted/50 rounded-lg p-4 text-sm">
                        <p className="font-medium mb-2">Cách hoạt động:</p>
                        <p>
                          {extraDays
                            ? `${extraDays} ngày để sản xuất`
                            : "Sử dụng tiêu chuẩn tag/danh mục"}{" "}
                          + thời gian vận chuyển (tính theo mã ZIP của khách
                          hàng)
                        </p>
                        <p className="text-xs text-muted-foreground mt-2">
                          Tổng thời gian giao hàng chỉ được tính khi thanh toán,
                          sau khi khách hàng cung cấp mã ZIP.
                        </p>
                      </div>
                    </div>
                  </div>

                  <div
                    className={
                      activeDataTab === "attributes" ? "block" : "hidden"
                    }
                  >
                    <div className="p-6 space-y-4">
                      <p className="text-sm text-muted-foreground">
                        Chọn các thuộc tính áp dụng cho sản phẩm này. Được sử
                        dụng để lọc trong cửa hàng.
                      </p>
                      <AttributeSelector
                        selectedValueIds={attributeValueIds}
                        onChange={setAttributeValueIds}
                        aiMatched={aiMatchedLocal}
                        aiUnmatched={aiUnmatchedLocal}
                        onPendingCountChange={setAiPendingCount}
                      />
                    </div>
                  </div>

                  <div className={activeDataTab === "seo" ? "block" : "hidden"}>
                    <div className="p-6 space-y-4">
                      <p className="text-sm text-muted-foreground">
                        Các trường SEO. Được điền tự động bởi AI khi có sẵn.
                      </p>
                      <div className="space-y-2">
                        <Label className="text-sm font-medium">
                          Tiêu đề SEO (tối đa 60 ký tự)
                        </Label>
                        <Input
                          value={metaTitle}
                          onChange={(e) => setMetaTitle(e.target.value)}
                          placeholder="Tiêu đề hiển thị trong tab trình duyệt và kết quả tìm kiếm"
                          maxLength={60}
                        />
                        <p className="text-xs text-muted-foreground">
                          {metaTitle.length}/60 ký tự
                        </p>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-sm font-medium">
                          Từ khóa SEO
                        </Label>
                        <Input
                          value={seoKeywords}
                          onChange={(e) => setSeoKeywords(e.target.value)}
                          placeholder="mô hình, tượng anime, tượng pvc, figure resin"
                        />
                        <p className="text-xs text-muted-foreground">
                          Tách bằng dấu phẩy. Dùng cho meta keywords và tham
                          khảo nội bộ.
                        </p>
                      </div>
                    </div>
                  </div>

                  <div
                    className={
                      activeDataTab === "variations" && type === "variable"
                        ? "block"
                        : "hidden"
                    }
                  >
                    <div className="p-6 space-y-4">
                      <p className="text-sm text-muted-foreground">
                        Mỗi biến thể có tỷ lệ, giá, SKU và kho riêng.
                      </p>
                      <VariationEditor
                        variations={variations}
                        onChange={setVariations}
                        parentSku={sku}
                        onMediaMetaSave={handleMediaMetaSave}
                      />
                    </div>
                  </div>

                  <div
                    className={
                      activeDataTab === "bundle-components" && type === "bundle"
                        ? "block"
                        : "hidden"
                    }
                  >
                    <div className="p-6 space-y-4">
                      <div className="space-y-2">
                        <Label className="text-sm font-medium">
                          Chiết khấu bộ sưu tập (%)
                        </Label>
                        <Input
                          type="number"
                          step="1"
                          min="0"
                          max="100"
                          value={bundleDiscount}
                          onChange={(e) => setBundleDiscount(e.target.value)}
                          placeholder="10"
                          className="max-w-[120px]"
                        />
                        <p className="text-xs text-muted-foreground">
                          Phần trăm chiết khấu áp dụng cho toàn bộ sản phẩm
                          trong bộ sưu tập.
                        </p>
                      </div>

                      <BundleComponentEditor
                        components={bundleComponents}
                        onChange={setBundleComponents}
                        discount={parseFloat(bundleDiscount) || 0}
                      />
                    </div>
                  </div>

                  <div
                    className={
                      activeDataTab === "stock-log" ? "block" : "hidden"
                    }
                  >
                    <div className="p-6">
                      {isEdit && <StockAuditLog productId={productId!} />}
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Mô tả sản phẩm</CardTitle>
            </CardHeader>
            <CardContent>
              <RichTextEditor
                value={shortDescription}
                onChange={setShortDescription}
                placeholder="Mô tả sản phẩm (không có hình ảnh). Được sử dụng làm meta description cho SEO."
                simple
              />
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6 lg:sticky lg:top-6 lg:self-start">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Hiển thị sản phẩm</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium">Trạng thái</Label>
                <div className="flex items-center gap-2">
                  <Switch checked={isActive} onCheckedChange={setIsActive} />
                  <span className="text-sm">
                    {isActive ? "Hoạt động" : "Không hoạt động"}
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium">Nổi bật</Label>
                <div className="flex items-center gap-2">
                  <Switch checked={featured} onCheckedChange={setFeatured} />
                  <span className="text-sm">{featured ? "Có" : "Không"}</span>
                </div>
              </div>

              <hr />

              <div className="space-y-2">
                <Label className="text-sm font-medium">Loại sản phẩm</Label>
                <div className="flex gap-3">
                  {["simple", "variable", "bundle"].map((t) => (
                    <label
                      key={t}
                      className={`flex items-center gap-2 border rounded-lg px-3 py-2 cursor-pointer text-sm ${type === t ? "border-primary bg-primary/5" : ""}`}
                    >
                      <input
                        type="radio"
                        name="type"
                        value={t}
                        checked={type === t}
                        onChange={() => setType(t)}
                        className="accent-primary"
                      />
                      {t === "simple"
                        ? "Đơn giản"
                        : t === "variable"
                          ? "Có nhiều phiên bản"
                          : "Bộ sưu tập"}
                    </label>
                  ))}
                </div>
                {type === "variable" && (
                  <p className="text-xs text-muted-foreground">
                    Cấu hình các biến thể trong Dữ liệu sản phẩm.
                  </p>
                )}
                {type === "bundle" && (
                  <p className="text-xs text-muted-foreground">
                    Giá được tính toán tự động từ các thành phần.
                  </p>
                )}
              </div>

              <hr />

              {isDraft && (
                <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-xs text-amber-400">
                  Sản phẩm này đang ở chế độ nháp và không hiển thị trên trang
                  web.
                </div>
              )}

              {aiPendingCount > 0 && (
                <div className="rounded-lg border border-blue-500/30 bg-blue-500/5 px-3 py-2 text-xs text-blue-400">
                  {aiPendingCount} thuộc tính AI đang chờ xem xét trong tab
                  Thuộc tính trước khi xuất bản.
                </div>
              )}

              {type === "variable" &&
                (() => {
                  const noVariations = variations.length === 0;
                  const missingPrice = variations.find(
                    (v) => !(Number(v.price) > 0),
                  );
                  if (!noVariations && !missingPrice) return null;
                  return (
                    <div className="rounded-lg border border-red-500/40 bg-red-500/5 px-3 py-2 text-xs text-red-400">
                      {noVariations
                        ? 'Thêm ít nhất 1 phiên bản trong "Dữ liệu sản phẩm → Phiên bản" trước khi xuất bản. Lưu dưới dạng nháp trong khi cấu hình.'
                        : `Phiên bản "${missingPrice?.name || "không có tên"}" không có giá. Tất cả các phiên bản cần có giá > 0 để xuất bản. Lưu dưới dạng nháp trong khi điều chỉnh.`}
                    </div>
                  );
                })()}

              <div className="flex gap-2">
                <Button
                  onClick={() => {
                    setIsDraft(false);
                    handleSubmit(false);
                  }}
                  disabled={
                    saving ||
                    !name ||
                    (type !== "variable" && type !== "bundle" && !basePrice) ||
                    (type === "variable" &&
                      (variations.length === 0 ||
                        variations.some((v) => !(Number(v.price) > 0)))) ||
                    aiPendingCount > 0
                  }
                  className="flex-1"
                >
                  <Save className="h-4 w-4 mr-2" />
                  {saving
                    ? "Đang lưu..."
                    : aiPendingCount > 0
                      ? "Xem lại thuộc tính"
                      : isEdit
                        ? "Lưu thay đổi"
                        : "Xuất bản"}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setIsDraft(true);
                    handleSubmit(true);
                  }}
                  disabled={saving || !name}
                  className="border-amber-500/30 text-amber-400 hover:bg-amber-500/10"
                >
                  Nháp
                </Button>
                {isEdit && (
                  <Button
                    variant="ghost"
                    className="text-destructive hover:text-destructive hover:bg-destructive/10"
                    onClick={() => setShowDeleteDialog(true)}
                    disabled={saving}
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Xóa sản phẩm
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Hình ảnh sản phẩm</CardTitle>
            </CardHeader>
            <CardContent>
              <ImageUpload
                images={productImages}
                onChange={setProductImages}
                onMediaMetaSave={handleMediaMetaSave}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Danh mục</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-xs text-muted-foreground">
                Chọn danh mục cho sản phẩm. Danh mục <strong>Chính</strong>{" "}
                (radio bên phải) xác định tính kế thừa của màu, vật liệu và phân
                loại của Google.
              </p>
              <div className="max-h-[280px] overflow-y-auto space-y-0.5 border rounded-md p-2">
                <CategoryTreePicker
                  categories={(categories as CategoryNode[] | undefined) ?? []}
                  selectedIds={categoryIds}
                  primaryId={primaryCategoryId}
                  onToggle={(id) => {
                    setCategoryIds((prev) => {
                      const next = prev.includes(id)
                        ? prev.filter((x) => x !== id)
                        : [...prev, id];

                      if (!next.includes(primaryCategoryId ?? "")) {
                        setPrimaryCategoryId(next[0] ?? null);
                      } else if (!primaryCategoryId && next.length === 1) {
                        setPrimaryCategoryId(next[0]);
                      }
                      return next;
                    });
                  }}
                  onPrimary={(id) => {
                    if (categoryIds.includes(id)) setPrimaryCategoryId(id);
                  }}
                />
              </div>
              {categoryIds.length > 0 && (
                <p className="text-xs text-muted-foreground">
                  {categoryIds.length} danh mục đã chọn
                  {primaryCategoryId && " · danh mục chính đã chọn"}
                </p>
              )}
              <div className="flex gap-2">
                <Input
                  placeholder="Danh mục mới"
                  value={newCatName}
                  onChange={(e) => setNewCatName(e.target.value)}
                  className="text-sm"
                />
                <Button
                  size="sm"
                  variant="outline"
                  disabled={!newCatName.trim()}
                  onClick={() => createCat.mutate(newCatName)}
                >
                  <Plus className="h-3 w-3 mr-1" />
                  Tạo
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Thương hiệu</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <select
                value={brandId}
                onChange={(e) => setBrandId(e.target.value)}
                className="flex h-10 w-full rounded-md border bg-background px-3 py-2 text-sm"
              >
                <option value="">Không có thương hiệu</option>
                {(brands as Array<{ id: string; name: string }>)?.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
              <div className="flex gap-2">
                <Input
                  placeholder="Thương hiệu mới"
                  value={newBrandName}
                  onChange={(e) => setNewBrandName(e.target.value)}
                  className="text-sm"
                />
                <Button
                  size="sm"
                  variant="outline"
                  disabled={!newBrandName.trim()}
                  onClick={() => createBrand.mutate(newBrandName)}
                >
                  <Plus className="h-3 w-3 mr-1" />
                  Tạo
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Tags</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {selectedTagIds.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {selectedTagIds.map((tagId) => {
                    const tag = (
                      tags as Array<{ id: string; name: string }>
                    )?.find((t) => t.id === tagId);
                    return tag ? (
                      <Badge
                        key={tagId}
                        variant="secondary"
                        className="gap-1 pr-1 cursor-pointer"
                        onClick={() =>
                          setSelectedTagIds((prev) =>
                            prev.filter((id) => id !== tagId),
                          )
                        }
                      >
                        {tag.name} ✕
                      </Badge>
                    ) : null;
                  })}
                </div>
              )}
              <select
                value=""
                onChange={(e) => {
                  if (
                    e.target.value &&
                    !selectedTagIds.includes(e.target.value)
                  ) {
                    setSelectedTagIds((prev) => [...prev, e.target.value]);
                  }
                }}
                className="flex h-10 w-full rounded-md border bg-background px-3 py-2 text-sm"
              >
                <option value="">Thêm tag...</option>
                {(tags as Array<{ id: string; name: string }>)
                  ?.filter((t) => !selectedTagIds.includes(t.id))
                  .map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
              </select>
              <div className="flex gap-2">
                <Input
                  placeholder="Thẻ mới"
                  value={newTagName}
                  onChange={(e) => setNewTagName(e.target.value)}
                  className="text-sm"
                />
                <Button
                  size="sm"
                  variant="outline"
                  disabled={!newTagName.trim()}
                  onClick={() => createTag.mutate(newTagName)}
                >
                  <Plus className="h-3 w-3 mr-1" />
                  Tạo
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Thang đo</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-2">
                <Label className="text-sm font-medium">Quy tắc thang đo</Label>
                <select
                  value={scaleRuleSetId}
                  onChange={(e) => setScaleRuleSetId(e.target.value)}
                  className="flex h-10 w-full rounded-md border bg-background px-3 py-2 text-sm"
                >
                  <option value="">Mặc định</option>
                  {(ruleSets as Array<{ id: string; name: string }>)?.map(
                    (rs) => (
                      <option key={rs.id} value={rs.id}>
                        {rs.name}
                      </option>
                    ),
                  )}
                </select>
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={noScales} onCheckedChange={setNoScales} />
                <Label className="text-sm font-medium">
                  Không áp dụng thang đo
                </Label>
              </div>
              {noScales && (
                <p className="text-xs text-muted-foreground">
                  Sản phẩm này sẽ không có tùy chọn thang đo trên cửa hàng.
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Xóa Sản phẩm</DialogTitle>
            <DialogDescription>
              Bạn có chắc chắn muốn xóa{" "}
              <strong>{name || "sản phẩm này"}</strong>? Hành động này là vĩnh
              viễn — sản phẩm, biến thể, hình ảnh, đánh giá và câu hỏi sẽ được
              xóa. Đơn hàng đã thực hiện sẽ giữ nguyên lịch sử (thông qua
              snapshot). Không thể hoàn tác.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setShowDeleteDialog(false)}
              disabled={deleting}
            >
              Hủy
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleting}
            >
              {deleting ? "Đang xóa..." : "Xóa sản phẩm"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
