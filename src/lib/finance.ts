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
  const total = allocations.reduce((sum, value) => sum + value, 0);
  if (total <= 0) {
    return allocations.map(() => 0);
  }
  return allocations.map((value) => roundCurrency((amount * value) / total));
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
