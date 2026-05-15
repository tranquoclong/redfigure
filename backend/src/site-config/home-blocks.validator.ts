import { BadRequestException } from '@nestjs/common';
import { stripBidi } from '../common/utils/strip-bidi';
import {
  AnyHomeBlock,
  BLOCK_TYPES,
  BlockType,
  HomeBlock,
  HomeBlocksConfig,
  isBlockType,
  LIMITS,
  PromoCardTheme,
  TrustBadgeIcon,
} from './home-blocks.types';

interface FieldContext {
  path: string;
}

function bad(ctx: FieldContext, msg: string): never {
  throw new BadRequestException({
    statusCode: 400,
    message: `${ctx.path}: ${msg}`,
    fieldName: ctx.path,
  });
}

function requireString(
  ctx: FieldContext,
  raw: unknown,
  maxLen: number,
  field: string,
): string {
  const sub = { path: `${ctx.path}.${field}` };
  if (typeof raw !== 'string') bad(sub, 'must be a string');
  const trimmed = stripBidi((raw as string).trim());
  if (trimmed.length === 0) bad(sub, 'cannot be empty');
  if (trimmed.length > maxLen)
    bad(sub, `exceeds ${maxLen} characters (received ${trimmed.length})`);
  return trimmed;
}

function optionalString(
  ctx: FieldContext,
  raw: unknown,
  maxLen: number,
  field: string,
): string | undefined {
  if (raw === undefined || raw === null || raw === '') return undefined;
  return requireString(ctx, raw, maxLen, field);
}

function validateHrefScheme(value: string, ctx: FieldContext): void {
  if (value.startsWith('/') && !value.startsWith('//')) return;
  if (value.startsWith('//')) {
    bad(ctx, 'protocol-relative URL not allowed (use explicit https://)');
  }
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    bad(ctx, 'Invalid URL');
  }
  const allowed = ['http:', 'https:', 'mailto:', 'tel:'];
  if (!allowed.includes(parsed.protocol)) {
    bad(
      ctx,
      `protocol '${parsed.protocol}' not allowed (accepted: ${allowed.join(', ')} or relative path /...)`,
    );
  }
}

function requireHref(
  ctx: FieldContext,
  raw: unknown,
  maxLen: number,
  field: string,
): string {
  const value = requireString(ctx, raw, maxLen, field);
  validateHrefScheme(value, { path: `${ctx.path}.${field}` });
  return value;
}

function optionalHref(
  ctx: FieldContext,
  raw: unknown,
  maxLen: number,
  field: string,
): string | undefined {
  const value = optionalString(ctx, raw, maxLen, field);
  if (value === undefined) return undefined;
  validateHrefScheme(value, { path: `${ctx.path}.${field}` });
  return value;
}

function requireInt(
  ctx: FieldContext,
  raw: unknown,
  min: number,
  max: number,
  field: string,
): number {
  const sub = { path: `${ctx.path}.${field}` };
  if (typeof raw !== 'number' || !Number.isInteger(raw))
    bad(sub, 'must be an integer');
  if (raw < min || raw > max)
    bad(sub, `must be between ${min} and ${max} (received ${raw})`);
  return raw;
}

function optionalInt(
  ctx: FieldContext,
  raw: unknown,
  min: number,
  max: number,
  field: string,
): number | undefined {
  if (raw === undefined || raw === null) return undefined;
  return requireInt(ctx, raw, min, max, field);
}

function requireArray(
  ctx: FieldContext,
  raw: unknown,
  field: string,
): unknown[] {
  const sub = { path: `${ctx.path}.${field}` };
  if (!Array.isArray(raw)) bad(sub, 'must be an array');
  return raw as unknown[];
}

type DataValidator = (data: unknown, ctx: FieldContext) => unknown;

function validateHeroCarousel(data: unknown, ctx: FieldContext) {
  if (typeof data !== 'object' || data === null)
    bad(ctx, 'data must be an object');
  const d = data as Record<string, unknown>;
  return {
    autoplayMs: optionalInt(
      ctx,
      d.autoplayMs,
      LIMITS.autoplayMs.min,
      LIMITS.autoplayMs.max,
      'autoplayMs',
    ),
  };
}

function validateCategoriesStrip(data: unknown, ctx: FieldContext) {
  if (typeof data !== 'object' || data === null)
    bad(ctx, 'data must be an object');
  const d = data as Record<string, unknown>;
  return {
    eyebrow: requireString(ctx, d.eyebrow, LIMITS.shortText, 'eyebrow'),
    title: requireString(ctx, d.title, LIMITS.shortText, 'title'),
  };
}

