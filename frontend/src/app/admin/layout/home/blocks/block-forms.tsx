"use client";

import { Plus, Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type {
  AnyHomeBlock,
  CustomQuoteData,
  CustomQuoteStep,
  FaqData,
  FeaturedProductsData,
  HeroCarouselData,
  HomeBlock,
  HowItWorksData,
  HowItWorksStep,
  LatestProductsData,
  NewsletterData,
  PromoBannerData,
  PromoCard,
  PromoCardTheme,
  ReviewsData,
  TrustBadge,
  TrustBadgeIcon,
  TrustStripData,
  CategoriesStripData,
} from "@/lib/home-blocks";

interface FormProps<T extends AnyHomeBlock> {
  block: T;
  onChange: (data: Partial<T["data"]>) => void;
}

function HeroCarouselForm({
  block,
  onChange,
}: FormProps<HomeBlock<"hero-carousel">>) {
  const data: HeroCarouselData = block.data;
  return (
    <div className="space-y-4">
      <p className="rounded-md border border-cyan/30 bg-cyan/[0.04] p-3 text-xs text-cyan">
        Slide carousel được quản lý tại <strong>/admin/layout/banners</strong>.
        Ở đây chỉ cấu hình autoplay.
      </p>
      <div>
        <Label htmlFor="autoplayMs">Autoplay (ms)</Label>
        <Input
          id="autoplayMs"
          type="number"
          min={3000}
          max={30000}
          step={500}
          value={data.autoplayMs ?? 6000}
          onChange={(e) =>
            onChange({ autoplayMs: parseInt(e.target.value, 10) || 6000 })
          }
        />
        <p className="mt-1 text-[11px] text-white/50">
          Thời gian chuyển slide. Tối thiểu 3000, tối đa 30000.
        </p>
      </div>
    </div>
  );
}

function CategoriesStripForm({
  block,
  onChange,
}: FormProps<HomeBlock<"categories-strip">>) {
  const data: CategoriesStripData = block.data;
  return (
    <div className="space-y-4">
      <EyebrowTitle data={data} onChange={onChange} />
      <p className="rounded-md border border-cyan/30 bg-cyan/[0.04] p-3 text-xs text-cyan">
        Danh mục nổi bật được quản lý tại khối &ldquo;Danh mục nổi bật&rdquo; ở
        trên trang này.
      </p>
    </div>
  );
}

function LatestProductsForm({
  block,
  onChange,
}: FormProps<HomeBlock<"latest-products">>) {
  const data: LatestProductsData = block.data;
  return (
    <div className="space-y-4">
      <EyebrowTitle data={data} onChange={onChange} />
      <NumberField
        label="Số lượng sản phẩm"
        hint="Tối thiểu 1, tối đa 12. Mặc định 4."
        value={data.limit}
        min={1}
        max={12}
        onChange={(limit) => onChange({ limit })}
      />
    </div>
  );
}

function FeaturedProductsForm({
  block,
  onChange,
}: FormProps<HomeBlock<"featured-products">>) {
  const data: FeaturedProductsData = block.data;
  return (
    <div className="space-y-4">
      <EyebrowTitle data={data} onChange={onChange} />
      <NumberField
        label="Số lượng sản phẩm"
        hint="Tối thiểu 1, tối đa 16. Mặc định 8."
        value={data.limit}
        min={1}
        max={16}
        onChange={(limit) => onChange({ limit })}
      />
      <div>
        <Label htmlFor="ctaLabel">Nội dung nút CTA (tùy chọn)</Label>
        <Input
          id="ctaLabel"
          value={data.ctaLabel ?? ""}
          onChange={(e) => onChange({ ctaLabel: e.target.value })}
          placeholder="Xem tất cả →"
        />
      </div>
      <div>
        <Label htmlFor="ctaHref">Liên kết nút CTA (tùy chọn)</Label>
        <Input
          id="ctaHref"
          value={data.ctaHref ?? ""}
          onChange={(e) => onChange({ ctaHref: e.target.value })}
          placeholder="/products?destaque=1"
        />
        <p className="mt-1 text-[11px] text-white/50">
          Chỉ sử dụng paths /relativos hoặc https://. Không sử dụng javascript:
          hoặc data:.
        </p>
      </div>
    </div>
  );
}

function PromoBannerForm({
  block,
  onChange,
}: FormProps<HomeBlock<"promo-banner">>) {
  const data: PromoBannerData = block.data;

  function updateCard(idx: number, patch: Partial<PromoCard>) {
    const next = data.cards.map((c, i) => (i === idx ? { ...c, ...patch } : c));
    onChange({ cards: next });
  }

  function addCard() {
    if (data.cards.length >= 2) return;
    onChange({
      cards: [
        ...data.cards,
        {
          eyebrow: "// VẬN CHUYỂN",
          title: "Nhập mã ZIP của bạn",
          description: "Tính toán cước vận chuyển theo ZIP.",
          theme: "cyan",
        },
      ],
    });
  }

  function removeCard(idx: number) {
    onChange({ cards: data.cards.filter((_, i) => i !== idx) });
  }

  return (
    <div className="space-y-4">
      {data.cards.map((card, idx) => (
        <div
          key={idx}
          className="space-y-3 rounded-lg border border-white/10 bg-black/20 p-4"
        >
          <div className="flex items-center justify-between">
            <span className="font-display text-xs uppercase tracking-wider text-cyan">
              Card {idx + 1}
            </span>
            {data.cards.length > 1 && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => removeCard(idx)}
              >
                <Trash2 className="size-3.5" /> Xóa
              </Button>
            )}
          </div>
          <div>
            <Label>Chủ đề</Label>
            <Select
              value={card.theme}
              onValueChange={(v) =>
                updateCard(idx, { theme: v as PromoCardTheme })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="magenta">Magenta (QR)</SelectItem>
                <SelectItem value="cyan">Cyan (Vận chuyển)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Tiêu đề phụ</Label>
            <Input
              value={card.eyebrow}
              onChange={(e) => updateCard(idx, { eyebrow: e.target.value })}
              placeholder="// QR -10%"
            />
          </div>
          <div>
            <Label>Tiêu đề chính</Label>
            <Input
              value={card.title}
              onChange={(e) => updateCard(idx, { title: e.target.value })}
              placeholder="QR −10%"
            />
          </div>
          <div>
            <Label>Mô tả</Label>
            <Textarea
              value={card.description}
              onChange={(e) => updateCard(idx, { description: e.target.value })}
              rows={2}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Nút CTA (văn bản)</Label>
              <Input
                value={card.ctaLabel ?? ""}
                onChange={(e) => updateCard(idx, { ctaLabel: e.target.value })}
              />
            </div>
            <div>
              <Label>Nút CTA (liên kết)</Label>
              <Input
                value={card.ctaHref ?? ""}
                onChange={(e) => updateCard(idx, { ctaHref: e.target.value })}
                placeholder="/products"
              />
            </div>
          </div>
          <div>
            <Label>Meta văn bản</Label>
            <Input
              value={card.metaText ?? ""}
              onChange={(e) => updateCard(idx, { metaText: e.target.value })}
              placeholder="+ VÍ ĐIỆN TỬ -5%"
            />
          </div>
        </div>
      ))}
      {data.cards.length < 2 && (
        <Button type="button" variant="outline" size="sm" onClick={addCard}>
          <Plus className="size-3.5" /> Thêm card
        </Button>
      )}
    </div>
  );
}

