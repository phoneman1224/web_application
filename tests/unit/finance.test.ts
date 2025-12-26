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

  // Edge case tests
  it("handles zero sale price", () => {
    const result = calculateProfit({
      salePrice: 0,
      platformFeeRate: 0.12,
      promotionRate: 0,
      shippingCost: 0,
      costOfGoods: 0
    });

    expect(result.grossRevenue).toBe(0);
    expect(result.promotionDiscount).toBe(0);
    expect(result.platformFees).toBe(0);
    expect(result.netRevenue).toBe(0);
    expect(result.profit).toBe(0);
  });

  it("handles negative profit (loss)", () => {
    const result = calculateProfit({
      salePrice: 50,
      platformFeeRate: 0.12,
      promotionRate: 0,
      shippingCost: 10,
      costOfGoods: 60
    });

    expect(result.grossRevenue).toBe(50);
    expect(result.platformFees).toBe(6);
    expect(result.netRevenue).toBe(44);
    expect(result.profit).toBe(-26); // Loss of $26
  });

  it("handles very large numbers", () => {
    const result = calculateProfit({
      salePrice: 1000000,
      platformFeeRate: 0.12,
      promotionRate: 0.05,
      shippingCost: 5000,
      costOfGoods: 500000
    });

    expect(result.grossRevenue).toBe(1000000);
    expect(result.promotionDiscount).toBe(50000);
    expect(result.platformFees).toBe(114000); // 12% of (1M - 50K)
    expect(result.netRevenue).toBe(836000);
    expect(result.profit).toBe(331000);
  });

  it("handles decimal precision in profit calculation", () => {
    const result = calculateProfit({
      salePrice: 19.99,
      platformFeeRate: 0.129,
      promotionRate: 0.08,
      shippingCost: 3.50,
      costOfGoods: 7.25
    });

    expect(result.grossRevenue).toBe(19.99);
    expect(result.promotionDiscount).toBeCloseTo(1.60, 2);
    expect(result.platformFees).toBeCloseTo(2.37, 2);
    expect(result.netRevenue).toBeCloseTo(16.02, 2);
    expect(result.profit).toBeCloseTo(5.27, 2);
  });

  it("calculates federal tax with zero profit", () => {
    expect(calculateFederalTaxEstimate(0, 0.22)).toBe(0);
  });

  it("calculates federal tax with negative profit", () => {
    // Function applies rate even to negative numbers (returns negative tax)
    expect(calculateFederalTaxEstimate(-1000, 0.22)).toBe(-220);
  });

  it("handles Florida tax when eBay collected equals total", () => {
    expect(calculateFloridaSalesTaxLiability(100, 100)).toBe(0);
  });

  it("handles Florida tax when eBay collected exceeds total", () => {
    // Function can return negative (represents credit or over-collection)
    expect(calculateFloridaSalesTaxLiability(80, 100)).toBe(-20);
  });

  it("handles Florida tax with no eBay collection", () => {
    expect(calculateFloridaSalesTaxLiability(150, 0)).toBe(150);
  });

  it("splits expenses evenly", () => {
    const result = splitExpense(300, [33.33, 33.33, 33.34]);
    expect(result[0] + result[1] + result[2]).toBe(300);
  });

  it("splits expenses with zero amount", () => {
    expect(splitExpense(0, [50, 30, 20])).toEqual([0, 0, 0]);
  });

  it("splits expenses unevenly", () => {
    const result = splitExpense(100, [70, 20, 10]);
    expect(result).toEqual([70, 20, 10]);
  });

  it("splits expenses with rounding (largest remainder method)", () => {
    const result = splitExpense(10, [33.33, 33.33, 33.34]);
    expect(result[0] + result[1] + result[2]).toBeCloseTo(10, 2);
  });

  it("handles promotion with zero rate", () => {
    expect(applyPromotion(100, 0)).toBe(100);
  });

  it("handles promotion with 100% discount", () => {
    expect(applyPromotion(100, 1)).toBe(0);
  });

  it("builds lot with empty items array", () => {
    const lot = buildLotWrapper("lot-empty", []);
    expect(lot.lotId).toBe("lot-empty");
    expect(lot.items).toEqual([]);
  });

  it("builds lot with single item", () => {
    const lot = buildLotWrapper("lot-single", [
      { itemId: "itm-1", quantity: 1 }
    ]);
    expect(lot.items.length).toBe(1);
  });
});