function validateLatestProducts(data: unknown, ctx: FieldContext) {
  if (typeof data !== 'object' || data === null)
    bad(ctx, 'data must be an object');
  const d = data as Record<string, unknown>;
  return {
    eyebrow: requireString(ctx, d.eyebrow, LIMITS.shortText, 'eyebrow'),
    title: requireString(ctx, d.title, LIMITS.shortText, 'title'),
    limit: requireInt(
      ctx,
      d.limit,
      LIMITS.latestProducts.min,
      LIMITS.latestProducts.max,
      'limit',
    ),
  };
}

function validateFeaturedProducts(data: unknown, ctx: FieldContext) {
  if (typeof data !== 'object' || data === null)
    bad(ctx, 'data must be an object');
  const d = data as Record<string, unknown>;
  return {
    eyebrow: requireString(ctx, d.eyebrow, LIMITS.shortText, 'eyebrow'),
    title: requireString(ctx, d.title, LIMITS.shortText, 'title'),
    limit: requireInt(
      ctx,
      d.limit,
      LIMITS.featuredProducts.min,
      LIMITS.featuredProducts.max,
      'limit',
    ),
    ctaLabel: optionalString(ctx, d.ctaLabel, LIMITS.shortText, 'ctaLabel'),
    ctaHref: optionalHref(ctx, d.ctaHref, LIMITS.href, 'ctaHref'),
  };
}

function validatePromoCard(raw: unknown, ctx: FieldContext) {
  if (typeof raw !== 'object' || raw === null) bad(ctx, 'data must be an object');
  const d = raw as Record<string, unknown>;
  const themeRaw = d.theme;
  const theme: PromoCardTheme =
    themeRaw === 'magenta' || themeRaw === 'cyan'
      ? themeRaw
      : (bad(
        { path: `${ctx.path}.theme` },
        "must be 'magenta' or 'cyan'",
      ) as never);
  return {
    eyebrow: requireString(ctx, d.eyebrow, LIMITS.shortText, 'eyebrow'),
    title: requireString(ctx, d.title, LIMITS.shortText, 'title'),
    description: requireString(
      ctx,
      d.description,
      LIMITS.longText,
      'description',
    ),
    ctaLabel: optionalString(ctx, d.ctaLabel, LIMITS.shortText, 'ctaLabel'),
    ctaHref: optionalHref(ctx, d.ctaHref, LIMITS.href, 'ctaHref'),
    metaText: optionalString(ctx, d.metaText, LIMITS.shortText, 'metaText'),
    theme,
  };
}

function validatePromoBanner(data: unknown, ctx: FieldContext) {
  if (typeof data !== 'object' || data === null)
    bad(ctx, 'data must be an object');
  const d = data as Record<string, unknown>;
  const cards = requireArray(ctx, d.cards, 'cards');
  if (
    cards.length < LIMITS.promoCards.min ||
    cards.length > LIMITS.promoCards.max
  )
    bad(
      { path: `${ctx.path}.cards` },
      `must have between ${LIMITS.promoCards.min} and ${LIMITS.promoCards.max} cards`,
    );
  return {
    cards: cards.map((c, i) =>
      validatePromoCard(c, { path: `${ctx.path}.cards[${i}]` }),
    ),
  };
}

function validateStep(raw: unknown, ctx: FieldContext) {
  if (typeof raw !== 'object' || raw === null) bad(ctx, 'data must be an object');
  const d = raw as Record<string, unknown>;
  return {
    number: requireString(ctx, d.number, 8, 'number'),
    title: requireString(ctx, d.title, LIMITS.shortText, 'title'),
    description: requireString(
      ctx,
      d.description,
      LIMITS.longText,
      'description',
    ),
  };
}

function validateHowItWorks(data: unknown, ctx: FieldContext) {
  if (typeof data !== 'object' || data === null)
    bad(ctx, 'data must be an object');
  const d = data as Record<string, unknown>;
  const steps = requireArray(ctx, d.steps, 'steps');
  if (steps.length !== LIMITS.steps.count)
    bad(
      { path: `${ctx.path}.steps` },
      `must have exactly ${LIMITS.steps.count} steps`,
    );
  return {
    eyebrow: requireString(ctx, d.eyebrow, LIMITS.shortText, 'eyebrow'),
    title: requireString(ctx, d.title, LIMITS.shortText, 'title'),
    steps: steps.map((s, i) =>
      validateStep(s, { path: `${ctx.path}.steps[${i}]` }),
    ),
  };
}

