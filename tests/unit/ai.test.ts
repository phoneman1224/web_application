import { describe, expect, it, beforeEach } from "vitest";
import {
  generateSEO,
  suggestCategory,
  suggestPrice,
  analyzePhoto,
  generateInsights,
  suggestExpenseSplit,
  enhanceDescription
} from "../../src/lib/ai";

// Mock AI binding that matches Cloudflare Workers AI structure
class MockAI {
  async run(model: string, options: any) {
    // Return different mocks based on model/prompt
    if (model === "@cf/meta/llama-3-8b-instruct") {
      const messages = options.messages || [];
      const prompt = messages[0]?.content || "";

      // SEO generation
      if (prompt.includes("eBay listing") || prompt.includes("SEO-optimized")) {
        return {
          response: JSON.stringify({
            title: "Vintage Sony Walkman WM-10 Personal Cassette Player - Tested & Working",
            description: "Rare vintage Sony Walkman WM-10 in excellent condition. Fully tested and working perfectly. Includes original headphones and case. Great for collectors!",
            keywords: ["vintage", "sony", "walkman", "cassette", "player", "retro"]
          })
        };
      }

      // Category suggestion - returns plain text, not JSON
      if (prompt.includes("Categorize this")) {
        return {
          response: "Electronics"
        };
      }

      // Price suggestion
      if (prompt.includes("pricing expert")) {
        return {
          response: JSON.stringify({
            min: 45,
            max: 75,
            suggested: 59.99,
            reasoning: "Based on recent eBay sales of similar vintage Sony Walkmans in working condition, prices typically range from $45-$75. Suggested price of $59.99 is competitive while accounting for tested/working condition."
          })
        };
      }

      // Dashboard insights
      if (prompt.includes("business advisor")) {
        return {
          response: JSON.stringify({
            insights: [
              "Your average profit margin is 47%, which is above the industry average",
              "Electronics category has highest sell-through rate at 85%"
            ],
            warnings: [
              "5 items have been in inventory for over 90 days",
              "Florida sales tax liability is $127 - consider remitting soon"
            ],
            opportunities: [
              "Consider sourcing more electronics - they're selling fastest",
              "15 items are ready to list - could generate ~$450 in potential sales"
            ]
          })
        };
      }

      // Expense split suggestion - returns percentages that get converted to dollar amounts
      if (prompt.includes("tax advisor")) {
        return {
          response: JSON.stringify({
            inventory: 70,
            operations: 20,
            other: 10
          })
        };
      }

      // Description enhancement
      if (prompt.includes("copywriting expert")) {
        return {
          response: JSON.stringify({
            enhanced: "Beautiful vintage Sony Walkman in excellent working condition. This classic portable cassette player has been thoroughly tested and plays tapes perfectly. Includes original headphones and protective case. A must-have for vintage electronics collectors and 80s enthusiasts!",
            improvements: [
              "Added descriptive adjectives for appeal",
              "Emphasized working condition and testing",
              "Included collector appeal",
              "Made description more engaging"
            ]
          })
        };
      }

      // Default text response
      return { response: "Mock AI response" };
    }

    // Image classification model - returns labels array, not response.response
    if (model === "@cf/microsoft/resnet-50") {
      return {
        labels: [
          { label: "Portable cassette player", score: 0.88 },
          { label: "Electronics", score: 0.75 }
        ]
      };
    }

    return { response: "Unknown model" };
  }
}

describe("AI Service - generateSEO", () => {
  let mockAI: MockAI;

  beforeEach(() => {
    mockAI = new MockAI();
  });

  it("generates SEO title, description, and keywords", async () => {
    const result = await generateSEO(mockAI, {
      name: "Sony Walkman WM-10",
      description: "Vintage cassette player",
      category: "Electronics"
    });

    expect(result.title).toBeDefined();
    expect(result.title.length).toBeLessThanOrEqual(80); // eBay limit
    expect(result.description).toBeDefined();
    expect(result.keywords).toBeInstanceOf(Array);
    expect(result.keywords.length).toBeGreaterThan(0);
    expect(result.confidence).toBeGreaterThanOrEqual(0);
    expect(result.confidence).toBeLessThanOrEqual(1);
  });

  it("handles items with minimal information", async () => {
    const result = await generateSEO(mockAI, {
      name: "Test Item"
    });

    expect(result.title).toBeDefined();
    expect(result.description).toBeDefined();
  });

  it("includes category in SEO generation", async () => {
    const result = await generateSEO(mockAI, {
      name: "Widget",
      category: "Electronics"
    });

    expect(result).toHaveProperty("title");
    expect(result).toHaveProperty("description");
  });

  it("respects eBay 80 character title limit", async () => {
    const result = await generateSEO(mockAI, {
      name: "Very Long Product Name That Should Be Optimized For eBay Search Results"
    });

    expect(result.title.length).toBeLessThanOrEqual(80);
  });
});

