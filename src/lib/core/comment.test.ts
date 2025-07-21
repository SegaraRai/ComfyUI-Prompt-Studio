import { describe, expect, it } from "vitest";
import {
  extractComments,
  findCommentRanges,
  isInComment,
  stripComments,
  type CommentRange,
} from "./comment.js";

describe("comment functionality", () => {
  describe("findCommentRanges", () => {
    it("should detect single-line comments", () => {
      const text = "tag1, tag2 // this is a comment\ntag3, tag4";
      const ranges = findCommentRanges(text);

      expect(ranges).toHaveLength(1);
      expect(ranges[0]).toEqual({
        start: 11,
        end: 31,
        type: "single",
      });
    });

    it("should detect multi-line comments", () => {
      const text = "tag1, /* multi line\ncomment */ tag2";
      const ranges = findCommentRanges(text);

      expect(ranges).toHaveLength(1);
      expect(ranges[0]).toEqual({
        start: 6,
        end: 30,
        type: "multi",
      });
    });

    it("should detect multiple comments", () => {
      const text = "tag1 // comment1\ntag2 /* comment2 */ tag3 // comment3";
      const ranges = findCommentRanges(text);

      expect(ranges).toHaveLength(3);
      expect(ranges[0]).toEqual({
        start: 5,
        end: 16,
        type: "single",
      });
      expect(ranges[1]).toEqual({
        start: 22,
        end: 36,
        type: "multi",
      });
      expect(ranges[2]).toEqual({
        start: 42,
        end: 53,
        type: "single",
      });
    });

    it("should handle text with no comments", () => {
      const text = "tag1, tag2, tag3";
      const ranges = findCommentRanges(text);

      expect(ranges).toHaveLength(0);
    });

    it("should handle empty text", () => {
      const text = "";
      const ranges = findCommentRanges(text);

      expect(ranges).toHaveLength(0);
    });

    it("should handle nested-like patterns correctly", () => {
      const text = "tag1 /* outer /* not nested */ tag2";
      const ranges = findCommentRanges(text);

      expect(ranges).toHaveLength(1);
      expect(ranges[0]).toEqual({
        start: 5,
        end: 30,
        type: "multi",
      });
    });
  });

  describe("isInComment", () => {
    const ranges: CommentRange[] = [
      { start: 5, end: 15, type: "single" },
      { start: 20, end: 30, type: "multi" },
    ];

    it("should return true for positions within comment ranges", () => {
      expect(isInComment(10, ranges)).toBe(true);
      expect(isInComment(25, ranges)).toBe(true);
      expect(isInComment(5, ranges)).toBe(true); // start position
      expect(isInComment(14, ranges)).toBe(true); // end-1 position
    });

    it("should return false for positions outside comment ranges", () => {
      expect(isInComment(0, ranges)).toBe(false);
      expect(isInComment(15, ranges)).toBe(false); // end position
      expect(isInComment(18, ranges)).toBe(false);
      expect(isInComment(30, ranges)).toBe(false); // end position
      expect(isInComment(35, ranges)).toBe(false);
    });

    it("should return false for empty ranges", () => {
      expect(isInComment(10, [])).toBe(false);
    });
  });

  describe("stripComments", () => {
    it("should replace single-line comments with spaces", () => {
      const text = "tag1, tag2 // comment\ntag3";
      const result = stripComments(text);

      expect(result).toBe("tag1, tag2           \ntag3");
    });

    it("should replace multi-line comments with spaces", () => {
      const text = "tag1 /* comment */ tag2";
      const result = stripComments(text);

      expect(result).toBe("tag1               tag2");
    });

    it("should preserve text length and positions", () => {
      const text = "tag1 // comment\ntag2 /* multi */ tag3";
      const result = stripComments(text);

      expect(result.length).toBe(text.length);
      expect(result.indexOf("tag1")).toBe(text.indexOf("tag1"));
      expect(result.indexOf("tag2")).toBe(text.indexOf("tag2"));
      expect(result.indexOf("tag3")).toBe(text.indexOf("tag3"));
    });

    it("should handle text with no comments unchanged", () => {
      const text = "tag1, tag2, tag3";
      const result = stripComments(text);

      expect(result).toBe(text);
    });
  });

  describe("extractComments", () => {
    it("should extract all comments with their ranges", () => {
      const text = "tag1 // comment1\ntag2 /* comment2 */ tag3";
      const comments = extractComments(text);

      expect(comments).toHaveLength(2);
      expect(comments[0]).toEqual({
        content: "// comment1",
        range: { start: 5, end: 16, type: "single" },
      });
      expect(comments[1]).toEqual({
        content: "/* comment2 */",
        range: { start: 22, end: 36, type: "multi" },
      });
    });

    it("should return empty array for text with no comments", () => {
      const text = "tag1, tag2, tag3";
      const comments = extractComments(text);

      expect(comments).toHaveLength(0);
    });
  });

  describe("edge cases", () => {
    it("should handle comments at the start of text", () => {
      const text = "// comment\ntag1, tag2";
      const ranges = findCommentRanges(text);

      expect(ranges).toHaveLength(1);
      expect(ranges[0]).toEqual({
        start: 0,
        end: 10,
        type: "single",
      });
    });

    it("should handle comments at the end of text", () => {
      const text = "tag1, tag2 // comment";
      const ranges = findCommentRanges(text);

      expect(ranges).toHaveLength(1);
      expect(ranges[0]).toEqual({
        start: 11,
        end: 21,
        type: "single",
      });
    });

    it("should handle unclosed multi-line comments", () => {
      const text = "tag1 /* unclosed comment";
      const ranges = findCommentRanges(text);

      expect(ranges).toHaveLength(0); // regex requires */ to match
    });

    it("should handle comment-like content in tag names", () => {
      const text = "tag_with_//slashes, normal_tag";
      const ranges = findCommentRanges(text);

      expect(ranges).toHaveLength(1);
      expect(ranges[0].start).toBe(9); // position of //
    });
  });
});
