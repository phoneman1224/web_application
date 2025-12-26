export interface SaleInput {
  salePrice: number;
  platformFeeRate: number;
  promotionRate: number;
  shippingCost: number;
  costOfGoods: number;
}

export interface ProfitBreakdown {
  grossRevenue: number;
  platformFees: number;
  promotionDiscount: number;
  netRevenue: number;
  costOfGoods: number;
  shippingCost: number;
  profit: number;
}

export function calculateProfit(input: SaleInput): ProfitBreakdown {
  const promotionDiscount = roundCurrency(input.salePrice * input.promotionRate);
  const discountedPrice = roundCurrency(input.salePrice - promotionDiscount);
  const platformFees = roundCurrency(discountedPrice * input.platformFeeRate);
  const netRevenue = roundCurrency(discountedPrice - platformFees);
  const profit = roundCurrency(netRevenue - input.costOfGoods - input.shippingCost);

  return {
    grossRevenue: roundCurrency(input.salePrice),
    platformFees,
    promotionDiscount,
    netRevenue,
    costOfGoods: roundCurrency(input.costOfGoods),
    shippingCost: roundCurrency(input.shippingCost),
    profit
  };
}

export function calculateFederalTaxEstimate(taxableIncome: number, effectiveRate: number): number {
  const sanitizedRate = Math.max(0, Math.min(1, effectiveRate));
  return roundCurrency(taxableIncome * sanitizedRate);
}

export function calculateFloridaSalesTaxLiability(
  nonEbayTaxCollected: number,
  eBayPlatformTaxCollected: number
): number {
  return roundCurrency(Math.max(0, nonEbayTaxCollected) - Math.max(0, eBayPlatformTaxCollected));
}

export function splitExpense(amount: number, allocations: number[]): number[] {
  const normalized = allocations.map((value) => Math.max(0, value));
  const total = normalized.reduce((sum, value) => sum + value, 0);
  if (total <= 0) {
    return allocations.map(() => 0);
  }

  const amountCents = Math.round(amount * 100);
  const sign = amountCents < 0 ? -1 : 1;
  const absoluteCents = Math.abs(amountCents);
  const rawShares = normalized.map((value) => (absoluteCents * value) / total);
  const floored = rawShares.map((share) => Math.floor(share));
  let remainder = absoluteCents - floored.reduce((sum, value) => sum + value, 0);
  const order = rawShares
    .map((share, index) => ({ index, fraction: share - Math.floor(share) }))
    .sort((a, b) => b.fraction - a.fraction);

  for (let i = 0; i < order.length && remainder > 0; i += 1) {
    floored[order[i].index] += 1;
    remainder -= 1;
  }

  return floored.map((value) => (value * sign) / 100);
}

export function applyPromotion(basePrice: number, promotionRate: number): number {
  return roundCurrency(basePrice * (1 - promotionRate));
}

export interface LotItem {
  itemId: string;
  quantity: number;
}

export interface LotWrapper {
  lotId: string;
  items: LotItem[];
  notes?: string;
}

export function buildLotWrapper(lotId: string, items: LotItem[], notes?: string): LotWrapper {
  const sanitizedItems = items
    .filter((item) => item.quantity > 0)
    .map((item) => ({
      itemId: item.itemId,
      quantity: Math.floor(item.quantity)
    }));

  return {
    lotId,
    items: sanitizedItems,
    notes
  };
}

function roundCurrency(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}