function validateReviews(data: unknown, ctx: FieldContext) {
  if (typeof data !== 'object' || data === null)
    bad(ctx, 'data must be an object');
  const d = data as Record<string, unknown>;
  return {
    eyebrow: requireString(ctx, d.eyebrow, LIMITS.shortText, 'eyebrow'),
    title: requireString(ctx, d.title, LIMITS.shortText, 'title'),
    limit: requireInt(
      ctx,
      d.limit,
      LIMITS.reviews.min,
      LIMITS.reviews.max,
      'limit',
    ),
  };
}

function validateFaq(data: unknown, ctx: FieldContext) {
  if (typeof data !== 'object' || data === null)
    bad(ctx, 'data must be an object');
  const d = data as Record<string, unknown>;
  return {
    eyebrow: requireString(ctx, d.eyebrow, LIMITS.shortText, 'eyebrow'),
    title: requireString(ctx, d.title, LIMITS.shortText, 'title'),
    pageSlug: requireString(ctx, d.pageSlug, 100, 'pageSlug'),
    limit: optionalInt(
      ctx,
      d.limit,
      LIMITS.faqLimit.min,
      LIMITS.faqLimit.max,
      'limit',
    ),
  };
}

function validateCustomQuote(data: unknown, ctx: FieldContext) {
  if (typeof data !== 'object' || data === null)
    bad(ctx, 'data must be an object');
  const d = data as Record<string, unknown>;
  const steps = requireArray(ctx, d.steps, 'steps');
  if (steps.length !== LIMITS.steps.count)
    bad(
      { path: `${ctx.path}.steps` },
      `must have exactly ${LIMITS.steps.count} steps`,
    );
  return {
    eyebrow: requireString(ctx, d.eyebrow, LIMITS.shortText, 'eyebrow'),
    title: requireString(ctx, d.title, LIMITS.shortText, 'title'),
    description: requireString(
      ctx,
      d.description,
      LIMITS.longText,
      'description',
    ),
    ctaLabel: requireString(ctx, d.ctaLabel, LIMITS.shortText, 'ctaLabel'),
    ctaHref: requireHref(ctx, d.ctaHref, LIMITS.href, 'ctaHref'),
    steps: steps.map((s, i) =>
      validateStep(s, { path: `${ctx.path}.steps[${i}]` }),
    ),
  };
}

function validateNewsletter(data: unknown, ctx: FieldContext) {
  if (typeof data !== 'object' || data === null)
    bad(ctx, 'data must be an object');
  const d = data as Record<string, unknown>;
  return {
    eyebrow: requireString(ctx, d.eyebrow, LIMITS.shortText, 'eyebrow'),
    title: requireString(ctx, d.title, LIMITS.shortText, 'title'),
    description: requireString(
      ctx,
      d.description,
      LIMITS.longText,
      'description',
    ),
    ctaLabel: requireString(ctx, d.ctaLabel, LIMITS.shortText, 'ctaLabel'),
  };
}

const TRUST_ICONS: ReadonlyArray<TrustBadgeIcon> = [
  'shipping',
  'shield',
  'discount',
  'age',
];

function validateTrustBadge(raw: unknown, ctx: FieldContext) {
  if (typeof raw !== 'object' || raw === null) bad(ctx, 'data must be an object');
  const d = raw as Record<string, unknown>;
  const iconRaw = d.icon;
  if (
    typeof iconRaw !== 'string' ||
    !TRUST_ICONS.includes(iconRaw as TrustBadgeIcon)
  )
    bad(
      { path: `${ctx.path}.icon` },
      `must be one of: ${TRUST_ICONS.join(', ')}`,
    );
  return {
    icon: iconRaw as TrustBadgeIcon,
    title: requireString(ctx, d.title, LIMITS.shortText, 'title'),
    description: requireString(
      ctx,
      d.description,
      LIMITS.longText,
      'description',
    ),
  };
}

function validateTrustStrip(data: unknown, ctx: FieldContext) {
  if (typeof data !== 'object' || data === null)
    bad(ctx, 'data must be an object');
  const d = data as Record<string, unknown>;
  const badges = requireArray(ctx, d.badges, 'badges');
  if (
    badges.length < LIMITS.trustBadges.min ||
    badges.length > LIMITS.trustBadges.max
  )
    bad(
      { path: `${ctx.path}.badges` },
      `must have between ${LIMITS.trustBadges.min} and ${LIMITS.trustBadges.max} badges`,
    );
  return {
    badges: badges.map((b, i) =>
      validateTrustBadge(b, { path: `${ctx.path}.badges[${i}]` }),
    ),
  };
}

const VALIDATORS: ReadonlyMap<BlockType, DataValidator> = new Map<
  BlockType,
  DataValidator
