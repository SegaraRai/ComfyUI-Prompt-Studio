/**
 * Comment range interface
 */
export interface CommentRange {
  start: number;
  end: number;
  type: "single" | "multi";
}

/**
 * Detects comment ranges in text
 * Supports both single-line and multi-line comments
 */
export function findCommentRanges(text: string): CommentRange[] {
  const ranges: CommentRange[] = [];

  // Single-line comments (//) detection
  const singleLineRegex = /\/\/.*$/gm;
  let match;
  while ((match = singleLineRegex.exec(text)) !== null) {
    ranges.push({
      start: match.index,
      end: match.index + match[0].length,
      type: "single",
    });
  }

  // Multi-line comments (/* */) detection
  const multiLineRegex = /\/\*[\s\S]*?\*\//g;
  while ((match = multiLineRegex.exec(text)) !== null) {
    ranges.push({
      start: match.index,
      end: match.index + match[0].length,
      type: "multi",
    });
  }

  // Sort ranges by start position
  return ranges.sort((a, b) => a.start - b.start);
}

/**
 * Checks if a position is within any comment range
 */
export function isInComment(
  position: number,
  commentRanges: readonly CommentRange[],
): boolean {
  return commentRanges.some(
    (range) => position >= range.start && position < range.end,
  );
}

/**
 * Removes comments from text while preserving original positions
 * Returns the text with comments replaced by spaces to maintain character positions
 */
export function stripComments(text: string): string {
  const commentRanges = findCommentRanges(text);
  let result = text;

  // Replace comments with spaces (preserve positions)
  for (let i = commentRanges.length - 1; i >= 0; i--) {
    const range = commentRanges[i];
    const spaces = " ".repeat(range.end - range.start);
    result =
      result.substring(0, range.start) + spaces + result.substring(range.end);
  }

  return result;
}

/**
 * Extracts all comments from text with their positions
 */
export function extractComments(text: string): {
  content: string;
  range: CommentRange;
}[] {
  const commentRanges = findCommentRanges(text);
  return commentRanges.map((range) => ({
    content: text.substring(range.start, range.end),
    range,
  }));
}
