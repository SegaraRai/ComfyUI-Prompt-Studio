import { describe, expect, it } from "vitest";
import { normalizeForQuery } from "./normalize.js";

describe("normalize functionality", () => {
  describe("normalizeForQuery", () => {
    it("should trim whitespace from both ends", () => {
      expect(normalizeForQuery("  hello  ")).toBe("hello");
      expect(normalizeForQuery("\t\nworld\t\n")).toBe("world");
      expect(normalizeForQuery("   spaced   text   ")).toBe("spaced   text");
    });

    it("should replace underscores with spaces", () => {
      expect(normalizeForQuery("hello_world")).toBe("hello world");
      expect(normalizeForQuery("long_tag_name")).toBe("long tag name");
      expect(normalizeForQuery("_underscore_prefix")).toBe(
        " underscore prefix",
      );
      expect(normalizeForQuery("underscore_suffix_")).toBe(
        "underscore suffix ",
      );
    });

    it("should handle multiple consecutive underscores", () => {
      expect(normalizeForQuery("hello__world")).toBe("hello  world");
      expect(normalizeForQuery("tag___name")).toBe("tag   name");
      expect(normalizeForQuery("____")).toBe("    ");
    });

    it("should apply Unicode normalization", () => {
      // Test with combining characters
      expect(normalizeForQuery("café")).toBe("café");
      expect(normalizeForQuery("naïve")).toBe("naïve");

      // Test with decomposed characters (é as e + combining acute accent)
      const decomposed = "cafe\u0301"; // e + combining acute accent
      expect(normalizeForQuery(decomposed)).toBe("café");
    });

    it("should handle empty strings", () => {
      expect(normalizeForQuery("")).toBe("");
      expect(normalizeForQuery("   ")).toBe("");
    });

    it("should handle strings with only underscores", () => {
      expect(normalizeForQuery("_")).toBe(" ");
      expect(normalizeForQuery("___")).toBe("   ");
    });

    it("should handle strings with mixed whitespace and underscores", () => {
      expect(normalizeForQuery("  hello_world  ")).toBe("hello world");
      expect(normalizeForQuery("\t_tag_name_\n")).toBe(" tag name ");
    });

    it("should handle special characters", () => {
      expect(normalizeForQuery("tag@#$%^&*()")).toBe("tag@#$%^&*()");
      expect(normalizeForQuery("tag_with_symbols!@#")).toBe(
        "tag with symbols!@#",
      );
    });

    it("should handle numbers", () => {
      expect(normalizeForQuery("123_456")).toBe("123 456");
      expect(normalizeForQuery("tag_123")).toBe("tag 123");
      expect(normalizeForQuery("123")).toBe("123");
    });

    it("should handle parentheses and brackets", () => {
      expect(normalizeForQuery("(tag_name)")).toBe("(tag name)");
      expect(normalizeForQuery("[tag_name]")).toBe("[tag name]");
      expect(normalizeForQuery("tag_(special)_name")).toBe(
        "tag (special) name",
      );
    });

    it("should handle mixed case", () => {
      expect(normalizeForQuery("Hello_World")).toBe("Hello World");
      expect(normalizeForQuery("CamelCase_with_underscore")).toBe(
        "CamelCase with underscore",
      );
    });

    it("should handle Unicode characters", () => {
      expect(normalizeForQuery("こんにちは_世界")).toBe("こんにちは 世界");
      expect(normalizeForQuery("тест_текст")).toBe("тест текст");
      expect(normalizeForQuery("emoji_😊_test")).toBe("emoji 😊 test");
    });

    it("should handle complex mixed scenarios", () => {
      expect(normalizeForQuery("  _complex_tag_name_  ")).toBe(
        " complex tag name ",
      );
      expect(normalizeForQuery("\t\nlong_tag_with_many_underscores\t\n")).toBe(
        "long tag with many underscores",
      );
    });

    it("should handle single characters", () => {
      expect(normalizeForQuery("a")).toBe("a");
      expect(normalizeForQuery("_")).toBe(" ");
      expect(normalizeForQuery(" ")).toBe("");
    });

    it("should handle strings with no underscores", () => {
      expect(normalizeForQuery("hello world")).toBe("hello world");
      expect(normalizeForQuery("  hello world  ")).toBe("hello world");
    });

    it("should handle strings with no whitespace", () => {
      expect(normalizeForQuery("hello_world")).toBe("hello world");
      expect(normalizeForQuery("tag_name")).toBe("tag name");
    });

    it("should handle very long strings", () => {
      const longString = "very_long_tag_name_with_many_underscores_and_words";
      const expected = "very long tag name with many underscores and words";
      expect(normalizeForQuery(longString)).toBe(expected);
    });

    it("should handle strings with newlines and tabs", () => {
      expect(normalizeForQuery("hello\nworld")).toBe("hello\nworld");
      expect(normalizeForQuery("hello\tworld")).toBe("hello\tworld");
      expect(normalizeForQuery("  hello\n_world\t  ")).toBe("hello\n world");
    });

    it("should be consistent with multiple calls", () => {
      const input = "  test_tag_name  ";
      const expected = "test tag name";
      expect(normalizeForQuery(input)).toBe(expected);
      expect(normalizeForQuery(input)).toBe(expected);
      expect(normalizeForQuery(normalizeForQuery(input))).toBe(expected);
    });

    it("should handle edge cases with Unicode normalization", () => {
      // Test with different Unicode normalization forms
      const nfc = "é"; // NFC form (composed)
      const nfd = "e\u0301"; // NFD form (decomposed)

      expect(normalizeForQuery(nfc)).toBe("é");
      expect(normalizeForQuery(nfd)).toBe("é");
      expect(normalizeForQuery(nfc)).toBe(normalizeForQuery(nfd));
    });

    it("should handle combination of all transformations", () => {
      const input = "  café_naïve_test_  ";
      const expected = "café naïve test "; // trailing underscore becomes trailing space
      expect(normalizeForQuery(input)).toBe(expected);
    });

    it("should handle strings with only whitespace and underscores", () => {
      expect(normalizeForQuery("  _  _  ")).toBe("    "); // trim removes outer spaces, underscores become spaces
      expect(normalizeForQuery("\t_\n_\r")).toBe(" \n "); // trim removes outer whitespace, underscores become spaces
    });
  });
});
