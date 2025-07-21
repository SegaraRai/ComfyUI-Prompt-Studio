import { describe, expect, it } from "vitest";
import { categoryToId } from "./category.js";

describe("category functionality", () => {
  describe("categoryToId", () => {
    it("should return correct IDs for known categories", () => {
      expect(categoryToId(0)).toBe("general");
      expect(categoryToId(1)).toBe("artist");
      expect(categoryToId(3)).toBe("copyright");
      expect(categoryToId(4)).toBe("character");
      expect(categoryToId(5)).toBe("meta");
    });

    it("should return 'unknown' for unknown categories", () => {
      expect(categoryToId(2)).toBe("unknown");
      expect(categoryToId(6)).toBe("unknown");
      expect(categoryToId(10)).toBe("unknown");
      expect(categoryToId(-1)).toBe("unknown");
    });

    it("should handle edge cases", () => {
      expect(categoryToId(999)).toBe("unknown");
      expect(categoryToId(Number.MAX_SAFE_INTEGER)).toBe("unknown");
      expect(categoryToId(Number.MIN_SAFE_INTEGER)).toBe("unknown");
    });
  });
});
