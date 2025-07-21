import { describe, expect, it } from "vitest";
import { embedOriginalPrompt, extractOriginalPrompt } from "./restoration.js";

describe("restoration functions (browser)", () => {
  describe("embedOriginalPrompt", () => {
    it("should embed original prompt into compiled prompt", async () => {
      const originalPrompt = "1girl, smile, looking at viewer";
      const compiledPrompt =
        "masterpiece, best quality, 1girl, smile, looking at viewer";

      const result = await embedOriginalPrompt(
        originalPrompt,
        compiledPrompt,
        null,
      );

      expect(result).toContain(compiledPrompt);
      expect(result).toMatch(/\/\*# PROMPT_STUDIO_SRC: .+ \*\/$/);
    });

    it("should handle empty original prompt", async () => {
      const originalPrompt = "";
      const compiledPrompt = "masterpiece, best quality";

      const result = await embedOriginalPrompt(
        originalPrompt,
        compiledPrompt,
        null,
      );

      expect(result).toContain(compiledPrompt);
      expect(result).toMatch(/\/\*# PROMPT_STUDIO_SRC: .+ \*\/$/);
    });

    it("should handle multiline original prompt", async () => {
      const originalPrompt = "1girl, smile\nlooking at viewer\n// comment";
      const compiledPrompt =
        "masterpiece, best quality, 1girl, smile, looking at viewer";

      const result = await embedOriginalPrompt(
        originalPrompt,
        compiledPrompt,
        null,
      );

      expect(result).toContain(compiledPrompt);
      expect(result).toMatch(/\/\*# PROMPT_STUDIO_SRC: .+ \*\/$/);
    });

    it("should handle special characters in original prompt", async () => {
      const originalPrompt =
        "1girl, (smile:1.2), [[background]], <lora:test:0.8>";
      const compiledPrompt =
        "masterpiece, best quality, 1girl, (smile:1.2), [[background]], <lora:test:0.8>";

      const result = await embedOriginalPrompt(
        originalPrompt,
        compiledPrompt,
        null,
      );

      expect(result).toContain(compiledPrompt);
      expect(result).toMatch(/\/\*# PROMPT_STUDIO_SRC: .+ \*\/$/);
    });

    it("should handle unicode characters", async () => {
      const originalPrompt = "1girl, 笑顔, 日本語, émoji: 😊";
      const compiledPrompt =
        "masterpiece, best quality, 1girl, 笑顔, 日本語, émoji: 😊";

      const result = await embedOriginalPrompt(
        originalPrompt,
        compiledPrompt,
        null,
      );

      expect(result).toContain(compiledPrompt);
      expect(result).toMatch(/\/\*# PROMPT_STUDIO_SRC: .+ \*\/$/);
    });

    it("should trim whitespace from result", async () => {
      const originalPrompt = "1girl, smile";
      const compiledPrompt = "masterpiece, best quality, 1girl, smile";

      const result = await embedOriginalPrompt(
        originalPrompt,
        compiledPrompt,
        null,
      );

      expect(result).not.toMatch(/^\s/);
      expect(result).not.toMatch(/\s$/);
    });
  });

  describe("extractOriginalPrompt", () => {
    it("should extract original prompt from embedded text", async () => {
      const originalPrompt = "1girl, smile, looking at viewer";
      const compiledPrompt =
        "masterpiece, best quality, 1girl, smile, looking at viewer";

      const embedded = await embedOriginalPrompt(
        originalPrompt,
        compiledPrompt,
        null,
      );
      const extracted = await extractOriginalPrompt(embedded, null);

      expect(extracted).toBe(originalPrompt);
    });

    it("should return null when no embedded source is found", async () => {
      const textWithoutEmbedded =
        "masterpiece, best quality, 1girl, smile, looking at viewer";

      const result = await extractOriginalPrompt(textWithoutEmbedded, null);

      expect(result).toBeNull();
    });

    it("should handle multiline original prompt extraction", async () => {
      const originalPrompt = "1girl, smile\nlooking at viewer\n// comment";
      const compiledPrompt =
        "masterpiece, best quality, 1girl, smile, looking at viewer";

      const embedded = await embedOriginalPrompt(
        originalPrompt,
        compiledPrompt,
        null,
      );
      const extracted = await extractOriginalPrompt(embedded, null);

      expect(extracted).toBe(originalPrompt);
    });

    it("should handle special characters in extracted prompt", async () => {
      const originalPrompt =
        "1girl, (smile:1.2), [[background]], <lora:test:0.8>";
      const compiledPrompt =
        "masterpiece, best quality, 1girl, (smile:1.2), [[background]], <lora:test:0.8>";

      const embedded = await embedOriginalPrompt(
        originalPrompt,
        compiledPrompt,
        null,
      );
      const extracted = await extractOriginalPrompt(embedded, null);

      expect(extracted).toBe(originalPrompt);
    });

    it("should handle unicode characters in extracted prompt", async () => {
      const originalPrompt = "1girl, 笑顔, 日本語, émoji: 😊";
      const compiledPrompt =
        "masterpiece, best quality, 1girl, 笑顔, 日本語, émoji: 😊";

      const embedded = await embedOriginalPrompt(
        originalPrompt,
        compiledPrompt,
        null,
      );
      const extracted = await extractOriginalPrompt(embedded, null);

      expect(extracted).toBe(originalPrompt);
    });

    it("should handle empty original prompt extraction", async () => {
      const originalPrompt = "";
      const compiledPrompt = "masterpiece, best quality";

      const embedded = await embedOriginalPrompt(
        originalPrompt,
        compiledPrompt,
        null,
      );
      const extracted = await extractOriginalPrompt(embedded, null);

      expect(extracted).toBe(originalPrompt);
    });

    it("should return null for malformed embedded source", async () => {
      const malformedText =
        "masterpiece, best quality /*# PROMPT_STUDIO_SRC: invalid_data";

      const result = await extractOriginalPrompt(malformedText, null);

      expect(result).toBeNull();
    });

    it("should handle text with multiple comment blocks", async () => {
      const originalPrompt = "1girl, smile";
      const compiledPrompt = "masterpiece, best quality, 1girl, smile";

      const embedded = await embedOriginalPrompt(
        originalPrompt,
        compiledPrompt,
        null,
      );
      const textWithMultipleComments = `${embedded}\n/* regular comment */\n/* another comment */`;
      const extracted = await extractOriginalPrompt(
        textWithMultipleComments,
        null,
      );

      expect(extracted).toBe(originalPrompt);
    });
  });

  describe("round-trip tests", () => {
    it("should preserve original prompt through embed/extract cycle", async () => {
      const testCases = [
        "1girl, smile, looking at viewer",
        "1girl, smile\nlooking at viewer\n// comment",
        "1girl, (smile:1.2), [[background]], <lora:test:0.8>",
        "1girl, 笑顔, 日本語, émoji: 😊",
        "",
        "very long prompt with many tags, ".repeat(50),
      ];

      for (const originalPrompt of testCases) {
        const compiledPrompt = `masterpiece, best quality, ${originalPrompt}`;

        const embedded = await embedOriginalPrompt(
          originalPrompt,
          compiledPrompt,
          null,
        );
        const extracted = await extractOriginalPrompt(embedded, null);

        expect(extracted).toBe(originalPrompt);
      }
    });

    it("should handle large prompts", async () => {
      const largePrompt = "tag".repeat(10000);
      const compiledPrompt = `masterpiece, best quality, ${largePrompt}`;

      const embedded = await embedOriginalPrompt(
        largePrompt,
        compiledPrompt,
        null,
      );
      const extracted = await extractOriginalPrompt(embedded, null);

      expect(extracted).toBe(largePrompt);
    });
  });

  describe("error handling", () => {
    it("should handle extraction with corrupted embedded data gracefully", async () => {
      const textWithCorruptedData =
        "masterpiece, best quality\n\n/*# PROMPT_STUDIO_SRC: corrupted_base64_data */";

      const result = await extractOriginalPrompt(textWithCorruptedData, null);

      expect(result).toBeNull();
    });

    it("should handle embed operation when encoding might fail", async () => {
      const originalPrompt = "1girl, smile";
      const compiledPrompt = "masterpiece, best quality, 1girl, smile";

      const result = await embedOriginalPrompt(
        originalPrompt,
        compiledPrompt,
        null,
      );

      expect(result).toBeDefined();
      expect(typeof result).toBe("string");
    });
  });
});
