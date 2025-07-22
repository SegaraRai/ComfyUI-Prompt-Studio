export type Tag =
  | {
      type: "lora";
      prefix: "lora:";
      name: string;
      weight: number;
      precision: number | null;
      extra: string;
    }
  | {
      type: "normal" | "chant" | "embedding";
      prefix: "" | "@" | "embedding:";
      name: string;
      weight: number;
      precision: number | null;
    };

export type ChantMarker = {
  type: "chant_marker";
  name: string;
};

export type Token = Tag | ChantMarker;

type UnparsedDefaultTag = {
  name: string;
  weight: number;
  precision: number | null;
};

function parseDefaultTagDetail(tag: UnparsedDefaultTag): Tag {
  if (tag.name.startsWith("@")) {
    return {
      type: "chant",
      prefix: "@",
      name: tag.name.slice(1),
      weight: tag.weight,
      precision: tag.precision,
    };
  }

  return {
    type: "normal",
    prefix: "",
    name: tag.name,
    weight: tag.weight,
    precision: tag.precision,
  };
}

/**
 * Parse chant marker (@@name)
 */
function parseChantMarker(text: string): ChantMarker | null {
  const chantMatch = /^@@([^,\n\s]+)/.exec(text.trim());
  if (chantMatch) {
    return {
      type: "chant_marker",
      name: chantMatch[1],
    };
  }
  return null;
}

/**
 * Parse LoRA tag
 *
 * Note: Supports both normal LoRA notation and minus prefix for erasure:
 * - Input: "<lora:foo:0.8>" -> Output: LoRA tag with weight 0.8
 * - Input: "-<lora:foo>" -> Output: LoRA tag with weight 0.0 (for erasure)
 * - Input: "-<lora:foo:0.8>" -> Output: LoRA tag with weight 0.0 (minus overrides weight)
 */
function parseLoraTag(text: string): Tag | null {
  // Check for minus prefix first
  const hasMinusPrefix = text.startsWith("-");
  const loraText = hasMinusPrefix ? text.slice(1) : text;

  const loraMatch = /^<lora:([^>:]+)(?::(-?\d+(?:\.\d+)?)(:.*)?)?>/.exec(
    loraText,
  );
  if (loraMatch) {
    const name = loraMatch[1];
    const weight = hasMinusPrefix ? 0.0 : parseFloat(loraMatch[2] || "1.0");
    const extra = loraMatch[3] || "";
    return name && isFinite(weight)
      ? {
          type: "lora",
          prefix: "lora:",
          name,
          weight,
          precision: loraMatch[2]
            ? (loraMatch[2].split(".")[1]?.length ?? 0)
            : null,
          extra,
        }
      : null;
  }
  return null;
}

/**
 * Parse embedding tag
 *
 * Note: Supports both normal embedding notation and minus prefix for erasure:
 * - Input: "<embedding:foo:0.8>" -> Output: embedding tag with weight 0.8
 * - Input: "<embedding:foo>" -> Output: embedding tag with weight 1.0
 * - Input: "-<embedding:foo>" -> Output: embedding tag with weight 0.0 (for erasure)
 * - Input: "-<embedding:foo:0.8>" -> Output: embedding tag with weight 0.0 (minus overrides weight)
 */
function parseEmbeddingTag(text: string): Tag | null {
  // Check for minus prefix first
  const hasMinusPrefix = text.startsWith("-");
  const embeddingText = hasMinusPrefix ? text.slice(1) : text;

  const embeddingMatch = /^<embedding:([^>:]+)(?::(-?\d+(?:\.\d+)?))?>/.exec(
    embeddingText,
  );
  if (embeddingMatch) {
    const name = embeddingMatch[1];
    const weight = hasMinusPrefix
      ? 0.0
      : parseFloat(embeddingMatch[2] || "1.0");
    return name && isFinite(weight)
      ? {
          type: "embedding",
          prefix: "embedding:",
          name,
          weight,
          precision: embeddingMatch[2]
            ? (embeddingMatch[2].split(".")[1]?.length ?? 0)
            : null,
        }
      : null;
  }
  return null;
}

/**
 * Parse tag with weight
 */
function parseWeightTag(text: string): Tag | null {
  const tagWeightMatch = /^\((.+):(-?\d+(?:\.\d+)?)\)$/.exec(text);
  if (tagWeightMatch) {
    const name = tagWeightMatch[1];
    const weight = parseFloat(tagWeightMatch[2]);
    return name && isFinite(weight)
      ? parseDefaultTagDetail({
          name,
          weight,
          precision: tagWeightMatch[2].split(".")[1]?.length ?? 0,
        })
      : null;
  }
  return null;
}

