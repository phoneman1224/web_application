import { describe, expect, it } from "vitest";
import {
  applyPromotion,
  buildLotWrapper,
  calculateFederalTaxEstimate,
  calculateFloridaSalesTaxLiability,
  calculateProfit,
  splitExpense
} from "../../src/lib/finance";

describe("finance calculations", () => {
  it("calculates profit with platform fees and promotions", () => {
    const result = calculateProfit({
      salePrice: 200,
      platformFeeRate: 0.12,
      promotionRate: 0.1,
      shippingCost: 15,
      costOfGoods: 60
    });

    expect(result.grossRevenue).toBe(200);
    expect(result.promotionDiscount).toBe(20);
    expect(result.platformFees).toBe(21.6);
    expect(result.netRevenue).toBe(158.4);
    expect(result.profit).toBe(83.4);
  });

  it("applies promotions correctly", () => {
    expect(applyPromotion(100, 0.2)).toBe(80);
  });

  it("estimates federal tax", () => {
    expect(calculateFederalTaxEstimate(10000, 0.22)).toBe(2200);
  });

  it("handles Florida sales tax liability excluding eBay", () => {
    expect(calculateFloridaSalesTaxLiability(120, 50)).toBe(70);
  });

  it("splits expenses across allocations", () => {
    expect(splitExpense(100, [50, 30, 20])).toEqual([50, 30, 20]);
  });

  it("splits expenses with rounding remainder", () => {
    expect(splitExpense(100, [1, 1, 1])).toEqual([33.34, 33.33, 33.33]);
  });

  it("builds lot wrapper without pricing", () => {
    const lot = buildLotWrapper("lot-1", [
      { itemId: "itm-1", quantity: 2 },
      { itemId: "itm-2", quantity: 1 }
    ]);

    expect(lot.lotId).toBe("lot-1");
    expect(lot.items).toEqual([
      { itemId: "itm-1", quantity: 2 },
      { itemId: "itm-2", quantity: 1 }
    ]);
  });
});
