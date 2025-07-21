/**
 * Utility functions for complex string operations in CodeMirror extensions
 */

export interface TagBoundary {
  start: number;
  end: number;
  content: string;
}

export interface DelimiterMatch {
  delimStart: number;
  contentStart: number;
  expectedSuffixRev: string;
  missingSuffix: string;
}

/**
 * Finds the boundaries of a number at or near the given position
 */
export function findNumberBoundaries(
  text: string,
  position: number,
): TagBoundary | null {
  let start = position;
  while (start > 0 && /[\d.-]/.test(text[start - 1])) {
    start--;
  }

  let end = position;
  while (end < text.length && /[\d.-]/.test(text[end])) {
    end++;
  }

  const numberText = text.slice(start, end);

  // Validate it's a proper number and surrounded by non-word chars
  if (
    /^-?\d+(\.\d+)?$/.test(numberText) &&
    /^\W?$/.test(text[start - 1] || "") &&
    /^\W?$/.test(text[end] || "")
  ) {
    return { start, end, content: numberText };
  }

  return null;
}

/**
 * Finds the boundaries of a tag at or near the given position
 */
export function findTagBoundaries(
  text: string,
  position: number,
): TagBoundary | null {
  let start = position;
  while (start > 0 && !["\n", ","].includes(text[start - 1])) {
    start--;
  }

  // Skip leading whitespace
  while (start < text.length && /\s/.test(text[start])) {
    start++;
  }

  let end = position;
  while (end < text.length && !["\n", ","].includes(text[end])) {
    end++;
  }

  // Skip trailing whitespace
  while (end > start && /\s/.test(text[end - 1])) {
    end--;
  }

  const content = text.slice(start, end);
  return { start, end, content };
}

/**
 * Analyzes delimiters and calculates missing suffixes for autocompletion
 */
export function analyzeDelimiters(
  lineText: string,
  start: number,
  end: number,
): DelimiterMatch {
  const delimStart = start;

  // Skip whitespace and opening brackets/parentheses
  let contentStart = start;
  while (
    contentStart < lineText.length &&
    /^\s*(?:-|[([]*)$/.test(lineText.slice(delimStart, contentStart + 1))
  ) {
    contentStart++;
  }

  // Calculate expected suffix (reversed for easier processing)
  const expectedSuffixRev = lineText
    .slice(delimStart, contentStart)
    .trim()
    .replace("-", "")
    .replaceAll("(", ")")
    .replaceAll("[", "]");

  let missingSuffix = "";
  for (const [i, char] of [...expectedSuffixRev].entries()) {
    if (lineText[end - 1] !== char) {
      missingSuffix = [...expectedSuffixRev].slice(i).reverse().join("");
      break;
    }
    end--;
  }

  return {
    delimStart,
    contentStart,
    expectedSuffixRev,
    missingSuffix,
  };
}

/**
 * Formats a number with preserved decimal precision
 */
export function formatNumberWithPrecision(
  value: number,
  originalText: string,
): string {
  const decimalPlaces = originalText.split(".")[1]?.length ?? 0;
  return value.toFixed(Math.max(decimalPlaces, 1));
}
