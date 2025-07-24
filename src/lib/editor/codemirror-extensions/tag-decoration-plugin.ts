import { StateEffect, StateField } from "@codemirror/state";
import {
  Decoration,
  EditorView,
  ViewPlugin,
  WidgetType,
  type DecorationSet,
  type ViewUpdate,
} from "@codemirror/view";
import type { QueryResultEntryValue } from "../../../../wasm/pkg/cps_lib.js";
import { categoryToId } from "../../core/category.js";
import type { ChantDefinition } from "../../core/chants.js";
import { stripComments } from "../../core/comment.js";
import { humanizeCount } from "../../core/humanize.js";
import { normalizeForQuery } from "../../core/normalize.js";
import type {
  EmbeddingDefinition,
  LoraDefinition,
} from "../../core/resources.js";
import { findTokenRanges, type Tag } from "../../core/tokenizer.js";
import { contextUpdateEffect, type PluginContext } from "./context.js";

type TagData =
  | {
      type: "normal";
      tag: Tag & { type: "normal" };
      info: QueryResultEntryValue | null;
    }
  | {
      type: "embedding";
      tag: Tag & { type: "embedding" };
      info: EmbeddingDefinition | null;
    }
  | {
      type: "lora";
      tag: Tag & { type: "lora" };
      info: LoraDefinition | null;
    }
  | {
      type: "chant";
      tag: Tag & { type: "chant" };
      info: ChantDefinition | null;
    };

/** Defines tailwindcss classnames. Only for prettier-plugin-tailwindcss */
function tw(cls: string): string {
  return cls;
}

function createTagData(
  tag: Tag,
  { chantDefinitions, resourceDefinition }: PluginContext,
  tagMap: ReadonlyMap<string, readonly QueryResultEntryValue[]>,
): TagData {
  switch (tag.type) {
    case "normal":
      return {
        type: "normal",
        tag: tag as Tag & { type: "normal" },
        info: tagMap.get(tag.name)?.[0] ?? null,
      };

    case "embedding":
      return {
        type: "embedding",
        tag: tag as Tag & { type: "embedding" },
        info:
          resourceDefinition.embeddings.find((e) => e.name === tag.name) ??
          null,
      };

    case "lora":
      return {
        type: "lora",
        tag: tag as Tag & { type: "lora" },
        info: resourceDefinition.loras.find((e) => e.name === tag.name) ?? null,
      };

    case "chant":
      return {
        type: "chant",
        tag: tag as Tag & { type: "chant" },
        info: chantDefinitions.find((e) => e.name === tag.name) ?? null,
      };
  }
}

function getColorKey({ type, info }: TagData): string {
  switch (type) {
    // For non-normal tags, use the type as the color key
    case "chant":
    case "embedding":
    case "lora":
      return `type-${type}`;

    // For normal tags, use the category if available
    case "normal":
      return info ? `category-${categoryToId(info.category)}` : "unregistered";
  }
}

function createTagHint(
  { type, tag, info }: TagData,
  { i18n }: PluginContext,
): string {
  const weightMessages =
    tag.weight === 0
      ? [i18n["editor.decoration.tagHintWeightZero"]()]
      : tag.weight !== 1
        ? [
            i18n["editor.decoration.tagHintWeight"]({
              weight: tag.weight.toFixed(tag.precision ?? 2),
            }),
          ]
        : [];
  const unregisteredMessages = !info
    ? [
        {
          normal: i18n["editor.decoration.unregisteredNormalTag"](),
          embedding: i18n["editor.decoration.unregisteredEmbedding"](),
          lora: i18n["editor.decoration.unregisteredLora"](),
          chant: i18n["editor.decoration.unregisteredChant"](),
        }[type],
      ]
    : [];

  const messages: string[] = [];
  switch (type) {
    case "embedding":
    case "lora":
      if (type === "embedding") {
        messages.push(
          i18n["editor.decoration.tagHintEmbedding"]({
            name: tag.name,
          }),
        );
      } else {
        messages.push(
          i18n["editor.decoration.tagHintLora"]({
            name: tag.name,
          }),
        );
      }
      if (info?.description) {
        messages.push(
          i18n["editor.decoration.tagHintResourceDescription"]({
            description: info.description,
          }),
        );
      }
      messages.push(...unregisteredMessages, ...weightMessages);
      break;

    case "chant":
      messages.push(
        i18n["editor.decoration.tagHintChant"]({
          name: tag.name,
        }),
      );
      if (info?.description) {
        messages.push(
          i18n["editor.decoration.tagHintChantDescription"]({
            description: info.description,
          }),
        );
      }
      messages.push(...unregisteredMessages, ...weightMessages);
      break;

    case "normal":
    default: {
      messages.push(
        i18n["editor.decoration.tagHintNormal"]({
          name: tag.name,
        }),
      );
      if (info) {
        const aliasesWithoutCurrent = info.aliases.filter(
          (alias) => normalizeForQuery(alias) !== normalizeForQuery(tag.name),
        );

        if (!info.is_canonical) {
          messages.push(
            i18n["editor.decoration.tagHintNonCanonical"]({
              canonical: info.canonical_key,
            }),
          );
        }
        if (aliasesWithoutCurrent.length > 0) {
          messages.push(
            i18n["editor.decoration.tagHintAliases"]({
              aliases: aliasesWithoutCurrent.join(", "),
            }),
          );
        }
        if (info.count > 0) {
          messages.push(
            i18n["editor.decoration.tagHintUsageCount"]({
              count: info.count.toLocaleString(),
            }),
          );
        }
      }
      messages.push(...unregisteredMessages, ...weightMessages);
      break;
    }
  }

  return messages.join("\n");
}

