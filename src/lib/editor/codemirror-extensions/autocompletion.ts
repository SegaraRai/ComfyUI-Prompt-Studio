import {
  autocompletion,
  type Completion,
  type CompletionContext,
  type CompletionResult,
} from "@codemirror/autocomplete";
import { categoryToId } from "../../core/category.js";
import { stripComments } from "../../core/comment.js";
import { humanizeCount } from "../../core/humanize.js";
import { normalizeForQuery } from "../../core/normalize.js";
import { searchChants, searchResources } from "../../core/search.js";
import { findTokenRanges, type Tag } from "../../core/tokenizer.js";
import type { PluginContext } from "./context.js";
import { analyzeDelimiters } from "./string-utils.js";

const MAX_SUGGESTIONS = 50;

export function createAutocompletion(getContext: () => PluginContext) {
  return autocompletion({
    override: [
      async (context: CompletionContext): Promise<CompletionResult | null> => {
        const {
          mode,
          dictionaryEngine,
          chantDefinitions,
          resourceDefinition,
          normalizeOnAutoComplete,
        } = getContext();

        const normalizeForCompletion = (key: string): string => {
          switch (normalizeOnAutoComplete) {
            case "underscore":
              return key.replaceAll(" ", "_");

            case "whitespace":
              return key.replaceAll("_", " ");

            case "none":
              return key;
          }
        };

        const { state, pos, explicit } = context;
        const line = state.doc.lineAt(pos);
        const lineText = line.text;
        const fullText = state.doc.toString();

        const tokenRanges = findTokenRanges(stripComments(fullText));
        const currentToken = tokenRanges.find(
          (range) => range.start <= pos && pos <= range.end,
        );
        if (!explicit) {
          // in comment or chant marker
          if (
            !currentToken?.token ||
            currentToken.token.type === "chant_marker"
          ) {
            return null;
          }
          // in unclosed multi-line comment
          const commentStart = lineText.lastIndexOf("/*", pos - line.from);
          const commentEnd = lineText.lastIndexOf("*/", pos);
          if (
            commentStart !== -1 &&
            (commentEnd === -1 || commentEnd < commentStart)
          ) {
            return null;
          }
        }

        const existingTags = new Set(
          tokenRanges
            .filter(
              (token) =>
                token !== currentToken &&
                token.token != null &&
                token.token.type !== "chant_marker",
            )
            .map((range) => range.token)
            .filter((v): v is Tag => v != null)
            .map((v) =>
              v.type === "normal"
                ? `${v.type}\0${normalizeForQuery(v.name)}`
                : `${v.type}\0${v.name}`,
            ),
        );

        let start = pos - line.from;
        let minStart = lineText.lastIndexOf("*/", start);
        minStart = minStart === -1 ? 0 : minStart + 2;
        while (start > minStart && lineText[start - 1] !== ",") {
          start--;
        }
        // skip comments
        start += /^\/\/+|^\/\*/.exec(lineText.slice(start))?.[0].length ?? 0;
        // skip whitespace
        start += /^\s+/.exec(lineText.slice(start))?.[0].length ?? 0;
        // skip parentheses/brackets. Do not skip angle brackets since we use them for LoRAs and embeddings detection
        start += /^[([]+/.exec(lineText.slice(start))?.[0].length ?? 0;

        const end = pos - line.from;

        // Since we insert ", " automatically, remove existing trailing commas and spaces
        let replaceEnd = end;
        while (
          replaceEnd < lineText.length &&
          /^[,\s]/.test(lineText[replaceEnd])
        ) {
          replaceEnd++;
        }

        const delimiterInfo = analyzeDelimiters(lineText, start, end);
        const missingSuffix = delimiterInfo.missingSuffix;
        start = delimiterInfo.contentStart;

        const currentTag = lineText.slice(start, end).trimStart();
        const replaceStart = line.from + start;
        replaceEnd += line.from;

        if (currentTag.startsWith("@")) {
          if (mode === "chants") {
            // No autocompletion in chants mode
            return null;
          }

          const query = currentTag.slice(1);
          const chantResults = searchChants(query, chantDefinitions);

          const completions: Completion[] = chantResults
            .slice(0, MAX_SUGGESTIONS)
            .map((result) => {
              const existing = existingTags.has(`chant\0${result.chant.name}`);

              return {
                label: `@${result.key}`,
                detail: result.chant.description || result.chant.content,
                apply: `@${result.key}${missingSuffix}, `,
                boost: result.score,
                type: `chant-${existing ? "existing" : "new"}`,
              };
            });

          return {
            from: replaceStart,
            to: replaceEnd,
            options: completions,
            validFor: /^@[\w :()/]*$/,
          };
        }

        if (currentTag.startsWith("<")) {
          const query = currentTag.slice(1);

          // Search both LoRAs and embeddings simultaneously
          const resourceResults = searchResources(query, resourceDefinition);

          const completions: Completion[] = resourceResults
            .slice(0, MAX_SUGGESTIONS)
            .map((result) => {
              const { resource } = result;
              const existing = existingTags.has(
                `${resource.type}\0${resource.name}`,
              );

              if (resource.type === "lora") {
                return {
                  label: `<lora:${resource.name}:1.0>`,
                  detail: resource.description,
                  apply: (view, _completion, from, to) => {
                    const loraText = `<lora:${resource.name}:1.0>`;
                    const strengthStart = from + loraText.lastIndexOf("1.0");
                    const strengthEnd = strengthStart + 3;

                    view.dispatch({
                      changes: {
                        from,
                        to,
                        insert: `${loraText}, `,
                      },
                      selection: {
                        anchor: strengthStart,
                        head: strengthEnd,
                      },
                    });
                  },
                  boost: result.score,
                  type: `resource-lora-${existing ? "existing" : "new"}`,
                };
              } else {
                return {
                  label: `<embedding:${resource.name}>`,
                  detail: resource.description,
                  apply: `<embedding:${resource.name}>, `,
                  boost: result.score,
                  type: `resource-embedding-${existing ? "existing" : "new"}`,
                };
              }
            });

          return {
            from: replaceStart,
            to: replaceEnd,
            options: completions,
            validFor: /^<[\w :.]*>?$/,
          };
        }

        const searchResults = await dictionaryEngine?.fuzzy_search(
          currentTag,
          MAX_SUGGESTIONS,
        );
        if (!searchResults) {
          console.warn("Dictionary engine not available");
          return null;
        }

        const completions: Completion[] = searchResults
          .map((result): Completion & { score: number } => {
            const existing = existingTags.has(
              `normal\0${normalizeForQuery(result.canonical_key)}`,
            );

            let scoreOffset = 0;
            if (result.term === currentTag.trim()) {
              scoreOffset = 1000;
            } else if (existing) {
              scoreOffset = -20;
            } else if (!result.is_canonical) {
              scoreOffset = -10;
            }

            const score = result.score + scoreOffset;
            const aliasesWithoutCurrent = result.aliases.filter(
              (alias) => alias !== currentTag.trim(),
            );

            return {
              label: normalizeForCompletion(result.term),
              detail: [
                ...(!result.is_canonical
                  ? [`→ ${normalizeForCompletion(result.canonical_key)}`]
                  : []),
                ...(result.count >= 1 ? [humanizeCount(result.count)] : []),
                ...(aliasesWithoutCurrent.length
                  ? [`(${aliasesWithoutCurrent.join(", ")})`]
                  : []),
              ].join(" "),
              apply: `${normalizeForCompletion(result.canonical_key)}${missingSuffix}, `,
              type: `normal-${categoryToId(result.category)}-${existing ? "existing" : "new"}`,
              score,
            };
          })
          .sort((a, b) => (b.score ?? 0) - (a.score ?? 0));

        return {
          from: replaceStart,
          to: replaceEnd,
          options: completions,
          filter: false,
        };
      },
    ],
    optionClass: (completion) =>
      (completion.type?.split("-") ?? [])
        .filter((v) => v)
        .map((v) => `cps-option-${v}`)
        .join(" "),
    maxRenderedOptions: MAX_SUGGESTIONS,
    defaultKeymap: false,
    closeOnBlur: true,
    activateOnTyping: true,
  });
}