function HowItWorksForm({
  block,
  onChange,
}: FormProps<HomeBlock<"how-it-works">>) {
  const data: HowItWorksData = block.data;
  return (
    <div className="space-y-4">
      <EyebrowTitle data={data} onChange={onChange} />
      <StepsEditor
        steps={data.steps}
        onChange={(steps) => onChange({ steps })}
      />
    </div>
  );
}

function CustomQuoteForm({
  block,
  onChange,
}: FormProps<HomeBlock<"custom-quote">>) {
  const data: CustomQuoteData = block.data;
  return (
    <div className="space-y-4">
      <EyebrowTitle data={data} onChange={onChange} />
      <div>
        <Label>Mô tả</Label>
        <Textarea
          value={data.description}
          onChange={(e) => onChange({ description: e.target.value })}
          rows={3}
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Nút CTA (văn bản)</Label>
          <Input
            value={data.ctaLabel}
            onChange={(e) => onChange({ ctaLabel: e.target.value })}
          />
        </div>
        <div>
          <Label>Nút CTA (liên kết)</Label>
          <Input
            value={data.ctaHref}
            onChange={(e) => onChange({ ctaHref: e.target.value })}
            placeholder="/quote"
          />
        </div>
      </div>
      <StepsEditor
        steps={data.steps}
        onChange={(steps) => onChange({ steps: steps as CustomQuoteStep[] })}
      />
    </div>
  );
}

