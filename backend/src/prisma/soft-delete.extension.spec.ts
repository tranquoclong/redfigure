import { __testing } from './soft-delete.extension';

const { injectSoftDeleteFilter, injectNestedSoftDeleteFilter, RELATION_MAP } =
  __testing;

describe('softDeleteExtension - injectSoftDeleteFilter', () => {
  it('injects deletedAt: null when where is absent', () => {
    const result = injectSoftDeleteFilter({} as { where?: any });
    expect(result.where).toEqual({ deletedAt: null });
  });

  it('injects deletedAt: null when where exists without the field', () => {
    const result = injectSoftDeleteFilter({ where: { name: 'X' } });
    expect(result.where).toEqual({ name: 'X', deletedAt: null });
  });

  it('DOES NOT overwrite explicit deletedAt (null)', () => {
    const result = injectSoftDeleteFilter({ where: { deletedAt: null } });
    expect(result.where).toEqual({ deletedAt: null });
  });

  it('DOES NOT overwrite explicit deletedAt (not: null) — admin trash', () => {
    const result = injectSoftDeleteFilter({
      where: { deletedAt: { not: null } },
    });
    expect(result.where).toEqual({ deletedAt: { not: null } });
  });

  it('ALWAYS injects deletedAt: null when caller passes undefined (Gemini R4 #B)', () => {

    const result = injectSoftDeleteFilter({
      where: { deletedAt: undefined, name: 'X' },
    });
    expect(result.where).toEqual({ name: 'X', deletedAt: null });
  });

  it('respects opt-out via concrete Date (admin filtering by window)', () => {
    const cutoff = new Date('2026-01-01');
    const result = injectSoftDeleteFilter({
      where: { deletedAt: { gte: cutoff } },
    });
    expect(result.where).toEqual({ deletedAt: { gte: cutoff } });
  });

  it('preserves other args (orderBy, take, etc.) without changes', () => {
    const args = {
      where: { active: true },
      orderBy: { createdAt: 'desc' },
      take: 10,
      include: { brand: true },
    } as any;
    const result = injectSoftDeleteFilter(args);
    expect(result.orderBy).toEqual({ createdAt: 'desc' });
    expect(result.take).toBe(10);
    expect(result.include).toEqual({ brand: true });
    expect(result.where).toEqual({ active: true, deletedAt: null });
  });

  it('DOES NOT mutate the original args (immutable)', () => {
    const args: any = { where: { name: 'X' } };
    const result = injectSoftDeleteFilter(args);
    expect(args.where).toEqual({ name: 'X' });
    expect(result.where).toEqual({ name: 'X', deletedAt: null });
    expect(result).not.toBe(args);
  });

  it('accepts complex where with OR/AND', () => {
    const result = injectSoftDeleteFilter({
      where: {
        OR: [{ name: 'A' }, { name: 'B' }],
      },
    });
    expect(result.where).toEqual({
      OR: [{ name: 'A' }, { name: 'B' }],
      deletedAt: null,
    });
  });
});

describe('softDeleteExtension - RELATION_MAP (DMMF-derived, to-many SD only)', () => {
  it('detects Product → variations (to-many SD)', () => {
    const productRelations = RELATION_MAP.get('Product');
    expect(productRelations).toBeDefined();
    expect(productRelations).toContainEqual({
      field: 'variations',
      target: 'productVariation',
    });
  });

  it('DOES NOT include to-one SD (Prisma rejects where in to-one include)', () => {

    expect(RELATION_MAP.get('ProductAttribute')).toBeUndefined();
    const bundleRels = RELATION_MAP.get('BundleComponent');
    expect(
      bundleRels?.find((r) => r.field === 'childVariation'),
    ).toBeUndefined();
  });

  it('DOES NOT include models without to-many soft-delete relations (e.g., Brand)', () => {

    expect(RELATION_MAP.get('Brand')).toBeUndefined();
  });
});

