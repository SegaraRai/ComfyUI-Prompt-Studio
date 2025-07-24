import { describe, expect, it, vi } from "vitest";
import { embedOriginalPrompt, extractOriginalPrompt, type RestorationResult } from "./restoration.js";

// Mock the WASM module for testing
vi.mock("../wasm/coding.js", () => ({
  encodeText: async (text: string) => `encoded:${btoa(text)}`,
  decodeText: async (encoded: string) => atob(encoded.replace("encoded:", "")),
}));

describe("restoration functions", () => {
  describe("embedOriginalPrompt", () => {
    it("should embed original prompt with FILE_DATA format for linked files", async () => {
      const originalPrompt = "1girl, smile, looking at viewer";
      const compiledPrompt = "masterpiece, best quality, 1girl, smile, looking at viewer";
      const filename = "test.txt";

      const result = await embedOriginalPrompt(
        originalPrompt,
        compiledPrompt,
        filename,
      );

      expect(result).toContain(compiledPrompt);
      expect(result).toMatch(/\/\*# PROMPT_STUDIO_SRC: FILE_DATA:.+ \*\/$/);
      expect(result).toContain(`FILE_DATA:${encodeURIComponent(filename)}:`);
    });

    it("should use DATA format for unlinked prompts", async () => {
      const originalPrompt = "1girl, smile, looking at viewer";
      const compiledPrompt = "masterpiece, best quality, 1girl, smile, looking at viewer";

      const result = await embedOriginalPrompt(
        originalPrompt,
        compiledPrompt,
        null,
      );

      expect(result).toContain(compiledPrompt);
      expect(result).toMatch(/\/\*# PROMPT_STUDIO_SRC: DATA:.+ \*\/$/);
    });
  });

  describe("extractOriginalPrompt", () => {
    it("should extract original prompt from FILE_DATA format", async () => {
      const originalPrompt = "1girl, smile, looking at viewer";
      const compiledPrompt = "masterpiece, best quality, 1girl, smile, looking at viewer";
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
      const compiledPrompt = "masterpiece, best quality, 1girl, smile, looking at viewer";
      const filename = "test.txt";
      const currentFileContent = "1girl, different expression, standing";

      const embedded = await embedOriginalPrompt(
        originalPrompt,
        compiledPrompt,
        filename,
      );

      const mockFileAPI = {
        load: async (name: string) => {
          if (name === filename) {
            return currentFileContent;
          }
          throw new Error("File not found");
        },
      };

      const result = await extractOriginalPrompt(embedded, mockFileAPI, true) as RestorationResult;

      expect(result).not.toBeNull();
      expect(result.originalPrompt).toBe(originalPrompt);
      expect(result.conflict).toBeDefined();
      expect(result.conflict!.savedPrompt).toBe(originalPrompt);
      expect(result.conflict!.currentFileContent).toBe(currentFileContent);
      expect(result.conflict!.filename).toBe(filename);
    });

    it("should not detect conflicts when content matches", async () => {
      const originalPrompt = "1girl, smile, looking at viewer";
      const compiledPrompt = "masterpiece, best quality, 1girl, smile, looking at viewer";
      const filename = "test.txt";

      const embedded = await embedOriginalPrompt(
        originalPrompt,
        compiledPrompt,
        filename,
      );

      const mockFileAPI = {
        load: async (name: string) => {
          if (name === filename) {
            return originalPrompt; // Same content
          }
          throw new Error("File not found");
        },
      };

      const result = await extractOriginalPrompt(embedded, mockFileAPI, true) as RestorationResult;

      expect(result).not.toBeNull();
      expect(result.originalPrompt).toBe(originalPrompt);
      expect(result.conflict).toBeUndefined();
    });

    it("should handle missing files gracefully", async () => {
      const originalPrompt = "1girl, smile, looking at viewer";
      const compiledPrompt = "masterpiece, best quality, 1girl, smile, looking at viewer";
      const filename = "missing.txt";

      const embedded = await embedOriginalPrompt(
        originalPrompt,
        compiledPrompt,
        filename,
      );

      const mockFileAPI = {
        load: async (name: string) => {
          throw new Error("File not found");
        },
      };

      const result = await extractOriginalPrompt(embedded, mockFileAPI, true) as RestorationResult;

      expect(result).not.toBeNull();
      expect(result.originalPrompt).toBe(originalPrompt);
      expect(result.conflict).toBeUndefined();
    });

    it("should handle DATA format", async () => {
      const originalPrompt = "1girl, smile, looking at viewer";
      const compiledPrompt = "masterpiece, best quality, 1girl, smile, looking at viewer";

      const embedded = await embedOriginalPrompt(
        originalPrompt,
        compiledPrompt,
        null,
      );
      const extracted = await extractOriginalPrompt(embedded, null);

      expect(extracted).toBe(originalPrompt);
    });

    it("should return null for text without embedded source", async () => {
      const textWithoutEmbedded = "masterpiece, best quality, 1girl, smile, looking at viewer";

      const result = await extractOriginalPrompt(textWithoutEmbedded, null);

      expect(result).toBeNull();
    });
  });
});