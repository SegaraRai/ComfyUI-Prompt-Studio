import type { ChantDefinition } from "./chants.js";
import { stripComments } from "./comment.js";
import type { ResourceDefinition } from "./resources.js";
import { findTokenRanges, type Tag } from "./tokenizer.js";

export interface CompileOptions {
  readonly normalize: "none" | "underscore" | "whitespace";
  readonly escapeTarget: "none" | "parentheses";
  readonly duplicateTagHandling: "overwrite" | "ignore" | "add" | "multiply";
}

export interface CompileContext {
  readonly chantDefinitions: readonly ChantDefinition[];
  readonly resourceDefinition: ResourceDefinition;
  readonly options: CompileOptions;
}

function createFunctions(options: CompileOptions) {
  const normalize = {
    none: (s: string) => s,
    underscore: (s: string) => s.replaceAll(" ", "_"),
    whitespace: (s: string) => s.replaceAll("_", " "),
  }[options.normalize];

  const escape = {
    none: (s: string) => s,
    parentheses: (s: string) => s.replaceAll("(", "\\(").replaceAll(")", "\\)"),
  }[options.escapeTarget];

  return { normalize, escape };
}

/**
 * Format a tag for output
 *
 * Note: This function transforms prompt input notation to output notation:
 * - Input: "embedding:name" -> Output: "<embedding:name:weight>"
 * - Input: "-tagname" (weight=0) -> Output: null (filtered out)
 * - Input: "tagname" (weight=1.0) -> Output: "tagname"
 * - Input: "(tagname:0.8)" -> Output: "(tagname:0.8)"
 */
export function formatTag(
  tag: Readonly<Tag> & { readonly precision: number },
  options: CompileOptions,
): string | null {
  const { normalize, escape } = createFunctions(options);

  const strWeight = tag.weight
    .toFixed(tag.precision)
    .replace(/0+$/, "")
    .replace(/\.$/, ".0");
  if (strWeight === "0.0") {
    return null;
  }

  switch (tag.type) {
    case "normal":
      return strWeight === "1.0"
        ? escape(normalize(tag.name))
        : `(${escape(normalize(tag.name))}:${strWeight})`;

    case "lora":
      return `<lora:${escape(tag.name)}:${strWeight}${tag.extra}>`;

    case "embedding":
      return `<embedding:${escape(tag.name)}:${strWeight}>`;
  }

  return null;
}

function createChantMap(chantDefinitions: readonly ChantDefinition[]) {
  const chantMap = new Map<string, { chant: ChantDefinition; tags: Tag[] }>(
    chantDefinitions.map((c) => {
      const tokenRanges = findTokenRanges(c.content);
      return [
        c.name,
        {
          chant: c,
          tags: tokenRanges
            .map((r) => r.token)
            .filter((r): r is Tag => r != null && r.type !== "chant_marker"),
        },
      ];
    }),
  );
  return chantMap;
}

export function compilePrompt(
  prompt: string,
  { chantDefinitions, options }: CompileContext,
): string {
  const { normalize } = createFunctions(options);

  const chantMap = createChantMap(chantDefinitions);

  const tagInfoRef = new Map<string, Tag>();
  const tagMap = new Map<string, number>();
  for (const tokenRange of findTokenRanges(stripComments(prompt))) {
    if (!tokenRange.token?.name || tokenRange.token.type === "chant_marker") {
      continue;
    }

    const actualTags =
      tokenRange.token.type === "chant"
        ? chantMap.get(tokenRange.token.name)?.tags
        : [tokenRange.token];
    if (!actualTags) {
      continue;
    }

    const parentWeight =
      tokenRange.token.type === "chant" ? tokenRange.token.weight : 1;

    for (const tag of actualTags) {
      const normalizedName = normalize(tag.name);
      if (!normalizedName) {
        continue;
      }

      const key = `${tag.type}:${normalizedName}`;
      const existingValue = tagMap.get(key);
      const actualWeight = parentWeight * tag.weight;

      let newValue = actualWeight;
      let updateRef = true;
      if (existingValue != null && newValue !== 0) {
        switch (options.duplicateTagHandling) {
          case "overwrite":
            break;
          case "add":
            newValue += existingValue;
            break;
          case "multiply":
            newValue *= existingValue;
            break;
          case "ignore":
            newValue = existingValue;
            updateRef = false;
            break;
        }
      }

      tagMap.set(key, newValue);
      if (updateRef) {
        tagInfoRef.set(key, tag);
      }
    }
  }

  const tags: string[] = [];
  for (const [key, weight] of tagMap.entries()) {
    if (weight === 0) {
      continue;
    }

    // Extract the normalized name from the key (format: "type:name")
    const tag = tagInfoRef.get(key);
    if (!tag) {
      continue;
    }

    const formatted = formatTag(
      {
        ...tag,
        weight,
        precision: tag.precision ?? 2,
      },
      options,
    );
    if (!formatted) {
      continue;
    }

    tags.push(formatted);
  }

  const compiledPrompt = tags.join(", ");
  return compiledPrompt;
}