describe('softDeleteExtension - injectNestedSoftDeleteFilter', () => {
  it('expands shortcut `field: true` to { where: { deletedAt: null } } for to-many SD', () => {
    const result = injectNestedSoftDeleteFilter(
      { include: { variations: true } },
      'Product',
    );

    expect(result.include).toEqual({
      variations: { where: { deletedAt: null } },
    });
  });

  it('DOES NOT inject where in to-one SD (Prisma rejects `Unknown argument where`)', () => {

    const result = injectNestedSoftDeleteFilter(
      { include: { attributeValue: true } },
      'ProductAttribute',
    );
    expect(result.include).toEqual({ attributeValue: true });
  });

  it('DOES NOT modify nested object in to-one SD (preserves without inject)', () => {
    const result = injectNestedSoftDeleteFilter(
      { include: { attributeValue: { include: { attribute: true } } } },
      'ProductAttribute',
    );

    expect(result.include).toEqual({
      attributeValue: { include: { attribute: true } },
    });

    expect((result.include as any).attributeValue.where).toBeUndefined();
    expect((result.include as any).attributeValue.include.attribute).toBe(true);
  });

  it('merges with existing where of the nested include', () => {
    const result = injectNestedSoftDeleteFilter(
      {
        include: {
          variations: { where: { stock: { gt: 0 } } },
        },
      },
      'Product',
    );
    expect(result.include).toEqual({
      variations: { where: { stock: { gt: 0 }, deletedAt: null } },
    });
  });

  it('respects explicit opt-out in the nested ({ deletedAt: { not: null } })', () => {
    const result = injectNestedSoftDeleteFilter(
      {
        include: {
          variations: { where: { deletedAt: { not: null } } },
        },
      },
      'Product',
    );
    expect(result.include).toEqual({
      variations: { where: { deletedAt: { not: null } } },
    });
  });

  it('DOES NOT inject where in childVariation (BundleComponent → to-one SD)', () => {

    const result = injectNestedSoftDeleteFilter(
      {
        include: {
          bundleComponents: {
            include: { childVariation: true },
          },
        },
      },
      'Product',
    );
    expect(result.include).toEqual({
      bundleComponents: {
        include: { childVariation: true },
      },
    });
  });

  it('DOES NOT mutate input', () => {
    const args = { include: { variations: true } };
    const result = injectNestedSoftDeleteFilter(args, 'Product');
    expect(args.include.variations).toBe(true);
    expect(result).not.toBe(args);
  });

  it('accepts select in addition to include', () => {
    const result = injectNestedSoftDeleteFilter(
      {
        select: {
          name: true,
          variations: { select: { id: true } },
        },
      },
      'Product',
    );
    expect((result.select as any).variations).toEqual({
      where: { deletedAt: null },
      select: { id: true },
    });
  });

  it('pass-through when model has no soft-delete relation', () => {
    const args = { include: { name: true } };
    const result = injectNestedSoftDeleteFilter(args, 'Brand');
    expect(result).toEqual(args);
  });

  it('pass-through when args has no include/select', () => {
    const args = { where: { id: '1' } };
    const result = injectNestedSoftDeleteFilter(args, 'Product');
    expect(result).toEqual(args);
  });

  it('pass-through when include relation is not soft-delete (e.g. brand)', () => {
    const args = { include: { brand: true } };
    const result = injectNestedSoftDeleteFilter(args, 'Product');

    expect(result.include).toEqual({ brand: true });
  });

  it('depth cap THROW (fail-closed) above MAX_RECURSION_DEPTH', () => {

    let nested: any = true;
    for (let i = 0; i < 20; i++) {
      nested = {
        include: { bundleComponents: { include: { childProduct: nested } } },
      };
    }
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    expect(() => injectNestedSoftDeleteFilter(nested, 'Product')).toThrow(
      /Query depth .* exceeded/,
    );
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('recursion depth'),
    );
    warnSpy.mockRestore();
  });
});
