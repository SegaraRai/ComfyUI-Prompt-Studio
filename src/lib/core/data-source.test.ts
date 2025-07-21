import { describe, expect, it } from "vitest";
import {
  extractDataSources,
  normalizeDataSource,
  serializeDataSources,
  validateDataSource,
  type DataSourceSpec,
} from "./data-source.js";

describe("data-source functionality", () => {
  describe("extractDataSources", () => {
    it("should extract URLs and file paths", () => {
      const text = `
        https://example.com/data.csv
        ./local/file.csv
        /absolute/path/file.csv
        relative/file.csv
      `;

      const sources = extractDataSources(text);

      expect(sources).toHaveLength(4);
      expect(sources[0]).toEqual({
        type: "url",
        source: "https://example.com/data.csv",
      });
      expect(sources[1]).toEqual({
        type: "file",
        source: "./local/file.csv",
      });
      expect(sources[2]).toEqual({
        type: "file",
        source: "/absolute/path/file.csv",
      });
      expect(sources[3]).toEqual({
        type: "file",
        source: "relative/file.csv",
      });
    });

    it("should handle comments correctly", () => {
      const text = `
        https://example.com/data.csv # Main dataset
        # This is a comment line
        ./local/file.csv # Local backup

        # Another comment
        /absolute/path/file.csv
      `;

      const sources = extractDataSources(text);

      expect(sources).toHaveLength(3);
      expect(sources[0]).toEqual({
        type: "url",
        source: "https://example.com/data.csv",
      });
      expect(sources[1]).toEqual({
        type: "file",
        source: "./local/file.csv",
      });
      expect(sources[2]).toEqual({
        type: "file",
        source: "/absolute/path/file.csv",
      });
    });

    it("should skip empty lines", () => {
      const text = `
        https://example.com/data.csv


        ./local/file.csv

      `;

      const sources = extractDataSources(text);

      expect(sources).toHaveLength(2);
    });

    it("should handle mixed line endings", () => {
      const text =
        "https://example.com/data.csv\r\n./local/file.csv\n/absolute/path.csv";

      const sources = extractDataSources(text);

      expect(sources).toHaveLength(3);
    });

    it("should handle comment-only content", () => {
      const text = `
        # Only comments here
        # Another comment
        #
      `;

      const sources = extractDataSources(text);

      expect(sources).toHaveLength(0);
    });

    it("should handle lines with only comments after trimming", () => {
      const text = `
        https://example.com/data.csv
           # Just a comment with spaces
        ./local/file.csv
      `;

      const sources = extractDataSources(text);

      expect(sources).toHaveLength(2);
    });

    it("should handle empty input", () => {
      expect(extractDataSources("")).toEqual([]);
      expect(extractDataSources("   ")).toEqual([]);
    });

    it("should detect HTTPS URLs correctly", () => {
      const text = `
        https://secure.example.com/data.csv
        http://insecure.example.com/data.csv
        file.csv
      `;

      const sources = extractDataSources(text);

      expect(sources[0].type).toBe("url");
      expect(sources[1].type).toBe("url");
      expect(sources[2].type).toBe("file");
    });
  });

  describe("validateDataSource", () => {
    it("should validate URLs correctly", () => {
      const validUrl: DataSourceSpec = {
        type: "url",
        source: "https://example.com/data.csv",
      };
      const invalidUrl: DataSourceSpec = {
        type: "url",
        source: "not-a-url",
      };

      expect(validateDataSource(validUrl)).toBe(true);
      expect(validateDataSource(invalidUrl)).toBe(false);
    });

    it("should validate file paths correctly", () => {
      const validFile: DataSourceSpec = {
        type: "file",
        source: "./valid/file.csv",
      };
      const invalidFile: DataSourceSpec = {
        type: "file",
        source: "invalid<file>name.csv",
      };

      expect(validateDataSource(validFile)).toBe(true);
      expect(validateDataSource(invalidFile)).toBe(false);
    });

    it("should reject empty sources", () => {
      const emptyUrl: DataSourceSpec = {
        type: "url",
        source: "",
      };
      const emptyFile: DataSourceSpec = {
        type: "file",
        source: "   ",
      };

      expect(validateDataSource(emptyUrl)).toBe(false);
      expect(validateDataSource(emptyFile)).toBe(false);
    });

    it("should handle various invalid file characters", () => {
      const invalidChars = ["<", ">", ":", '"', "|", "?", "*"];

      for (const char of invalidChars) {
        const invalidFile: DataSourceSpec = {
          type: "file",
          source: `file${char}name.csv`,
        };
        expect(validateDataSource(invalidFile)).toBe(false);
      }
    });
  });

  describe("normalizeDataSource", () => {
    it("should trim whitespace from sources", () => {
      const spec: DataSourceSpec = {
        type: "file",
        source: "  ./file.csv  ",
      };

      const normalized = normalizeDataSource(spec);

      expect(normalized.source).toBe("./file.csv");
      expect(normalized.type).toBe("file");
    });

    it("should preserve type", () => {
      const urlSpec: DataSourceSpec = {
        type: "url",
        source: "  https://example.com/data.csv  ",
      };

      const normalized = normalizeDataSource(urlSpec);

      expect(normalized.type).toBe("url");
    });
  });

  describe("serializeDataSources", () => {
    it("should serialize sources to multi-line string", () => {
      const sources: DataSourceSpec[] = [
        { type: "url", source: "https://example.com/data.csv" },
        { type: "file", source: "./local/file.csv" },
        { type: "file", source: "/absolute/path.csv" },
      ];

      const serialized = serializeDataSources(sources);

      expect(serialized).toBe(
        "https://example.com/data.csv\n./local/file.csv\n/absolute/path.csv",
      );
    });

    it("should handle empty array", () => {
      expect(serializeDataSources([])).toBe("");
    });

    it("should handle single source", () => {
      const sources: DataSourceSpec[] = [
        { type: "url", source: "https://example.com/data.csv" },
      ];

      const serialized = serializeDataSources(sources);

      expect(serialized).toBe("https://example.com/data.csv");
    });
  });

  describe("integration test", () => {
    it("should round-trip through extract and serialize", () => {
      const originalText = `
        https://example.com/data.csv # Main dataset
        ./local/file.csv # Local backup
        /absolute/path.csv
      `;

      const sources = extractDataSources(originalText);
      const serialized = serializeDataSources(sources);
      const reparsed = extractDataSources(serialized);

      expect(reparsed).toEqual(sources);
    });
  });
});
