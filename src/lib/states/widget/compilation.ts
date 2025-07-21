import { atom, type Getter, type Setter } from "jotai/vanilla";
import { compilePrompt, type CompileContext } from "../../core/compile.js";
import { embedOriginalPrompt } from "../../core/restoration.js";
import {
  documentContentAtom,
  documentFilenameAtom,
  registerDocumentUpdateCallback,
} from "./document.js";

export type CompiledPrompt =
  | {
      state: "stale" | "latest";
      text: string;
    }
  | {
      state: "loading";
      text: null;
    };

const compileContextBaseAtom = atom<CompileContext>();
const compiledPromptBaseAtom = atom<CompiledPrompt>({
  state: "loading",
  text: null,
});

// Async compilation function
const triggerCompilation = async (
  get: Getter,
  set: Setter,
  promptText: string,
  context: CompileContext | undefined,
) => {
  if (!context) {
    return;
  }

  try {
    const compiled = await embedOriginalPrompt(
      promptText,
      compilePrompt(promptText, context),
      get(documentFilenameAtom),
    );
    if (
      get(documentContentAtom) === promptText &&
      get(compileContextBaseAtom) === context
    ) {
      set(compiledPromptBaseAtom, { state: "latest", text: compiled });
    }
  } catch (error) {
    console.error("Failed to compile prompt:", error);
  }
};

export const compileContextAtom = atom(
  (get) => get(compileContextBaseAtom),
  (get, set, newValue: CompileContext | undefined) => {
    set(compileContextBaseAtom, newValue);
    set(compiledPromptBaseAtom, (old) =>
      old.state === "loading"
        ? old
        : {
            state: "stale",
            text: old.text,
          },
    );

    triggerCompilation(get, set, get(documentContentAtom), newValue);
  },
);

export const compiledPromptAtom = atom<CompiledPrompt>((get) =>
  get(compiledPromptBaseAtom),
);

export const cleanCompiledPromptAtom = atom<string | null>((get) => {
  const promptText = get(documentContentAtom);
  const context = get(compileContextBaseAtom);
  if (!context) {
    return null;
  }

  try {
    return compilePrompt(promptText, context);
  } catch (error) {
    console.error("Failed to clean compile prompt:", error);
    return null;
  }
});

// Set up compilation trigger to be called from document.ts
registerDocumentUpdateCallback(
  (get: Getter, set: Setter, newState, oldState) => {
    if (newState.content === oldState.content) {
      // No change in content, no need to recompile
      return;
    }

    set(compiledPromptBaseAtom, (old) =>
      old.state === "loading"
        ? old
        : {
            state: "stale",
            text: old.text,
          },
    );

    triggerCompilation(get, set, newState.content, get(compileContextBaseAtom));
  },
);