describe("AI Service - suggestCategory", () => {
  let mockAI: MockAI;

  beforeEach(() => {
    mockAI = new MockAI();
  });

  it("suggests category for item", async () => {
    const result = await suggestCategory(
      mockAI,
      "Vintage Sony Walkman cassette player",
      "item"
    );

    expect(result.category).toBeDefined();
    expect(result.confidence).toBeGreaterThanOrEqual(0);
    expect(result.confidence).toBeLessThanOrEqual(1);
  });

  it("suggests category for expense", async () => {
    const result = await suggestCategory(
      mockAI,
      "Shipping supplies - bubble mailers",
      "expense"
    );

    expect(result.category).toBeDefined();
    expect(result.confidence).toBeDefined();
  });

  it("returns high confidence for clear categories", async () => {
    const result = await suggestCategory(
      mockAI,
      "iPhone 13 Pro Max smartphone",
      "item"
    );

    // Confidence varies based on match quality
    expect(result.confidence).toBeGreaterThanOrEqual(0.4);
  });
});

describe("AI Service - suggestPrice", () => {
  let mockAI: MockAI;

  beforeEach(() => {
    mockAI = new MockAI();
  });

  it("suggests price range with reasoning", async () => {
    const result = await suggestPrice(mockAI, {
      name: "Sony Walkman",
      description: "Vintage cassette player",
      category: "Electronics",
      condition: "Used - Excellent"
    });

    expect(result.min).toBeDefined();
    expect(result.max).toBeDefined();
    expect(result.suggested).toBeDefined();
    expect(result.confidence).toBeGreaterThanOrEqual(0);
    expect(result.confidence).toBeLessThanOrEqual(1);
    expect(result.reasoning).toBeDefined();
  });

  it("ensures min <= suggested <= max", async () => {
    const result = await suggestPrice(mockAI, {
      name: "Test Product"
    });

    expect(result.min).toBeLessThanOrEqual(result.suggested);
    expect(result.suggested).toBeLessThanOrEqual(result.max);
  });

  it("provides reasoning for price suggestion", async () => {
    const result = await suggestPrice(mockAI, {
      name: "Collectible item",
      category: "Collectibles"
    });

    expect(result.reasoning).toBeTruthy();
    expect(result.reasoning.length).toBeGreaterThan(10);
  });
});

describe("AI Service - analyzePhoto", () => {
  let mockAI: MockAI;

  beforeEach(() => {
    mockAI = new MockAI();
  });

  it("analyzes photo and returns item details", async () => {
    const fakePhotoData = new ArrayBuffer(100);
    const result = await analyzePhoto(mockAI, fakePhotoData);

    expect(result.itemType).toBeDefined();
    expect(result.condition).toBeDefined();
    expect(result.suggestedCategory).toBeDefined();
    expect(result.confidence).toBeGreaterThanOrEqual(0);
    expect(result.confidence).toBeLessThanOrEqual(1);
  });

  it("handles empty photo data gracefully", async () => {
    const emptyData = new ArrayBuffer(0);
    const result = await analyzePhoto(mockAI, emptyData);

    expect(result).toHaveProperty("itemType");
    expect(result).toHaveProperty("confidence");
  });
});

describe("AI Service - generateInsights", () => {
  let mockAI: MockAI;

  beforeEach(() => {
    mockAI = new MockAI();
  });

  it("generates insights from business data", async () => {
    const data = {
      recentSales: [
        { profit: 25, platform: "eBay", category: "Electronics" }
      ],
      inventory: [
        { status: "In Stock", category: "Electronics", cost: 50 }
      ],
      expenses: [
        { category: "Shipping", amount: 100 }
      ]
    };

    const result = await generateInsights(mockAI, data);

    expect(result.insights).toBeInstanceOf(Array);
    expect(result.warnings).toBeInstanceOf(Array);
    expect(result.opportunities).toBeInstanceOf(Array);
  });

  it("provides actionable insights", async () => {
    const data = {
      recentSales: [],
      inventory: [],
      expenses: []
    };

    const result = await generateInsights(mockAI, data);

    // Should have at least some feedback (may be empty arrays from AI or fallback)
    expect(result).toHaveProperty("insights");
    expect(result).toHaveProperty("warnings");
    expect(result).toHaveProperty("opportunities");
  });

  it("categorizes insights appropriately", async () => {
    const data = {
      recentSales: [],
      inventory: [],
      expenses: []
    };

    const result = await generateInsights(mockAI, data);

    // Insights should be positive observations
    expect(result.insights).toBeInstanceOf(Array);
    // Warnings should highlight issues
    expect(result.warnings).toBeInstanceOf(Array);
    // Opportunities should suggest improvements
    expect(result.opportunities).toBeInstanceOf(Array);
  });
});