/**
 * Parse normal tag
 *
 * Note: The "-" prefix is a prompt input notation that sets weight to 0.
 * This notation is only valid for prompt input and will not appear in compiled output.
 */
function parseNormalTag(text: string): Tag {
  if (text.startsWith("-")) {
    return parseDefaultTagDetail({
      name: text.slice(1),
      weight: 0,
      precision: null,
    });
  }

  let prefix = /^([([]+)/.exec(text)?.[1] || "";
  let ratio = 1;
  let expectedSuffix = "";
  for (const char of prefix) {
    if (char === "(") {
      ratio *= 1.1;
      expectedSuffix = ")" + expectedSuffix;
    } else if (char === "[") {
      ratio *= 0.9;
      expectedSuffix = "]" + expectedSuffix;
    }
  }

  if (expectedSuffix && !text.endsWith(expectedSuffix)) {
    prefix = "";
    ratio = 1;
  }

  return parseDefaultTagDetail({
    name: prefix ? text.slice(prefix.length, -prefix.length) : text,
    weight: ratio,
    precision: null,
  });
}

/**
 * Parse tag text
 */
export function parseTag(text: string): Tag | null {
  const trimmed = text.trim();
  if (!trimmed) {
    return null;
  }

  // For embedding tags
  const embeddingResult = parseEmbeddingTag(trimmed);
  if (embeddingResult) {
    return embeddingResult;
  }

  // For LoRA tags
  const loraResult = parseLoraTag(trimmed);
  if (loraResult) {
    return loraResult;
  }

  // For tags with weight
  const weightResult = parseWeightTag(trimmed);
  if (weightResult) {
    return weightResult;
  }

  // For normal tags
  return parseNormalTag(trimmed);
}

/**
 * Parse any token (tag or chant marker)
 */
export function parseToken(text: string): Token | null {
  const trimmed = text.trim();
  if (!trimmed) {
    return null;
  }

  // Check for chant marker first
  const chantMarker = parseChantMarker(trimmed);
  if (chantMarker) {
    return chantMarker;
  }

  // Otherwise parse as tag
  return parseTag(trimmed);
}

/**
 * Convert tag to string representation
 *
 * @param tag - The tag object to stringify
 * @returns String representation of the tag
 *
 * @example
 * stringifyTag({ type: 'lora', name: 'example', weight: 1.5, precision: 2, extra: '' });
 * // Returns: "<example:1.5>"
 *
 * stringifyTag({ type: 'tag', name: 'example', weight: 1.0, precision: 2 });
 * // Returns: "example"
 *
 * stringifyTag({ type: 'tag', name: 'example', weight: 0.75, precision: 2 });
 * // Returns: "(example:0.75)"
 */
export function stringifyTag(
  tag: Readonly<Tag> & { readonly precision: number },
): string {
  const fullName = `${tag.prefix}${tag.name}`;
  const strWeight = tag.weight
    .toFixed(tag.precision)
    .replace(/0+$/, "")
    .replace(/\.$/, ".0");
  const isZero = Math.abs(tag.weight) < 1e-6;
  const isOne = Math.abs(tag.weight - 1) < 1e-6;

  switch (tag.type) {
    case "lora":
      // LoRA always requires weights
      return `<${fullName}:${strWeight}${tag.extra}>`;

    case "embedding":
      if (isOne) {
        return `<${fullName}>`;
      }
      if (isZero) {
        return `-<${fullName}>`;
      }
      return `<${fullName}:${strWeight}>`;

    case "normal":
    case "chant":
      if (isOne) {
        return fullName;
      }
      if (isZero) {
        return `-${fullName}`;
      }
      return `(${fullName}:${strWeight})`;
  }
}

/**
 * Token range interface
 */
export interface TokenRange {
  text: string;
  token: Token | null;
  start: number;
  end: number;
}

/**
 * Detects token ranges in text
 */
export function findTokenRanges(text: string): TokenRange[] {
  const ranges: TokenRange[] = [];

  const tokenRegex = /([^,\n]+)/g;
  let match;
  while ((match = tokenRegex.exec(text)) !== null) {
    const fullMatch = match[1];
    const tokenText = fullMatch.trim();
    if (tokenText.length === 0) {
      continue;
    }

    const leadingWhitespace = fullMatch.length - fullMatch.trimStart().length;
    const trailingWhitespace = fullMatch.length - fullMatch.trimEnd().length;

    const start = match.index + leadingWhitespace;
    const end = match.index + fullMatch.length - trailingWhitespace;

    ranges.push({
      text: tokenText,
      token: parseToken(tokenText),
      start,
      end,
    });
  }

  return ranges;
}
