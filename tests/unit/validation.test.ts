import { describe, expect, it } from "vitest";
import {
  ValidationError,
  validateRequired,
  validateXOR,
  validateVehicleDeduction,
  validatePositive,
  validateDateRange,
  validateRate,
  validateEnum,
  validateExpenseSplits,
  validateSaleItems,
  validateConfidence
} from "../../src/lib/validation";

describe("ValidationError", () => {
  it("creates error with message", () => {
    const error = new ValidationError("Test error");
    expect(error.message).toBe("Test error");
    expect(error.name).toBe("ValidationError");
    expect(error.details).toBeUndefined();
  });

  it("creates error with details", () => {
    const error = new ValidationError("Test error", { field: "value" });
    expect(error.message).toBe("Test error");
    expect(error.details).toEqual({ field: "value" });
  });
});

describe("validateRequired", () => {
  it("passes when all required fields present", () => {
    const data = { name: "Test", email: "test@example.com" };
    expect(() => validateRequired(data, ["name", "email"])).not.toThrow();
  });

  it("throws when field is missing", () => {
    const data = { name: "Test" };
    expect(() => validateRequired(data, ["name", "email"])).toThrow(
      ValidationError
    );
  });

  it("throws when field is null", () => {
    const data = { name: "Test", email: null };
    expect(() => validateRequired(data, ["name", "email"])).toThrow(
      ValidationError
    );
  });

  it("throws when field is empty string", () => {
    const data = { name: "Test", email: "" };
    expect(() => validateRequired(data, ["name", "email"])).toThrow(
      ValidationError
    );
  });

  it("throws with correct missing field details", () => {
    const data = { name: "Test" };
    try {
      validateRequired(data, ["name", "email", "phone"]);
      expect.fail("Should have thrown");
    } catch (error) {
      if (error instanceof ValidationError) {
        expect(error.message).toContain("email");
        expect(error.message).toContain("phone");
        expect(error.details?.missing).toEqual(["email", "phone"]);
      }
    }
  });

  it("allows zero as valid value", () => {
    const data = { name: "Test", quantity: 0 };
    expect(() => validateRequired(data, ["name", "quantity"])).not.toThrow();
  });

  it("allows false as valid value", () => {
    const data = { name: "Test", active: false };
    expect(() => validateRequired(data, ["name", "active"])).not.toThrow();
  });
});

describe("validateXOR", () => {
  it("passes when only first field present", () => {
    const data = { item_id: "123" };
    expect(() => validateXOR(data, "item_id", "lot_id")).not.toThrow();
  });

  it("passes when only second field present", () => {
    const data = { lot_id: "456" };
    expect(() => validateXOR(data, "item_id", "lot_id")).not.toThrow();
  });

  it("throws when both fields present", () => {
    const data = { item_id: "123", lot_id: "456" };
    expect(() => validateXOR(data, "item_id", "lot_id")).toThrow(
      ValidationError
    );
    expect(() => validateXOR(data, "item_id", "lot_id")).toThrow(
      /Cannot provide both/
    );
  });

  it("throws when neither field present", () => {
    const data = {};
    expect(() => validateXOR(data, "item_id", "lot_id")).toThrow(
      ValidationError
    );
    expect(() => validateXOR(data, "item_id", "lot_id")).toThrow(
      /Exactly one of/
    );
  });

  it("treats null as not present", () => {
    const data = { item_id: "123", lot_id: null };
    expect(() => validateXOR(data, "item_id", "lot_id")).not.toThrow();
  });

  it("treats undefined as not present", () => {
    const data = { item_id: "123", lot_id: undefined };
    expect(() => validateXOR(data, "item_id", "lot_id")).not.toThrow();
  });
});

describe("validateVehicleDeduction", () => {
  it("passes when only mileage provided", () => {
    expect(() => validateVehicleDeduction(100, null)).not.toThrow();
  });

  it("passes when only actual provided", () => {
    expect(() => validateVehicleDeduction(null, 50)).not.toThrow();
  });

  it("passes when neither provided", () => {
    expect(() => validateVehicleDeduction(null, null)).not.toThrow();
    expect(() => validateVehicleDeduction(undefined, undefined)).not.toThrow();
  });

  it("throws when both provided", () => {
    expect(() => validateVehicleDeduction(100, 50)).toThrow(ValidationError);
    expect(() => validateVehicleDeduction(100, 50)).toThrow(
      /Cannot use both mileage and actual/
    );
  });

  it("throws when mileage is negative", () => {
    expect(() => validateVehicleDeduction(-10, null)).toThrow(
      ValidationError
    );
    expect(() => validateVehicleDeduction(-10, null)).toThrow(
      /Mileage cannot be negative/
    );
  });

  it("throws when actual is negative", () => {
    expect(() => validateVehicleDeduction(null, -50)).toThrow(
      ValidationError
    );
    expect(() => validateVehicleDeduction(null, -50)).toThrow(
      /Actual expenses cannot be negative/
    );
  });

  it("allows zero mileage", () => {
    expect(() => validateVehicleDeduction(0, null)).not.toThrow();
  });

  it("allows zero actual", () => {
    expect(() => validateVehicleDeduction(null, 0)).not.toThrow();
  });
});

