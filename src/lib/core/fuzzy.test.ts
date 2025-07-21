import { describe, expect, it } from "vitest";
import { fuzzyFind } from "./fuzzy.js";

interface TestItem {
  name: string;
  description?: string;
}

describe("fuzzyFind", () => {
  const testItems: TestItem[] = [
    { name: "apple", description: "red fruit" },
    { name: "apricot", description: "orange fruit" },
    { name: "banana", description: "yellow fruit" },
    { name: "grape", description: "purple fruit" },
    { name: "application", description: "software program" },
    { name: "app", description: "mobile application" },
  ];

  describe("empty query handling", () => {
    it("should return all items with score 0 when query is empty", () => {
      const result = fuzzyFind(testItems, "");
      expect(result).toHaveLength(testItems.length);
      expect(result.every((r) => r.score === 0)).toBe(true);
    });

    it("should return all items with score 0 when query is whitespace", () => {
      const result = fuzzyFind(testItems, "   ");
      expect(result).toHaveLength(testItems.length);
      expect(result.every((r) => r.score === 0)).toBe(true);
    });
  });

  describe("exact matching", () => {
    it("should return perfect score for exact match", () => {
      const result = fuzzyFind(testItems, "apple");
      expect(result.length).toBeGreaterThan(0);
      const exactMatch = result.find((r) => r.item.name === "apple");
      expect(exactMatch).toBeDefined();
      expect(exactMatch!.score).toBe(1);
    });

    it("should be case insensitive for exact match", () => {
      const result = fuzzyFind(testItems, "APPLE");
      expect(result[0].item.name).toBe("apple");
      expect(result[0].score).toBe(1);
    });
  });

  describe("prefix matching", () => {
    it("should return high score for prefix match", () => {
      const result = fuzzyFind(testItems, "appl");
      const appleResult = result.find((r) => r.item.name === "apple");
      expect(appleResult?.score).toBe(0.9);
    });

    it("should prioritize shorter prefix matches", () => {
      const result = fuzzyFind(testItems, "app");
      // "app" is exact match (score 1), others are prefix matches (score 0.9) or fuzzy (lower)
      const appResult = result.find((r) => r.item.name === "app");
      const appleResult = result.find((r) => r.item.name === "apple");
      const applicationResult = result.find(
        (r) => r.item.name === "application",
      );

      expect(appResult?.score).toBe(1); // exact match
      expect(appleResult?.score).toBe(0.9); // prefix match
      expect(applicationResult?.score).toBe(0.9); // prefix match
    });
  });

  describe("fuzzy matching", () => {
    it("should match characters in sequence", () => {
      const result = fuzzyFind(testItems, "apl");
      const appleResult = result.find((r) => r.item.name === "apple");
      expect(appleResult).toBeDefined();
      expect(appleResult!.score).toBeGreaterThan(0.1);
    });

    it("should return no match when not all query characters are found", () => {
      const result = fuzzyFind(testItems, "xyz");
      expect(result).toHaveLength(0);
    });

    it("should prioritize consecutive character matches", () => {
      const items = [{ name: "abcdef" }, { name: "aXbXcXdef" }];
      const result = fuzzyFind(items, "abcd");
      expect(result[0].item.name).toBe("abcdef");
    });
  });

  describe("scoring behavior", () => {
    it("should return results sorted by score descending", () => {
      const result = fuzzyFind(testItems, "ap");
      for (let i = 0; i < result.length - 1; i++) {
        expect(result[i].score).toBeGreaterThanOrEqual(result[i + 1].score);
      }
    });

    it("should preserve original order for items with similar scores", () => {
      const items = [{ name: "test1" }, { name: "test2" }, { name: "test3" }];
      const result = fuzzyFind(items, "");
      expect(result[0].item.name).toBe("test1");
      expect(result[1].item.name).toBe("test2");
      expect(result[2].item.name).toBe("test3");
    });

    it("should filter out results below threshold", () => {
      const result = fuzzyFind(testItems, "z");
      expect(result).toHaveLength(0);
    });
  });

  describe("edge cases", () => {
    it("should handle empty items array", () => {
      const result = fuzzyFind([], "test");
      expect(result).toHaveLength(0);
    });

    it("should handle items with empty names", () => {
      const items = [{ name: "" }, { name: "valid" }];
      const result = fuzzyFind(items, "test");
      expect(result).toHaveLength(0);
    });

    it("should handle query longer than target", () => {
      const items = [{ name: "hi" }];
      const result = fuzzyFind(items, "hello");
      expect(result).toHaveLength(0);
    });

    it("should handle single character query and target", () => {
      const items = [{ name: "a" }];
      const result = fuzzyFind(items, "a");
      expect(result).toHaveLength(1);
      expect(result[0].score).toBe(1);
    });
  });

  describe("performance characteristics", () => {
    it("should handle reasonable dataset sizes efficiently", () => {
      const largeDataset = Array.from({ length: 1000 }, (_, i) => ({
        name: `item${i.toString().padStart(4, "0")}`,
      }));

      const startTime = performance.now();
      const result = fuzzyFind(largeDataset, "item");
      const endTime = performance.now();

      expect(result.length).toBeGreaterThan(0);
      expect(endTime - startTime).toBeLessThan(100); // Should complete in < 100ms
    });
  });

  describe("type safety", () => {
    it("should work with readonly arrays", () => {
      const readonlyItems = testItems as readonly TestItem[];
      const result = fuzzyFind(readonlyItems, "apple");
      expect(result.length).toBeGreaterThan(0);
    });

    it("should preserve item type in results", () => {
      const result = fuzzyFind(testItems, "apple");
      expect(result[0].item).toHaveProperty("name");
      expect(result[0].item).toHaveProperty("description");
    });
  });
});
