import { describe, expect, it } from "vitest";
import { parseChants } from "./chants.js";

describe("chants functionality", () => {
  describe("parseChants", () => {
    it("should parse basic chant definitions", () => {
      const text = `@@quality
/// Quality tags
masterpiece, best quality

@@char:girl
1girl, solo`;

      const result = parseChants(text);

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        name: "quality",
        description: "Quality tags",
        content: "masterpiece, best quality",
      });
      expect(result[1]).toEqual({
        name: "char:girl",
        description: "",
        content: "1girl, solo",
      });
    });

    it("should handle single-line comments", () => {
      const text = `@@test
tag1, tag2 // this is a comment
tag3, tag4`;

      const result = parseChants(text);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        name: "test",
        description: "",
        content: "tag1, tag2, tag3, tag4",
      });
    });

    it("should handle multi-line comments", () => {
      const text = `@@test
tag1, /* this is a
multi-line comment */ tag2
tag3`;

      const result = parseChants(text);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        name: "test",
        description: "",
        content: "tag1, tag2, tag3",
      });
    });

    it("should handle lines entirely within comments", () => {
      const text = `@@test
tag1
/* entire line is commented out */
tag2`;

      const result = parseChants(text);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        name: "test",
        description: "",
        content: "tag1, tag2",
      });
    });

    it("should handle mixed comment types", () => {
      const text = `@@test
/// Description comment
tag1 // single line comment
tag2 /* inline */ tag3
/*
   multiline comment
   block
*/
tag4`;

      const result = parseChants(text);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        name: "test",
        description: "Description comment",
        content: "tag1, tag2              tag3, tag4",
      });
    });

    it("should handle empty chant definitions", () => {
      const text = `@@empty
/// Just a description

@@another
tag1`;

      const result = parseChants(text);

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        name: "empty",
        description: "Just a description",
        content: "",
      });
      expect(result[1]).toEqual({
        name: "another",
        description: "",
        content: "tag1",
      });
    });
  });
});
