import { describe, expect, it } from "vitest";
import { embedOriginalPrompt, extractOriginalPrompt, type RestorationResult } from "./restoration.js";

describe("restoration functions (browser)", () => {
  describe("embedOriginalPrompt", () => {
    it("should embed original prompt into compiled prompt with FILE_DATA format when enabled", async () => {
      const originalPrompt = "1girl, smile, looking at viewer";
      const compiledPrompt =
        "masterpiece, best quality, 1girl, smile, looking at viewer";
      const filename = "test.txt";

      const result = await embedOriginalPrompt(
        originalPrompt,
        compiledPrompt,
        filename,
        { encodeOriginalForLinkedFiles: true },
      );

      expect(result).toContain(compiledPrompt);
      expect(result).toMatch(/\/\*# PROMPT_STUDIO_SRC: FILE_DATA:.+ \*\/$/);
      expect(result).toContain(`FILE_DATA:${encodeURIComponent(filename)}:`);
    });

    it("should use legacy FILE format when encodeOriginalForLinkedFiles is false", async () => {
      const originalPrompt = "1girl, smile, looking at viewer";
      const compiledPrompt =
        "masterpiece, best quality, 1girl, smile, looking at viewer";
      const filename = "test.txt";

      const result = await embedOriginalPrompt(
        originalPrompt,
        compiledPrompt,
        filename,
        { encodeOriginalForLinkedFiles: false },
      );

      expect(result).toContain(compiledPrompt);
      expect(result).toMatch(/\/\*# PROMPT_STUDIO_SRC: FILE:.+ \*\/$/);
      expect(result).toContain(`FILE:${encodeURIComponent(filename)}`);
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

    it("should extract original prompt from FILE_DATA format", async () => {
      const originalPrompt = "1girl, smile, looking at viewer";
      const compiledPrompt =
        "masterpiece, best quality, 1girl, smile, looking at viewer";
      const filename = "test.txt";

      const embedded = await embedOriginalPrompt(
        originalPrompt,
        compiledPrompt,
        filename,
        { encodeOriginalForLinkedFiles: true },
      );
      const extracted = await extractOriginalPrompt(embedded, null);

      expect(extracted).toBe(originalPrompt);
    });

    it("should detect conflicts when using FILE_DATA format", async () => {
      const originalPrompt = "1girl, smile, looking at viewer";
      const compiledPrompt =
        "masterpiece, best quality, 1girl, smile, looking at viewer";
      const filename = "test.txt";
      const currentFileContent = "1girl, different expression, standing";

      const embedded = await embedOriginalPrompt(
        originalPrompt,
        compiledPrompt,
        filename,
        { encodeOriginalForLinkedFiles: true },
      );

      const mockFileAPI = {
        load: async (name: string) => {
          if (name === filename) {
            return currentFileContent;
          }
          throw new Error("File not found");
        },
      };

      const result: RestorationResult | null = await extractOriginalPrompt(
        embedded,
        mockFileAPI,
        true,
      );

      expect(result).not.toBeNull();
      expect(result!.originalPrompt).toBe(originalPrompt);
      expect(result!.conflict).toBeDefined();
      expect(result!.conflict!.savedPrompt).toBe(originalPrompt);
      expect(result!.conflict!.currentFileContent).toBe(currentFileContent);
      expect(result!.conflict!.filename).toBe(filename);
    });

    it("should not detect conflicts when content matches", async () => {
      const originalPrompt = "1girl, smile, looking at viewer";
      const compiledPrompt =
        "masterpiece, best quality, 1girl, smile, looking at viewer";
      const filename = "test.txt";

      const embedded = await embedOriginalPrompt(
        originalPrompt,
        compiledPrompt,
        filename,
        { encodeOriginalForLinkedFiles: true },
      );

      const mockFileAPI = {
        load: async (name: string) => {
          if (name === filename) {
            return originalPrompt; // Same content
          }
          throw new Error("File not found");
        },
      };

      const result: RestorationResult | null = await extractOriginalPrompt(
        embedded,
        mockFileAPI,
        true,
      );

      expect(result).not.toBeNull();
      expect(result!.originalPrompt).toBe(originalPrompt);
      expect(result!.conflict).toBeUndefined();
    });

    it("should handle missing files gracefully", async () => {
      const originalPrompt = "1girl, smile, looking at viewer";
      const compiledPrompt =
        "masterpiece, best quality, 1girl, smile, looking at viewer";
      const filename = "missing.txt";

      const embedded = await embedOriginalPrompt(
        originalPrompt,
        compiledPrompt,
        filename,
        { encodeOriginalForLinkedFiles: true },
      );

      const mockFileAPI = {
        load: async (name: string) => {
          throw new Error("File not found");
        },
      };

      const result: RestorationResult | null = await extractOriginalPrompt(
        embedded,
        mockFileAPI,
        true,
      );

      expect(result).not.toBeNull();
      expect(result!.originalPrompt).toBe(originalPrompt);
      expect(result!.conflict).toBeUndefined();
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
