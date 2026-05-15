import { MerchantFieldsService } from './merchant-fields.service';

const COLOR_RED = { id: 'col-red', name: 'Red', slug: 'red' };
const COLOR_BLUE = { id: 'col-blue', name: 'Blue', slug: 'blue' };
const MATERIAL_RESIN = { id: 'mat-resin', name: 'Resin', slug: 'resin' };
const MATERIAL_PLA = { id: 'mat-pla', name: 'PLA', slug: 'pla' };
const GC_TOYS = {
  id: '1253',
  name: 'Action figures',
  path: 'Toys > Dolls > Action figures',
};
const GC_FIGURES = {
  id: '6058',
  name: 'Character dolls',
  path: 'Toys > Dolls > Character dolls',
};

function makeCategory(overrides: any = {}): any {
  return {
    id: overrides.id ?? 'cat',
    name: overrides.name ?? 'Cat',
    slug: overrides.slug ?? 'cat',
    parentId: overrides.parentId ?? null,
    parent: overrides.parent ?? null,
    colorId: overrides.color ? overrides.color.id : null,
    color: overrides.color ?? null,
    materialId: overrides.material ? overrides.material.id : null,
    material: overrides.material ?? null,
    googleCategoryId: overrides.googleCategory
      ? overrides.googleCategory.id
      : null,
    googleCategory: overrides.googleCategory ?? null,
  };
}

function makeProduct(opts: {
  color?: any;
  material?: any;
  googleCategory?: any;
  primaryCategory?: any | null;
  otherCategories?: any[];
}): any {
  const productCategories: any[] = [];
  if (opts.primaryCategory) {
    productCategories.push({
      isPrimary: true,
      category: opts.primaryCategory,
    });
  }
  for (const cat of opts.otherCategories ?? []) {
    productCategories.push({ isPrimary: false, category: cat });
  }
  return {
    id: 'prod1',
    color: opts.color ?? null,
    material: opts.material ?? null,
    googleCategory: opts.googleCategory ?? null,
    productCategories,
  };
}

describe('MerchantFieldsService.resolve', () => {
  let service: MerchantFieldsService;

  beforeEach(() => {
    service = new MerchantFieldsService();
  });

  it('returns the product values when set on the product', () => {
    const product = makeProduct({
      color: COLOR_RED,
      material: MATERIAL_RESIN,
      googleCategory: GC_TOYS,
      primaryCategory: makeCategory({ color: COLOR_BLUE }),
    });

    const resolved = service.resolve(product);

    expect(resolved.color).toEqual(COLOR_RED);
    expect(resolved.material).toEqual(MATERIAL_RESIN);
    expect(resolved.googleCategory).toEqual(GC_TOYS);
  });

  it('falls back to the primary category when product value is null', () => {
    const product = makeProduct({
      primaryCategory: makeCategory({
        color: COLOR_RED,
        material: MATERIAL_RESIN,
        googleCategory: GC_TOYS,
      }),
    });

    const resolved = service.resolve(product);

    expect(resolved.color).toEqual(COLOR_RED);
    expect(resolved.material).toEqual(MATERIAL_RESIN);
    expect(resolved.googleCategory).toEqual(GC_TOYS);
  });

  it('walks up the category ancestor chain when the primary has no value', () => {
    const grandparent = makeCategory({ id: 'grandparent', color: COLOR_RED });
    const parent = makeCategory({
      id: 'parent',
      parentId: 'grandparent',
      parent: grandparent,
    });
    const primary = makeCategory({
      id: 'leaf',
      parentId: 'parent',
      parent,
    });

    const product = makeProduct({ primaryCategory: primary });
    const resolved = service.resolve(product);

    expect(resolved.color).toEqual(COLOR_RED);
  });

  it('child category wins over the ancestor', () => {
    const grandparent = makeCategory({ id: 'grandparent', color: COLOR_BLUE });
    const parent = makeCategory({
      id: 'parent',
      parentId: 'grandparent',
      parent: grandparent,
      color: COLOR_RED,
    });
    const primary = makeCategory({
      id: 'leaf',
      parentId: 'parent',
      parent,
    });

    const product = makeProduct({ primaryCategory: primary });
    expect(service.resolve(product).color).toEqual(COLOR_RED);
  });

  it('resolves the three fields independently', () => {

    const grandparent = makeCategory({
      id: 'grandparent',
      googleCategory: GC_FIGURES,
    });
    const primary = makeCategory({
      id: 'leaf',
      parentId: 'grandparent',
      parent: grandparent,
      material: MATERIAL_PLA,
    });
    const product = makeProduct({
      color: COLOR_BLUE,
      primaryCategory: primary,
    });

    const resolved = service.resolve(product);

    expect(resolved.color).toEqual(COLOR_BLUE);
    expect(resolved.material).toEqual(MATERIAL_PLA);
    expect(resolved.googleCategory).toEqual(GC_FIGURES);
  });

  it('returns null for fields not found anywhere in the chain', () => {
    const product = makeProduct({
      primaryCategory: makeCategory({ id: 'leaf' }),
    });
    const resolved = service.resolve(product);
    expect(resolved.color).toBeNull();
    expect(resolved.material).toBeNull();
    expect(resolved.googleCategory).toBeNull();
  });

  it('returns null when the product has no primary category at all', () => {
    const product = makeProduct({});
    const resolved = service.resolve(product);
    expect(resolved.color).toBeNull();
    expect(resolved.material).toBeNull();
    expect(resolved.googleCategory).toBeNull();
  });

  it('ignores non-primary categories even when they would have a value', () => {
    const nonPrimary = makeCategory({ id: 'other', color: COLOR_RED });
    const primary = makeCategory({ id: 'leaf' });
    const product = makeProduct({
      primaryCategory: primary,
      otherCategories: [nonPrimary],
    });

    expect(service.resolve(product).color).toBeNull();
  });
});

describe('MerchantFieldsService.enrich', () => {
  let service: MerchantFieldsService;

  beforeEach(() => {
    service = new MerchantFieldsService();
  });

  it('mutates the product to inject resolved values', () => {
    const product = makeProduct({
      primaryCategory: makeCategory({ color: COLOR_RED }),
    });
    const result = service.enrich(product);

    expect(result).toBe(product);
    expect(product.color).toEqual(COLOR_RED);
  });

  it('enrichMany maps all products', () => {
    const products = [
      makeProduct({ primaryCategory: makeCategory({ color: COLOR_RED }) }),
      makeProduct({
        color: COLOR_BLUE,
        primaryCategory: makeCategory({ color: COLOR_RED }),
      }),
    ];
    const out = service.enrichMany(products);
    expect(out[0].color).toEqual(COLOR_RED);
    expect(out[1].color).toEqual(COLOR_BLUE);
  });
});
