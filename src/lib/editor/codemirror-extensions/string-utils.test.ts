import { describe, expect, it } from "vitest";
import {
  analyzeDelimiters,
  findNumberBoundaries,
  findTagBoundaries,
  formatNumberWithPrecision,
} from "./string-utils.js";

describe("findNumberBoundaries", () => {
  it("should find number at exact position", () => {
    const text = "hello 123.45 world";
    const result = findNumberBoundaries(text, 8);
    expect(result).toEqual({
      start: 6,
      end: 12,
      content: "123.45",
    });
  });

  it("should find number when cursor is at start", () => {
    const text = "123.45 world";
    const result = findNumberBoundaries(text, 0);
    expect(result).toEqual({
      start: 0,
      end: 6,
      content: "123.45",
    });
  });

  it("should find number when cursor is at end", () => {
    const text = "hello 123.45";
    const result = findNumberBoundaries(text, 12);
    expect(result).toEqual({
      start: 6,
      end: 12,
      content: "123.45",
    });
  });

  it("should find negative numbers", () => {
    const text = "weight: -0.5";
    const result = findNumberBoundaries(text, 10);
    expect(result).toEqual({
      start: 8,
      end: 12,
      content: "-0.5",
    });
  });

  it("should find integers", () => {
    const text = "count: 42";
    const result = findNumberBoundaries(text, 7);
    expect(result).toEqual({
      start: 7,
      end: 9,
      content: "42",
    });
  });

  it("should return null for invalid numbers", () => {
    const text = "abc123def";
    const result = findNumberBoundaries(text, 4);
    expect(result).toBeNull();
  });

  it("should return null when not at a number", () => {
    const text = "hello world";
    const result = findNumberBoundaries(text, 5);
    expect(result).toBeNull();
  });

  it("should return null for malformed numbers", () => {
    const text = "1.2.3";
    const result = findNumberBoundaries(text, 2);
    expect(result).toBeNull();
  });
});

describe("findTagBoundaries", () => {
  it("should find tag boundaries between commas", () => {
    const text = "1girl, looking_at_viewer, smile";
    const result = findTagBoundaries(text, 15);
    expect(result).toEqual({
      start: 7,
      end: 24,
      content: "looking_at_viewer",
    });
  });

  it("should handle tag at start", () => {
    const text = "1girl, looking_at_viewer";
    const result = findTagBoundaries(text, 2);
    expect(result).toEqual({
      start: 0,
      end: 5,
      content: "1girl",
    });
  });

  it("should handle tag at end", () => {
    const text = "1girl, smile";
    const result = findTagBoundaries(text, 10);
    expect(result).toEqual({
      start: 7,
      end: 12,
      content: "smile",
    });
  });

  it("should trim whitespace", () => {
    const text = "1girl,   looking_at_viewer  , smile";
    const result = findTagBoundaries(text, 15);
    expect(result).toEqual({
      start: 9,
      end: 26,
      content: "looking_at_viewer",
    });
  });

  it("should handle newlines as delimiters", () => {
    const text = "1girl\nlooking_at_viewer\nsmile";
    const result = findTagBoundaries(text, 10);
    expect(result).toEqual({
      start: 6,
      end: 23,
      content: "looking_at_viewer",
    });
  });

  it("should handle single tag", () => {
    const text = "1girl";
    const result = findTagBoundaries(text, 2);
    expect(result).toEqual({
      start: 0,
      end: 5,
      content: "1girl",
    });
  });

  it("should handle tags with parentheses", () => {
    const text = "1girl, (detailed face:1.2), smile";
    const result = findTagBoundaries(text, 15);
    expect(result).toEqual({
      start: 7,
      end: 26,
      content: "(detailed face:1.2)",
    });
  });
});

describe("analyzeDelimiters", () => {
  it("should analyze simple tag without delimiters", () => {
    const lineText = "1girl, looking_at_viewer, smile";
    const result = analyzeDelimiters(lineText, 7, 24);
    expect(result.missingSuffix).toBe("");
    expect(result.delimStart).toBe(7);
    expect(result.contentStart).toBe(7);
  });

  it("should identify delimiter structure (basic functionality)", () => {
    const lineText = "1girl, (detailed), smile";
    const result = analyzeDelimiters(lineText, 7, 17);
    expect(result.delimStart).toBe(7);
    expect(result.contentStart).toBe(8);
    expect(result.expectedSuffixRev).toBe(")");
  });

  it("should work with actual usage pattern", () => {
    // Test with a realistic case from autocompletion
    const lineText = "1girl, looking_at_viewer";
    const result = analyzeDelimiters(lineText, 7, 24);
    expect(result.delimStart).toBe(7);
    expect(result.contentStart).toBe(7);
    expect(result.missingSuffix).toBe("");
  });
});

describe("formatNumberWithPrecision", () => {
  it("should preserve decimal places", () => {
    const result = formatNumberWithPrecision(1.234, "1.23");
    expect(result).toBe("1.23");
  });

  it("should use minimum 1 decimal place for integers", () => {
    const result = formatNumberWithPrecision(5, "3");
    expect(result).toBe("5.0");
  });

  it("should handle high precision", () => {
    const result = formatNumberWithPrecision(1.23456, "1.2345");
    expect(result).toBe("1.2346");
  });

  it("should handle zero precision with minimum", () => {
    const result = formatNumberWithPrecision(1.5, "1");
    expect(result).toBe("1.5");
  });

  it("should handle negative numbers", () => {
    const result = formatNumberWithPrecision(-0.75, "-0.5");
    expect(result).toBe("-0.8");
  });
});