class IconWidget extends WidgetType {
  readonly #severity: "warning" | "error";
  readonly #hint: string;

  constructor(severity: "warning" | "error", hint: string) {
    super();

    this.#severity = severity;
    this.#hint = hint;
  }

  toDOM() {
    const wrapper = document.createElement("span");
    wrapper.className = tw(
      "relative inline-flex h-[0.9em] w-[1.2em] items-center select-none",
    );

    const pill = document.createElement("span");
    pill.dataset.severity = this.#severity;
    pill.className = tw(
      "data-[severity=warning]:text-warning data-[severity=warning]:icon-[iconoir--warning-triangle] data-[severity=error]:text-error data-[severity=error]:icon-[iconoir--xmark-circle] pointer-events-auto absolute top-0 bottom-0 left-[0.2em] m-auto inline-flex size-[0.8em] cursor-help",
    );
    pill.title = this.#hint;

    wrapper.appendChild(pill);

    return wrapper;
  }
}

class InlayHintWidget extends WidgetType {
  readonly #text: string;
  readonly #hint: string;

  constructor(text: string, hint: string) {
    super();

    this.#text = text;
    this.#hint = hint;
  }

  toDOM() {
    const hint = document.createElement("span");
    hint.className = tw(
      "pointer-events-auto pr-0.5 pl-1.5 text-(length:--hint-font-size) italic opacity-60 select-none before:content-[attr(aria-label)]",
    );
    hint.title = this.#hint;
    hint.ariaLabel = this.#text;
    return hint;
  }
}

function createDecorationsForTag(
  tagData: TagData,
  context: PluginContext,
): Decoration[] {
  const isNonCanonical =
    tagData.type === "normal" && tagData.info?.is_canonical === false;
  const type = !tagData.info
    ? "unregistered"
    : isNonCanonical
      ? "non-canonical"
      : "normal";

  return [
    Decoration.mark({
      class: tw(
        "relative cursor-help font-medium text-(--color) transition-colors duration-200 ease-in-out hover:brightness-110 hover:drop-shadow-sm data-[type=non-canonical]:line-through data-[type=unregistered]:italic data-[type=unregistered]:opacity-70",
      ),
      attributes: {
        "data-type": type,
        style: `--color:var(--keyword-${getColorKey(tagData)});`,
        title: createTagHint(tagData, context),
      },
    }),
  ];
}

function createWidgetsForTag(
  tagData: TagData | { type: "invalid"; text: string },
  { i18n }: PluginContext,
): Decoration[] {
  if (tagData.type === "invalid") {
    return [
      Decoration.widget({
        widget: new IconWidget(
          "error",
          i18n["editor.decoration.iconHintInvalid"]({
            text: tagData.text,
          }),
        ),
        side: 1,
      }),
    ];
  }

  if (!tagData.info) {
    return [
      Decoration.widget({
        widget: new IconWidget(
          "warning",
          i18n["editor.decoration.iconHintUnregistered"]({
            name: tagData.tag.name,
          }),
        ),
        side: 1,
      }),
    ];
  }

  if (tagData.type === "chant") {
    return [
      Decoration.widget({
        widget: new InlayHintWidget(
          tagData.info.content,
          tagData.info.description
            ? i18n["editor.decoration.inlayHintChantWithDescription"]({
                name: tagData.info.name,
                description: tagData.info.description,
              })
            : i18n["editor.decoration.inlayHintChant"]({
                name: tagData.info.name,
              }),
        ),
        side: 1,
      }),
    ];
  }

  if (tagData.type === "normal") {
    if (tagData.info.count < 1) {
      return [];
    }

    return [
      Decoration.widget({
        widget: new InlayHintWidget(
          humanizeCount(tagData.info.count),
          i18n["editor.decoration.inlayHintNormal"]({
            count: tagData.info.count.toLocaleString(),
          }),
        ),
        side: 1,
      }),
    ];
  }

  return [];
}

