import { extractComments, stripComments } from "./comment.js";
import { findTokenRanges } from "./tokenizer.js";

export interface ChantDefinition {
  name: string;
  description: string;
  content: string;
}

export function parseChants(text: string): ChantDefinition[] {
  interface CurrentChant {
    start: number;
    end: number;
    name: string;
    items: string[];
  }

  const definitions: ChantDefinition[] = [];

  const comments = extractComments(text);
  const tokenRanges = findTokenRanges(stripComments(text));

  let currentChant: CurrentChant | null = null;

  const toChantDefinition = (chant: CurrentChant): ChantDefinition => {
    const items = chant.items.map((item) => item.trim()).filter((item) => item);
    return {
      name: chant.name,
      description: comments
        .filter((c) => c.range.start >= chant.start && c.range.end <= chant.end)
        .map(
          (c) =>
            /^\/\/\/(.*)/
              .exec(c.content.trim())?.[1]
              .trim()
              .replace(/$/, "\n") ?? "",
        )
        .join("")
        .trim(),
      content: items.join(", "),
    };
  };

  for (const range of tokenRanges) {
    if (range.token?.type === "chant_marker") {
      if (currentChant) {
        currentChant.end = range.start;
        definitions.push(toChantDefinition(currentChant));
      }
      currentChant = {
        name: range.token.name,
        start: range.start,
        end: range.end,
        items: [],
      };
    } else if (currentChant) {
      currentChant.items.push(range.text);
    }
  }

  if (currentChant) {
    currentChant.end = text.length;
    definitions.push(toChantDefinition(currentChant));
  }

  return definitions;
}