function ReviewsForm({ block, onChange }: FormProps<HomeBlock<"reviews">>) {
  const data: ReviewsData = block.data;
  return (
    <div className="space-y-4">
      <EyebrowTitle data={data} onChange={onChange} />
      <NumberField
        label="Số lượng đánh giá"
        hint="Min 1, max 12. Default 3. Đánh dấu đánh giá trong /admin/reviews."
        value={data.limit}
        min={1}
        max={12}
        onChange={(limit) => onChange({ limit })}
      />
    </div>
  );
}

function FaqForm({ block, onChange }: FormProps<HomeBlock<"faq">>) {
  const data: FaqData = block.data;
  return (
    <div className="space-y-4">
      <EyebrowTitle data={data} onChange={onChange} />
      <div>
        <Label>Slug của trang FAQ</Label>
        <Input
          value={data.pageSlug}
          onChange={(e) => onChange({ pageSlug: e.target.value })}
          placeholder="faq"
        />
        <p className="mt-1 text-[11px] text-white/50">
          Các mục đến từ /admin/pages/{data.pageSlug || "faq"} (trường
          faqItems).
        </p>
      </div>
      <NumberField
        label="Số lượng hiển thị"
        hint="Min 1, max 50. Default 6."
        value={data.limit ?? 6}
        min={1}
        max={50}
        onChange={(limit) => onChange({ limit })}
      />
    </div>
  );
}

function NewsletterForm({
  block,
  onChange,
}: FormProps<HomeBlock<"newsletter">>) {
  const data: NewsletterData = block.data;
  return (
    <div className="space-y-4">
      <EyebrowTitle data={data} onChange={onChange} />
      <div>
        <Label>Mô tả</Label>
        <Textarea
          value={data.description}
          onChange={(e) => onChange({ description: e.target.value })}
          rows={2}
        />
      </div>
      <div>
        <Label>Nút CTA (văn bản)</Label>
        <Input
          value={data.ctaLabel}
          onChange={(e) => onChange({ ctaLabel: e.target.value })}
          placeholder="Đăng ký nhận tin"
        />
      </div>
    </div>
  );
}

const TRUST_ICON_OPTIONS: Array<{ value: TrustBadgeIcon; label: string }> = [
  { value: "shipping", label: "Giao hàng (xe tải)" },
  { value: "shield", label: "Bảo hành (lá chắn)" },
  { value: "discount", label: "Giảm giá (tag)" },
  { value: "age", label: "Danh tính (khóa)" },
];

function TrustStripForm({
  block,
  onChange,
}: FormProps<HomeBlock<"trust-strip">>) {
  const data: TrustStripData = block.data;

  function updateBadge(idx: number, patch: Partial<TrustBadge>) {
    onChange({
      badges: data.badges.map((b, i) => (i === idx ? { ...b, ...patch } : b)),
    });
  }
  function addBadge() {
    if (data.badges.length >= 6) return;
    onChange({
      badges: [
        ...data.badges,
        { icon: "shipping", title: "Badge mới", description: "Mô tả." },
      ],
    });
  }
  function removeBadge(idx: number) {
    onChange({ badges: data.badges.filter((_, i) => i !== idx) });
  }

  return (
    <div className="space-y-4">
      {data.badges.map((badge, idx) => (
        <div
          key={idx}
          className="space-y-3 rounded-lg border border-white/10 bg-black/20 p-4"
        >
          <div className="flex items-center justify-between">
            <span className="font-display text-xs uppercase tracking-wider text-cyan">
              Badge {idx + 1}
            </span>
            {data.badges.length > 1 && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => removeBadge(idx)}
              >
                <Trash2 className="size-3.5" /> Xóa
              </Button>
            )}
          </div>
          <div>
            <Label>Icon</Label>
            <Select
              value={badge.icon}
              onValueChange={(v) =>
                updateBadge(idx, { icon: v as TrustBadgeIcon })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TRUST_ICON_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Title</Label>
            <Input
              value={badge.title}
              onChange={(e) => updateBadge(idx, { title: e.target.value })}
            />
          </div>
          <div>
            <Label>Description</Label>
            <Textarea
              value={badge.description}
              onChange={(e) =>
                updateBadge(idx, { description: e.target.value })
              }
              rows={2}
            />
          </div>
        </div>
      ))}
      {data.badges.length < 6 && (
        <Button type="button" variant="outline" size="sm" onClick={addBadge}>
          <Plus className="size-3.5" /> Thêm badge
        </Button>
      )}
    </div>
  );
}

