import { describe, expect, it } from "vitest";
import {
  findTokenRanges,
  parseTag,
  parseToken,
  stringifyTag,
} from "./tokenizer.js";

describe("tokenizer functionality", () => {
  describe("parseTag", () => {
    it("should parse normal tags", () => {
      const tag = parseTag("1girl");
      expect(tag).toEqual({
        notation: "default",
        type: "normal",
        prefix: "",
        name: "1girl",
        weight: 1,
        precision: null,
      });
    });

    it("should parse chant tags", () => {
      const tag = parseTag("@quality");
      expect(tag).toEqual({
        notation: "default",
        type: "chant",
        prefix: "@",
        name: "quality",
        weight: 1,
        precision: null,
      });
    });

    it("should parse complex chant tags with colons and weights", () => {
      const tag1 = parseTag("(@foo:bar:1)");
      expect(tag1).toEqual({
        notation: "default",
        type: "chant",
        prefix: "@",
        name: "foo:bar",
        weight: 1,
        precision: 0,
      });

      const tag2 = parseTag("(@foo:bar2:2.5)");
      expect(tag2).toEqual({
        notation: "default",
        type: "chant",
        prefix: "@",
        name: "foo:bar2",
        weight: 2.5,
        precision: 1,
      });

      const tag3 = parseTag("(@foo:bar3)");
      expect(tag3).toEqual({
        notation: "default",
        type: "chant",
        prefix: "@",
        name: "foo:bar3",
        weight: 1.1,
        precision: null,
      });
    });

    it("should parse embedding tags", () => {
      const tag = parseTag("<embedding:example>");
      expect(tag).toEqual({
        notation: "default",
        type: "embedding",
        prefix: "embedding:",
        name: "example",
        weight: 1.0,
        precision: null,
      });
    });

    it("should parse embedding tags with weight", () => {
      const tag = parseTag("<embedding:example:0.8>");
      expect(tag).toEqual({
        notation: "default",
        type: "embedding",
        prefix: "embedding:",
        name: "example",
        weight: 0.8,
        precision: 1,
      });
    });

    it("should parse minus prefix embedding tags for erasure", () => {
      const tag = parseTag("-<embedding:example>");
      expect(tag).toEqual({
        notation: "default",
        type: "embedding",
        prefix: "embedding:",
        name: "example",
        weight: 0.0,
        precision: null,
      });
    });

    it("should parse minus prefix embedding tags with weight (minus overrides)", () => {
      const tag = parseTag("-<embedding:example:0.8>");
      expect(tag).toEqual({
        notation: "default",
        type: "embedding",
        prefix: "embedding:",
        name: "example",
        weight: 0.0,
        precision: 1,
      });
    });

    it("should parse LoRA tags", () => {
      const tag = parseTag("<lora:example.safetensors:0.8>");
      expect(tag).toEqual({
        notation: "lora",
        type: "lora",
        prefix: "lora:",
        name: "example.safetensors",
        weight: 0.8,
        precision: 1,
        extra: "",
      });
    });

    it("should parse LoRA tags with extra parameters", () => {
      const tag = parseTag("<lora:example.safetensors:0.8:extra>");
      expect(tag).toEqual({
        notation: "lora",
        type: "lora",
        prefix: "lora:",
        name: "example.safetensors",
        weight: 0.8,
        precision: 1,
        extra: ":extra",
      });
    });

    it("should parse LoRA tags without weight", () => {
      const tag = parseTag("<lora:example.safetensors>");
      expect(tag).toEqual({
        notation: "lora",
        type: "lora",
        prefix: "lora:",
        name: "example.safetensors",
        weight: 1.0,
        precision: null,
        extra: "",
      });
    });

    it("should parse minus prefix LoRA tags for erasure", () => {
      const tag = parseTag("-<lora:example.safetensors>");
      expect(tag).toEqual({
        notation: "lora",
        type: "lora",
        prefix: "lora:",
        name: "example.safetensors",
        weight: 0.0,
        precision: null,
        extra: "",
      });
    });

    it("should parse minus prefix LoRA tags with weight (minus overrides)", () => {
      const tag = parseTag("-<lora:example.safetensors:0.8>");
      expect(tag).toEqual({
        notation: "lora",
        type: "lora",
        prefix: "lora:",
        name: "example.safetensors",
        weight: 0.0,
        precision: 1,
        extra: "",
      });
    });

    it("should parse minus prefix LoRA tags with extra parameters", () => {
      const tag = parseTag("-<lora:example.safetensors:0.8:extra>");
      expect(tag).toEqual({
        notation: "lora",
        type: "lora",
        prefix: "lora:",
        name: "example.safetensors",
        weight: 0.0,
        precision: 1,
        extra: ":extra",
      });
    });

    it("should parse weight tags", () => {
      const tag = parseTag("(smile:0.9)");
      expect(tag).toEqual({
        notation: "default",
        type: "normal",
        prefix: "",
        name: "smile",
        weight: 0.9,
        precision: 1,
      });
    });

    it("should parse parentheses modifiers", () => {
      const tag = parseTag("((smile))");
      expect(tag).toEqual({
        notation: "default",
        type: "normal",
        prefix: "",
        name: "smile",
        weight: 1.2100000000000002, // 1.1 * 1.1, but with floating point precision
        precision: null,
      });
    });

    it("should parse bracket modifiers", () => {
      const tag = parseTag("[smile]");
      expect(tag).toEqual({
        notation: "default",
        type: "normal",
        prefix: "",
        name: "smile",
        weight: 0.9,
        precision: null,
      });
    });

    it("should parse negative tags", () => {
      const tag = parseTag("-bad_quality");
      expect(tag).toEqual({
        notation: "default",
        type: "normal",
        prefix: "",
        name: "bad_quality",
        weight: 0,
        precision: null,
      });
    });

    it("should handle malformed bracket tags", () => {
      const tag = parseTag("((smile)");
      expect(tag).toEqual({
        notation: "default",
        type: "normal",
        prefix: "",
        name: "((smile)",
        weight: 1,
        precision: null,
      });
    });

    it("should handle empty input", () => {
      expect(parseTag("")).toBeNull();
      expect(parseTag("   ")).toBeNull();
    });

    it("should handle mixed bracket types", () => {
      const tag = parseTag("([smile])");
      expect(tag).toEqual({
        notation: "default",
        type: "normal",
        prefix: "",
        name: "smile",
        weight: 0.9900000000000001, // 1.1 * 0.9, but with floating point precision
        precision: null,
      });
    });
  });

  describe("parseToken", () => {
    it("should parse chant markers", () => {
      const token = parseToken("@@quality");
      expect(token).toEqual({
        type: "chant_marker",
        name: "quality",
      });
    });

    it("should fall back to parsing as tag", () => {
      const token = parseToken("1girl");
      expect(token).toEqual({
        notation: "default",
        type: "normal",
        prefix: "",
        name: "1girl",
        weight: 1,
        precision: null,
      });
    });

    it("should handle empty input", () => {
      expect(parseToken("")).toBeNull();
      expect(parseToken("   ")).toBeNull();
    });
  });

  describe("stringifyTag", () => {
    it("should stringify normal tags", () => {
      const tag = {
        notation: "default" as const,
        type: "normal" as const,
        prefix: "" as const,
        name: "1girl",
        weight: 1.0,
        precision: 2,
      };
      expect(stringifyTag(tag)).toBe("1girl");
    });

    it("should stringify tags with weights", () => {
      const tag = {
        notation: "default" as const,
        type: "normal" as const,
        prefix: "" as const,
        name: "smile",
        weight: 0.9,
        precision: 1,
      };
      expect(stringifyTag(tag)).toBe("(smile:0.9)");
    });

    it("should stringify negative tags", () => {
      const tag = {
        notation: "default" as const,
        type: "normal" as const,
        prefix: "" as const,
        name: "bad_quality",
        weight: 0.0,
        precision: 2,
      };
      expect(stringifyTag(tag)).toBe("-bad_quality");
    });

    it("should stringify LoRA tags", () => {
      const tag = {
        notation: "lora" as const,
        type: "lora" as const,
        prefix: "lora:" as const,
        name: "example.safetensors",
        weight: 0.8,
        precision: 1,
        extra: "",
      };
      expect(stringifyTag(tag)).toBe("<lora:example.safetensors:0.8>");
    });

    it("should stringify LoRA tags with extra parameters", () => {
      const tag = {
        notation: "lora" as const,
        type: "lora" as const,
        prefix: "lora:" as const,
        name: "example.safetensors",
        weight: 0.8,
        precision: 1,
        extra: ":extra",
      };
      expect(stringifyTag(tag)).toBe("<lora:example.safetensors:0.8:extra>");
    });

    it("should stringify chant tags", () => {
      const tag = {
        notation: "default" as const,
        type: "chant" as const,
        prefix: "@" as const,
        name: "quality",
        weight: 1.0,
        precision: 2,
      };
      expect(stringifyTag(tag)).toBe("@quality");
    });

    it("should stringify embedding tags", () => {
      const tag = {
        notation: "default" as const,
        type: "embedding" as const,
        prefix: "embedding:" as const,
        name: "example",
        weight: 0.9,
        precision: 1,
      };
      expect(stringifyTag(tag)).toBe("<embedding:example:0.9>");
    });

    it("should handle precision formatting", () => {
      const tag = {
        notation: "default" as const,
        type: "normal" as const,
        prefix: "" as const,
        name: "smile",
        weight: 0.75,
        precision: 2,
      };
      expect(stringifyTag(tag)).toBe("(smile:0.75)");
    });

    it("should remove trailing zeros", () => {
      const tag = {
        notation: "default" as const,
        type: "normal" as const,
        prefix: "" as const,
        name: "smile",
        weight: 0.5,
        precision: 3,
      };
      expect(stringifyTag(tag)).toBe("(smile:0.5)");
    });
  });

  describe("findTokenRanges", () => {
    it("should find single token", () => {
      const ranges = findTokenRanges("1girl");
      expect(ranges).toHaveLength(1);
      expect(ranges[0]).toEqual({
        text: "1girl",
        token: {
          notation: "default",
          type: "normal",
          prefix: "",
          name: "1girl",
          weight: 1,
          precision: null,
        },
        start: 0,
        end: 5,
      });
    });

    it("should find multiple tokens separated by commas", () => {
      const ranges = findTokenRanges("1girl, smile");
      expect(ranges).toHaveLength(2);
      expect(ranges[0].text).toBe("1girl");
      expect(ranges[1].text).toBe("smile");
    });

    it("should find tokens separated by newlines", () => {
      const ranges = findTokenRanges("1girl\nsmile");
      expect(ranges).toHaveLength(2);
      expect(ranges[0].text).toBe("1girl");
      expect(ranges[1].text).toBe("smile");
    });

    it("should handle whitespace correctly", () => {
      const ranges = findTokenRanges("  1girl  ,  smile  ");
      expect(ranges).toHaveLength(2);
      expect(ranges[0].text).toBe("1girl");
      expect(ranges[1].text).toBe("smile");
    });

    it("should handle empty input", () => {
      expect(findTokenRanges("")).toHaveLength(0);
    });

    it("should handle chant markers", () => {
      const ranges = findTokenRanges("@@quality");
      expect(ranges).toHaveLength(1);
      expect(ranges[0].token).toEqual({
        type: "chant_marker",
        name: "quality",
      });
    });

    it("should preserve correct start/end positions", () => {
      const text = "1girl, smile, long hair";
      const ranges = findTokenRanges(text);

      expect(ranges).toHaveLength(3);
      expect(text.substring(ranges[0].start, ranges[0].end)).toBe("1girl");
      expect(text.substring(ranges[1].start, ranges[1].end)).toBe("smile");
      expect(text.substring(ranges[2].start, ranges[2].end)).toBe("long hair");
    });

    it("should handle mixed tokens, chant markers, colons, etc.", () => {
      const text =
        "1girl, @@quality, smile, (@foo:bar:1), <embedding:example:0.8>";
      const ranges = findTokenRanges(text);

      expect(ranges).toHaveLength(5);
      expect(text.substring(ranges[0].start, ranges[0].end)).toBe("1girl");
      expect(text.substring(ranges[1].start, ranges[1].end)).toBe("@@quality");
      expect(text.substring(ranges[2].start, ranges[2].end)).toBe("smile");
      expect(text.substring(ranges[3].start, ranges[3].end)).toBe(
        "(@foo:bar:1)",
      );
      expect(text.substring(ranges[4].start, ranges[4].end)).toBe(
        "<embedding:example:0.8>",
      );
    });
  });
});