// StateEffect for updating decorations asynchronously
const setTagDecorationsEffect = StateEffect.define<DecorationSet>();

// StateField to hold the current decorations
const tagDecorationsField = StateField.define<DecorationSet>({
  create() {
    return Decoration.none;
  },
  update(decorations, tr) {
    for (const effect of tr.effects) {
      if (effect.is(setTagDecorationsEffect)) {
        return effect.value;
      }
    }
    return decorations.map(tr.changes);
  },
  provide: (f) => EditorView.decorations.from(f),
});

function createTagDecorationViewPlugin(getContext: () => PluginContext) {
  return ViewPlugin.fromClass(
    class {
      latestView: EditorView;

      constructor(view: EditorView) {
        this.latestView = view;
        this.triggerUpdateDecorations(view);
      }

      update(update: ViewUpdate): void {
        if (update.docChanged || update.viewportChanged) {
          this.triggerUpdateDecorations(update.view);
        }

        // Check for context update effects
        for (const effect of update.transactions.flatMap((tr) => tr.effects)) {
          if (effect.is(contextUpdateEffect)) {
            this.triggerUpdateDecorations(update.view);
            break;
          }
        }
      }

      triggerUpdateDecorations(view: EditorView): void {
        this.latestView = view;

        this.buildDecorations(view)
          .then((decorations) => {
            if (view !== this.latestView) {
              // If the view has changed, skip the update
              return;
            }

            view.dispatch({
              effects: setTagDecorationsEffect.of(decorations),
            });
          })
          .catch((error) => {
            console.error("Failed to build decorations:", error);
          });
      }

      async buildDecorations(view: EditorView): Promise<DecorationSet> {
        const context = getContext();
        const { i18n, mode, dictionaryEngine } = context;

        const decorations = [];
        const doc = view.state.doc;
        const text = doc.toString();

        const tokenRanges = findTokenRanges(stripComments(text));
        const queryWords = tokenRanges
          .map((range) => range.token?.name)
          .filter((v): v is string => v != null);

        const queryResult = await dictionaryEngine?.query_words(queryWords);
        if (!queryResult) {
          console.warn("Dictionary engine not available");
        }

        const tagMap = new Map(queryResult ?? []);

        for (const { text: tagText, token, start, end } of tokenRanges) {
          if (!token) {
            // whitespace
            continue;
          }

          if (token.type === "chant_marker") {
            if (mode === "chants") {
              decorations.push(
                Decoration.mark({
                  class: tw("font-bold text-(--keyword-chant)"),
                  attributes: {
                    title: i18n["editor.decoration.keywordHintChantMarker"]({
                      name: token.name,
                    }),
                  },
                }).range(start, end),
              );
            } else {
              // Chant markers are not relevant in prompt mode, show as invalid
              decorations.push(
                Decoration.mark({
                  class: tw("font-bold text-(--keyword-invalid) underline"),
                  attributes: {
                    title:
                      i18n[
                        "editor.decoration.keywordHintChantMarkerNotAllowed"
                      ](),
                  },
                }).range(start, end),
                ...createWidgetsForTag(
                  { type: "invalid", text: tagText },
                  context,
                ).map((d) => d.range(end, end)),
              );
            }
            continue;
          }

          if (mode === "chants" && token.type === "chant") {
            // Chant tokens are not relevant in chants mode, show as invalid
            decorations.push(
              Decoration.mark({
                class: tw("font-bold text-(--keyword-invalid) underline"),
                attributes: {
                  title: i18n["editor.decoration.keywordHintChantNotAllowed"](),
                },
              }).range(start, end),
              ...createWidgetsForTag(
                { type: "invalid", text: tagText },
                context,
              ).map((d) => d.range(end, end)),
            );
            continue;
          }

          const tagData = createTagData(token, context, tagMap);
          decorations.push(
            ...createDecorationsForTag(tagData, context).map((d) =>
              d.range(start, end),
            ),
            ...createWidgetsForTag(tagData, context).map((d) =>
              d.range(end, end),
            ),
          );
        }

        return Decoration.set(decorations);
      }
    },
  );
}

export const tagDecorationPlugin = {
  of: (getContext: () => PluginContext) => [
    tagDecorationsField,
    createTagDecorationViewPlugin(getContext),
  ],
};