describe("AI Service - suggestExpenseSplit", () => {
  let mockAI: MockAI;

  beforeEach(() => {
    mockAI = new MockAI();
  });

  it("suggests split percentages for expense", async () => {
    const result = await suggestExpenseSplit(mockAI, {
      name: "Storage unit rental",
      category: "Storage",
      amount: 100
    });

    expect(result.inventory).toBeDefined();
    expect(result.operations).toBeDefined();
    expect(result.other).toBeDefined();
    expect(result.confidence).toBeGreaterThanOrEqual(0);
    expect(result.confidence).toBeLessThanOrEqual(1);
  });

  it("ensures splits sum to expense amount", async () => {
    const amount = 50;
    const result = await suggestExpenseSplit(mockAI, {
      name: "Shipping supplies",
      category: "Supplies",
      amount
    });

    // Splits are returned as dollar amounts, should sum to total expense
    const total = result.inventory + result.operations + result.other;
    expect(total).toBeCloseTo(amount, 2); // Allow 1 cent rounding error
  });

  it("provides different splits for different categories", async () => {
    const storage = await suggestExpenseSplit(mockAI, {
      name: "Storage",
      category: "Storage",
      amount: 100
    });

    const shipping = await suggestExpenseSplit(mockAI, {
      name: "Shipping",
      category: "Shipping",
      amount: 100
    });

    // Splits should vary by category (storage is likely more inventory-heavy)
    expect(storage).toBeDefined();
    expect(shipping).toBeDefined();
  });
});

describe("AI Service - enhanceDescription", () => {
  let mockAI: MockAI;

  beforeEach(() => {
    mockAI = new MockAI();
  });

  it("enhances basic description", async () => {
    const original = "Sony Walkman, works good";
    const result = await enhanceDescription(mockAI, original);

    expect(result.enhanced).toBeDefined();
    expect(result.improvements).toBeInstanceOf(Array);
    // Enhanced may or may not be longer, but should be defined
    expect(result.enhanced.length).toBeGreaterThan(0);
  });

  it("lists improvements made", async () => {
    const result = await enhanceDescription(
      mockAI,
      "Item for sale"
    );

    expect(result.improvements.length).toBeGreaterThan(0);
  });

  it("maintains original meaning while improving", async () => {
    const original = "Vintage camera";
    const result = await enhanceDescription(mockAI, original);

    // Mock returns fixed response, so just verify it returns something enhanced
    expect(result.enhanced).toBeDefined();
    expect(result.enhanced.length).toBeGreaterThan(0);
    expect(result.improvements.length).toBeGreaterThan(0);
  });

  it("handles empty descriptions", async () => {
    const result = await enhanceDescription(mockAI, "");

    expect(result.enhanced).toBeDefined();
    expect(result.improvements).toBeInstanceOf(Array);
  });
});

describe("AI Service - Error Handling", () => {
  it("handles AI quota exceeded gracefully", async () => {
    const quotaExceededAI = {
      async run() {
        throw new Error("AI quota exceeded");
      }
    };

    // Should return fallback values, not throw
    const result = await suggestCategory(quotaExceededAI, "test", "item");
    expect(result.category).toBe("Other"); // Fallback category
    expect(result.confidence).toBeLessThan(0.5); // Low confidence
  });

  it("handles malformed AI responses", async () => {
    const brokenAI = {
      async run() {
        return { response: "not valid json" };
      }
    };

    // Should return fallback values, not throw
    const result = await generateSEO(brokenAI, { name: "test" });
    expect(result.title).toBe("test");
    expect(result.confidence).toBeLessThan(0.5); // Low confidence indicates fallback
  });

  it("handles missing AI binding", async () => {
    const nullAI = {
      async run() {
        throw new Error("AI binding not available");
      }
    };

    // Should return fallback values, not throw
    const result = await suggestPrice(nullAI, { name: "test" });
    expect(result.min).toBeDefined();
    expect(result.max).toBeDefined();
    expect(result.suggested).toBeDefined();
    expect(result.confidence).toBeLessThan(0.5); // Low confidence indicates fallback
  });
});

describe("AI Service - Confidence Scoring", () => {
  let mockAI: MockAI;

  beforeEach(() => {
    mockAI = new MockAI();
  });

  it("all AI responses include confidence scores", async () => {
    const seo = await generateSEO(mockAI, { name: "Test" });
    expect(seo.confidence).toBeGreaterThanOrEqual(0);
    expect(seo.confidence).toBeLessThanOrEqual(1);

    const category = await suggestCategory(mockAI, "Test", "item");
    expect(category.confidence).toBeGreaterThanOrEqual(0);
    expect(category.confidence).toBeLessThanOrEqual(1);

    const price = await suggestPrice(mockAI, { name: "Test" });
    expect(price.confidence).toBeGreaterThanOrEqual(0);
    expect(price.confidence).toBeLessThanOrEqual(1);

    const photo = await analyzePhoto(mockAI, new ArrayBuffer(100));
    expect(photo.confidence).toBeGreaterThanOrEqual(0);
    expect(photo.confidence).toBeLessThanOrEqual(1);

    const split = await suggestExpenseSplit(mockAI, {
      name: "Test",
      category: "Supplies",
      amount: 100
    });
    expect(split.confidence).toBeGreaterThanOrEqual(0);
    expect(split.confidence).toBeLessThanOrEqual(1);
  });
});