function EyebrowTitle<D extends { eyebrow: string; title: string }>({
  data,
  onChange,
}: {
  data: D;
  onChange: (patch: Partial<D>) => void;
}) {
  return (
    <>
      <div>
        <Label>Eyebrow</Label>
        <Input
          value={data.eyebrow}
          onChange={(e) => onChange({ eyebrow: e.target.value } as Partial<D>)}
          placeholder="// 02 · Drops da Semana"
        />
        <p className="mt-1 text-[11px] text-white/50">
          Theo quy ước bắt đầu bằng{" "}
          <code className="font-mono">{"// XX · Label"}</code>.
        </p>
      </div>
      <div>
        <Label>Title</Label>
        <Input
          value={data.title}
          onChange={(e) => onChange({ title: e.target.value } as Partial<D>)}
          placeholder="Tiêu đề"
        />
      </div>
    </>
  );
}

function NumberField({
  label,
  hint,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  hint?: string;
  value: number;
  min: number;
  max: number;
  onChange: (n: number) => void;
}) {
  return (
    <div>
      <Label>{label}</Label>
      <Input
        type="number"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(parseInt(e.target.value, 10) || min)}
      />
      {hint && <p className="mt-1 text-[11px] text-white/50">{hint}</p>}
    </div>
  );
}

function StepsEditor({
  steps,
  onChange,
}: {
  steps: HowItWorksStep[] | CustomQuoteStep[];
  onChange: (steps: HowItWorksStep[]) => void;
}) {
  function update(idx: number, patch: Partial<HowItWorksStep>) {
    onChange(steps.map((s, i) => (i === idx ? { ...s, ...patch } : s)));
  }
  return (
    <div className="space-y-3">
      <Label>Các bước (cần 4 bước)</Label>
      {steps.map((step, idx) => (
        <div
          key={idx}
          className="grid grid-cols-[80px_1fr] gap-2 rounded-md border border-white/10 bg-black/20 p-3"
        >
          <Input
            value={step.number}
            onChange={(e) => update(idx, { number: e.target.value })}
            className="text-center font-mono"
          />
          <div className="space-y-2">
            <Input
              value={step.title}
              onChange={(e) => update(idx, { title: e.target.value })}
              placeholder="Tiêu đề"
            />
            <Input
              value={step.description}
              onChange={(e) => update(idx, { description: e.target.value })}
              placeholder="Mô tả"
            />
          </div>
        </div>
      ))}
      <p className="text-[11px] text-white/50">Cần chính xác 4 bước.</p>
    </div>
  );
}

export function BlockForm({
  block,
  onChange,
}: {
  block: AnyHomeBlock;
  onChange: (data: Partial<AnyHomeBlock["data"]>) => void;
}) {
  switch (block.type) {
    case "hero-carousel":
      return (
        <HeroCarouselForm
          block={block}
          onChange={
            onChange as FormProps<HomeBlock<"hero-carousel">>["onChange"]
          }
        />
      );
    case "categories-strip":
      return (
        <CategoriesStripForm
          block={block}
          onChange={
            onChange as FormProps<HomeBlock<"categories-strip">>["onChange"]
          }
        />
      );
    case "latest-products":
      return (
        <LatestProductsForm
          block={block}
          onChange={
            onChange as FormProps<HomeBlock<"latest-products">>["onChange"]
          }
        />
      );
    case "featured-products":
      return (
        <FeaturedProductsForm
          block={block}
          onChange={
            onChange as FormProps<HomeBlock<"featured-products">>["onChange"]
          }
        />
      );
    case "promo-banner":
      return (
        <PromoBannerForm
          block={block}
          onChange={
            onChange as FormProps<HomeBlock<"promo-banner">>["onChange"]
          }
        />
      );
    case "how-it-works":
      return (
        <HowItWorksForm
          block={block}
          onChange={
            onChange as FormProps<HomeBlock<"how-it-works">>["onChange"]
          }
        />
      );
    case "custom-quote":
      return (
        <CustomQuoteForm
          block={block}
          onChange={
            onChange as FormProps<HomeBlock<"custom-quote">>["onChange"]
          }
        />
      );
    case "reviews":
      return (
        <ReviewsForm
          block={block}
          onChange={onChange as FormProps<HomeBlock<"reviews">>["onChange"]}
        />
      );
    case "faq":
      return (
        <FaqForm
          block={block}
          onChange={onChange as FormProps<HomeBlock<"faq">>["onChange"]}
        />
      );
    case "newsletter":
      return (
        <NewsletterForm
          block={block}
          onChange={onChange as FormProps<HomeBlock<"newsletter">>["onChange"]}
        />
      );
    case "trust-strip":
      return (
        <TrustStripForm
          block={block}
          onChange={onChange as FormProps<HomeBlock<"trust-strip">>["onChange"]}
        />
      );
  }
}