describe("validatePositive", () => {
  it("passes for positive numbers", () => {
    expect(() => validatePositive(100, "amount")).not.toThrow();
    expect(() => validatePositive(0.01, "amount")).not.toThrow();
  });

  it("passes for zero", () => {
    expect(() => validatePositive(0, "amount")).not.toThrow();
  });

  it("passes for null", () => {
    expect(() => validatePositive(null, "amount")).not.toThrow();
  });

  it("passes for undefined", () => {
    expect(() => validatePositive(undefined, "amount")).not.toThrow();
  });

  it("throws for negative numbers", () => {
    expect(() => validatePositive(-1, "amount")).toThrow(ValidationError);
    expect(() => validatePositive(-0.01, "amount")).toThrow(
      /amount cannot be negative/
    );
  });

  it("includes field name in error", () => {
    try {
      validatePositive(-10, "cost");
      expect.fail("Should have thrown");
    } catch (error) {
      if (error instanceof ValidationError) {
        expect(error.message).toContain("cost");
        expect(error.details?.cost).toBe(-10);
      }
    }
  });
});

describe("validateDateRange", () => {
  it("passes when start is before end", () => {
    expect(() =>
      validateDateRange("2025-01-01", "2025-12-31")
    ).not.toThrow();
  });

  it("passes when start equals end", () => {
    expect(() =>
      validateDateRange("2025-06-15", "2025-06-15")
    ).not.toThrow();
  });

  it("passes when both dates are null", () => {
    expect(() => validateDateRange(null, null)).not.toThrow();
  });

  it("passes when both dates are undefined", () => {
    expect(() => validateDateRange(undefined, undefined)).not.toThrow();
  });

  it("passes when only start is null", () => {
    expect(() => validateDateRange(null, "2025-12-31")).not.toThrow();
  });

  it("passes when only end is null", () => {
    expect(() => validateDateRange("2025-01-01", null)).not.toThrow();
  });

  it("throws when start is after end", () => {
    expect(() => validateDateRange("2025-12-31", "2025-01-01")).toThrow(
      ValidationError
    );
    expect(() => validateDateRange("2025-12-31", "2025-01-01")).toThrow(
      /Start date must be before or equal to end date/
    );
  });

  it("throws for invalid start date", () => {
    expect(() => validateDateRange("invalid", "2025-12-31")).toThrow(
      ValidationError
    );
    expect(() => validateDateRange("invalid", "2025-12-31")).toThrow(
      /Invalid start date/
    );
  });

  it("throws for invalid end date", () => {
    expect(() => validateDateRange("2025-01-01", "invalid")).toThrow(
      ValidationError
    );
    expect(() => validateDateRange("2025-01-01", "invalid")).toThrow(
      /Invalid end date/
    );
  });

  it("handles ISO date strings with time", () => {
    expect(() =>
      validateDateRange("2025-01-01T00:00:00Z", "2025-12-31T23:59:59Z")
    ).not.toThrow();
  });
});

describe("validateRate", () => {
  it("passes for valid rates", () => {
    expect(() => validateRate(0, "fee_rate")).not.toThrow();
    expect(() => validateRate(0.5, "fee_rate")).not.toThrow();
    expect(() => validateRate(1, "fee_rate")).not.toThrow();
  });

  it("passes for null", () => {
    expect(() => validateRate(null, "fee_rate")).not.toThrow();
  });

  it("passes for undefined", () => {
    expect(() => validateRate(undefined, "fee_rate")).not.toThrow();
  });

  it("throws for rates below 0", () => {
    expect(() => validateRate(-0.1, "fee_rate")).toThrow(ValidationError);
    expect(() => validateRate(-0.1, "fee_rate")).toThrow(
      /must be between 0 and 1/
    );
  });

  it("throws for rates above 1", () => {
    expect(() => validateRate(1.1, "fee_rate")).toThrow(ValidationError);
    expect(() => validateRate(2, "fee_rate")).toThrow(
      /must be between 0 and 1/
    );
  });
});

describe("validateEnum", () => {
  it("passes for valid enum value", () => {
    expect(() =>
      validateEnum("Active", "status", ["Active", "Inactive", "Pending"])
    ).not.toThrow();
  });

  it("passes for null", () => {
    expect(() =>
      validateEnum(null, "status", ["Active", "Inactive"])
    ).not.toThrow();
  });

  it("passes for undefined", () => {
    expect(() =>
      validateEnum(undefined, "status", ["Active", "Inactive"])
    ).not.toThrow();
  });

  it("throws for invalid enum value", () => {
    expect(() =>
      validateEnum("InvalidStatus", "status", ["Active", "Inactive"])
    ).toThrow(ValidationError);
  });

  it("includes allowed values in error message", () => {
    try {
      validateEnum("Bad", "status", ["Active", "Inactive"]);
      expect.fail("Should have thrown");
    } catch (error) {
      if (error instanceof ValidationError) {
        expect(error.message).toContain("Active");
        expect(error.message).toContain("Inactive");
        expect(error.details?.allowedValues).toEqual(["Active", "Inactive"]);
      }
    }
  });
});

