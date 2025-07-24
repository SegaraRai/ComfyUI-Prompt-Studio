import type { NormalizeOnAutoComplete } from "../../editor/codemirror-extensions/context.js";
import defaultDictionarySources from "./default-dictionary-sources.txt?raw";
import { atomWithAppStorage } from "./storage-utils.js";

export interface SettingsAppearance {
  theme: "light" | "dark";
}

export interface SettingsEditor {
  fontSize: string;
  fontFamily: string;
  lineHeight: string;
  normalizeOnAutoComplete: NormalizeOnAutoComplete;
}

export interface SettingsCompilation {
  normalize: "none" | "underscore" | "whitespace";
  escapeTarget: "none" | "parentheses";
  duplicateTagHandling: "overwrite" | "ignore" | "add" | "multiply";
  encodeOriginalForLinkedFiles: boolean;
}

export interface SettingsData {
  dictionarySources: string;
}

// Default settings values
const defaultSettingsAppearance: SettingsAppearance = {
  theme: "dark",
};

const defaultSettingsEditor: SettingsEditor = {
  fontSize: "14",
  fontFamily: "monospace",
  lineHeight: "1.5",
  normalizeOnAutoComplete: "underscore",
};

const defaultSettingsCompilation: SettingsCompilation = {
  normalize: "underscore",
  escapeTarget: "none",
  duplicateTagHandling: "overwrite",
  encodeOriginalForLinkedFiles: true,
};

const defaultSettingsData: SettingsData = {
  dictionarySources: defaultDictionarySources,
};

// Atoms
export const settingsAppearanceAtom = atomWithAppStorage<SettingsAppearance>(
  "settings.appearance",
  "user",
  defaultSettingsAppearance,
);

export const settingsEditorAtom = atomWithAppStorage<SettingsEditor>(
  "settings.editor",
  "user",
  defaultSettingsEditor,
);

export const settingsCompilationAtom = atomWithAppStorage<SettingsCompilation>(
  "settings.compilation",
  "user",
  defaultSettingsCompilation,
);

export const settingsDataAtom = atomWithAppStorage<SettingsData>(
  "settings.data",
  "user",
  defaultSettingsData,
);
