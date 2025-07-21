import { StateEffect } from "@codemirror/state";
import type { ChantDefinition } from "../../core/chants.js";
import type { ResourceDefinition } from "../../core/resources.js";
import type { IDictionaryEngine } from "../../wasm/dictionary-engine/interface.js";

export type NormalizeOnAutoComplete = "none" | "underscore" | "whitespace";

export interface PluginContext {
  readonly i18n: typeof import("../../../paraglide/messages.js").m;
  readonly mode: "prompt" | "chants";
  readonly dictionaryEngine: IDictionaryEngine | null | undefined;
  readonly chantDefinitions: readonly ChantDefinition[];
  readonly resourceDefinition: ResourceDefinition;
  readonly normalizeOnAutoComplete: NormalizeOnAutoComplete;
  readonly tooltipParent: HTMLElement | null;
}

// StateEffect for triggering context updates
export const contextUpdateEffect = StateEffect.define();