describe("validateExpenseSplits", () => {
  it("passes when splits sum exactly to amount", () => {
    expect(() => validateExpenseSplits(50, 30, 20, 100)).not.toThrow();
  });

  it("passes with small rounding error", () => {
    expect(() => validateExpenseSplits(33.33, 33.33, 33.34, 100)).not.toThrow();
  });

  it("throws when splits sum incorrectly", () => {
    expect(() => validateExpenseSplits(40, 30, 20, 100)).toThrow(
      ValidationError
    );
    expect(() => validateExpenseSplits(40, 30, 20, 100)).toThrow(
      /must sum to total amount/
    );
  });

  it("throws when inventory is negative", () => {
    expect(() => validateExpenseSplits(-10, 60, 50, 100)).toThrow(
      ValidationError
    );
  });

  it("throws when operations is negative", () => {
    expect(() => validateExpenseSplits(50, -10, 60, 100)).toThrow(
      ValidationError
    );
  });

  it("throws when other is negative", () => {
    expect(() => validateExpenseSplits(50, 60, -10, 100)).toThrow(
      ValidationError
    );
  });

  it("allows all zeros", () => {
    expect(() => validateExpenseSplits(0, 0, 0, 0)).not.toThrow();
  });

  it("handles decimal amounts correctly", () => {
    expect(() => validateExpenseSplits(12.50, 37.25, 50.25, 100)).not.toThrow();
  });
});

describe("validateSaleItems", () => {
  it("passes with valid items", () => {
    const items = [
      { item_id: "item-1", quantity: 1 },
      { item_id: "item-2", quantity: 2 }
    ];
    expect(() => validateSaleItems(items)).not.toThrow();
  });

  it("throws for empty array", () => {
    expect(() => validateSaleItems([])).toThrow(ValidationError);
    expect(() => validateSaleItems([])).toThrow(
      /must include at least one item/
    );
  });

  it("throws for null", () => {
    expect(() => validateSaleItems(null as any)).toThrow(ValidationError);
  });

  it("throws for undefined", () => {
    expect(() => validateSaleItems(undefined as any)).toThrow(
      ValidationError
    );
  });

  it("throws when item missing item_id", () => {
    const items = [{ quantity: 1 }];
    expect(() => validateSaleItems(items)).toThrow(ValidationError);
    expect(() => validateSaleItems(items)).toThrow(/must have an item_id/);
  });

  it("throws when item has null item_id", () => {
    const items = [{ item_id: null, quantity: 1 }];
    expect(() => validateSaleItems(items)).toThrow(ValidationError);
  });

  it("throws when item missing quantity", () => {
    const items = [{ item_id: "item-1" }];
    expect(() => validateSaleItems(items)).toThrow(ValidationError);
    expect(() => validateSaleItems(items)).toThrow(/positive quantity/);
  });

  it("throws when quantity is zero", () => {
    const items = [{ item_id: "item-1", quantity: 0 }];
    expect(() => validateSaleItems(items)).toThrow(ValidationError);
  });

  it("throws when quantity is negative", () => {
    const items = [{ item_id: "item-1", quantity: -1 }];
    expect(() => validateSaleItems(items)).toThrow(ValidationError);
  });

  it("validates all items in array", () => {
    const items = [
      { item_id: "item-1", quantity: 1 },
      { item_id: "item-2", quantity: 0 } // Invalid
    ];
    expect(() => validateSaleItems(items)).toThrow(ValidationError);
  });
});

describe("validateConfidence", () => {
  it("passes for valid confidence scores", () => {
    expect(() => validateConfidence(0)).not.toThrow();
    expect(() => validateConfidence(0.5)).not.toThrow();
    expect(() => validateConfidence(1)).not.toThrow();
  });

  it("passes for null", () => {
    expect(() => validateConfidence(null)).not.toThrow();
  });

  it("passes for undefined", () => {
    expect(() => validateConfidence(undefined)).not.toThrow();
  });

  it("throws for confidence below 0", () => {
    expect(() => validateConfidence(-0.1)).toThrow(ValidationError);
    expect(() => validateConfidence(-0.1)).toThrow(
      /must be between 0 and 1/
    );
  });

  it("throws for confidence above 1", () => {
    expect(() => validateConfidence(1.1)).toThrow(ValidationError);
    expect(() => validateConfidence(2)).toThrow(/must be between 0 and 1/);
  });

  it("allows boundary values", () => {
    expect(() => validateConfidence(0.0)).not.toThrow();
    expect(() => validateConfidence(1.0)).not.toThrow();
  });
});
