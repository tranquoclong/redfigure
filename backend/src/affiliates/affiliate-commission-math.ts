

export interface CommissionMathItem {
  id: string;
  productId?: string | null;
  quantity: number;
  price: number;
  discount: number;
}

export interface ComputeBaseAmountInput {
  item: CommissionMathItem;
  allItems: CommissionMathItem[];

  itemsInScope: CommissionMathItem[];
  couponDiscount: number;
}

export function computeBaseAmount(input: ComputeBaseAmountInput): number {
  const itemTotal = itemGrossValue(input.item);

  if (input.couponDiscount <= 0) return clampNonNegative(itemTotal);

  const inScope = input.itemsInScope.some((i) => i.id === input.item.id);
  if (!inScope) return clampNonNegative(itemTotal);

  const scopeSubtotal = input.itemsInScope.reduce(
    (acc, i) => acc + itemGrossValue(i),
    0,
  );
  if (scopeSubtotal <= 0) return clampNonNegative(itemTotal);

  const share = itemTotal / scopeSubtotal;
  const itemDiscountShare = input.couponDiscount * share;
  return clampNonNegative(itemTotal - itemDiscountShare);
}

function itemGrossValue(item: CommissionMathItem): number {

  return item.price * item.quantity - (item.discount ?? 0);
}

function clampNonNegative(n: number): number {
  return n < 0 ? 0 : n;
}