>([
  ['hero-carousel', validateHeroCarousel],
  ['categories-strip', validateCategoriesStrip],
  ['latest-products', validateLatestProducts],
  ['featured-products', validateFeaturedProducts],
  ['promo-banner', validatePromoBanner],
  ['how-it-works', validateHowItWorks],
  ['reviews', validateReviews],
  ['faq', validateFaq],
  ['custom-quote', validateCustomQuote],
  ['newsletter', validateNewsletter],
  ['trust-strip', validateTrustStrip],
]);

interface RawBlock {
  id: unknown;
  type: unknown;
  order: unknown;
  isActive: unknown;
  data: unknown;
}

export function validateAndNormalizeBlocks(
  rawBlocks: RawBlock[],
): HomeBlocksConfig {
  if (!Array.isArray(rawBlocks))
    throw new BadRequestException({
      statusCode: 400,
      message: 'blocks: must be an array',
      fieldName: 'blocks',
    });
  if (rawBlocks.length === 0)
    throw new BadRequestException({
      statusCode: 400,
      message: 'blocks: at least 1 block is required',
      fieldName: 'blocks',
    });
  if (rawBlocks.length > LIMITS.maxBlocks)
    throw new BadRequestException({
      statusCode: 400,
      message: `blocks: maximum ${LIMITS.maxBlocks} blocks`,
      fieldName: 'blocks',
    });

  const seenIds = new Set<string>();
  const validated: AnyHomeBlock[] = [];

  const ordered = [...rawBlocks].sort((a, b) => {
    const ao = typeof a.order === 'number' ? a.order : 0;
    const bo = typeof b.order === 'number' ? b.order : 0;
    return ao - bo;
  });

  ordered.forEach((raw, index) => {
    const ctx: FieldContext = { path: `blocks[${index}]` };

    if (typeof raw.id !== 'string' || raw.id.trim().length === 0)
      bad({ path: `${ctx.path}.id` }, 'must be a non-empty string');
    const id = (raw.id as string).trim();
    if (seenIds.has(id))
      bad({ path: `${ctx.path}.id` }, `duplicate id '${id}'`);
    seenIds.add(id);

    if (!isBlockType(raw.type))
      bad(
        { path: `${ctx.path}.type` },
        `unknown type '${String(raw.type)}'. Accepted: ${BLOCK_TYPES.join(', ')}`,
      );
    const type = raw.type;

    if (typeof raw.isActive !== 'boolean')
      bad({ path: `${ctx.path}.isActive` }, 'must be boolean');

    const validator = VALIDATORS.get(type);
    if (!validator) bad({ path: `${ctx.path}.type` }, `unknown type '${type}'`);
    const validatedData = validator(raw.data, {
      path: `${ctx.path}.data`,
    });

    validated.push({
      id,
      type,
      order: index,
      isActive: raw.isActive,
      data: validatedData,
    } as AnyHomeBlock);
  });

  return { blocks: validated };
}

export function parseStoredBlocks(
  raw: unknown,
  options?: { onWarn?: (msg: string) => void },
): HomeBlocksConfig | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const obj = raw as Record<string, unknown>;
  const blocksRaw = obj.blocks;
  if (!Array.isArray(blocksRaw)) return null;

  const validated: AnyHomeBlock[] = [];
  const seen = new Set<string>();

  for (let i = 0; i < blocksRaw.length; i++) {
    const raw = blocksRaw[i] as RawBlock;
    try {
      if (typeof raw?.id !== 'string' || seen.has(raw.id)) continue;
      if (!isBlockType(raw.type)) {
        options?.onWarn?.(`block[${i}] unknown type: ${String(raw.type)}`);
        continue;
      }
      if (typeof raw.isActive !== 'boolean') continue;
      const validator = VALIDATORS.get(raw.type);
      if (!validator) {
        options?.onWarn?.(`block[${i}] validator ausente: ${String(raw.type)}`);
        continue;
      }
      const data = validator(raw.data, {
        path: `blocks[${i}].data`,
      });
      seen.add(raw.id);
      validated.push({
        id: raw.id,
        type: raw.type,
        order: typeof raw.order === 'number' ? raw.order : i,
        isActive: raw.isActive,
        data,
      } as AnyHomeBlock);
    } catch (err) {
      options?.onWarn?.(`block[${i}] invalid: ${(err as Error).message}`);
      continue;
    }
  }

  validated.sort((a, b) => a.order - b.order);
  validated.forEach((b, i) => {
    b.order = i;
  });

  return { blocks: validated };
}

export type { HomeBlock };
