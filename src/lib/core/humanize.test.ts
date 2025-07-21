import { describe, expect, it } from "vitest";
import { humanizeCount } from "./humanize.js";

describe("humanize functionality", () => {
  describe("humanizeCount", () => {
    it("should return count as string for numbers under 1000", () => {
      expect(humanizeCount(0)).toBe("0");
      expect(humanizeCount(1)).toBe("1");
      expect(humanizeCount(999)).toBe("999");
    });

    it("should format thousands with 'k' suffix", () => {
      expect(humanizeCount(1000)).toBe("1.0k");
      expect(humanizeCount(1500)).toBe("1.5k");
      expect(humanizeCount(10000)).toBe("10.0k");
      expect(humanizeCount(999999)).toBe("1000.0k");
    });

    it("should format millions with 'm' suffix", () => {
      expect(humanizeCount(1_000_000)).toBe("1.0m");
      expect(humanizeCount(1_500_000)).toBe("1.5m");
      expect(humanizeCount(10_000_000)).toBe("10.0m");
      expect(humanizeCount(999_999_999)).toBe("1000.0m");
    });

    it("should format billions with 'b' suffix", () => {
      expect(humanizeCount(1_000_000_000)).toBe("1.0b");
      expect(humanizeCount(1_500_000_000)).toBe("1.5b");
      expect(humanizeCount(10_000_000_000)).toBe("10.0b");
    });

    it("should handle edge cases", () => {
      expect(humanizeCount(1001)).toBe("1.0k");
      expect(humanizeCount(1_000_001)).toBe("1.0m");
      expect(humanizeCount(1_000_000_001)).toBe("1.0b");
    });

    it("should handle decimal rounding correctly", () => {
      expect(humanizeCount(1234)).toBe("1.2k");
      expect(humanizeCount(1678)).toBe("1.7k");
      expect(humanizeCount(1_234_567)).toBe("1.2m");
      expect(humanizeCount(1_678_901_234)).toBe("1.7b");
    });
  });
});
