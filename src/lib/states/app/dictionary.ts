import { atom, type Setter } from "jotai/vanilla";
import { createDictionaryEngine } from "../../wasm/dictionary-engine/factory.js";
import type { IDictionaryEngine } from "../../wasm/dictionary-engine/interface.js";
import { addCustomInitializer, atomWithAppStorage } from "./storage-utils.js";
import { addToast, formatErrorMessage } from "./toast.js";

const dictionariesBaseAtom = atomWithAppStorage<string[]>(
  "dictionaries",
  "user",
  [],
);

const dictionaryEngineBaseAtom = atom<IDictionaryEngine>();

function handleInitialization(set: Setter, engine: IDictionaryEngine): void {
  addToast(set, {
    severity: "info",
    message: "toast.initializingDictionaryEngine",
  });

  engine.ready.then(
    () => {
      addToast(set, {
        severity: "info",
        message: "toast.dictionaryEngineInitialized",
      });
    },
    (error) => {
      console.error("[DictionaryEngine] Initialization failed:", error);
      addToast(set, {
        severity: "error",
        message: "toast.dictionaryEngineInitializationFailed",
        params: { error: formatErrorMessage(error) },
      });
      set(dictionaryEngineBaseAtom, undefined);
    },
  );
}

export const dictionaryEngineAtom = atom((get) =>
  get(dictionaryEngineBaseAtom),
);

export const dictionariesAtom = atom(
  (get) => get(dictionariesBaseAtom),
  (get, set, newDictionaries: string[]) => {
    set(dictionariesBaseAtom, newDictionaries);
    const oldEngine = get(dictionaryEngineBaseAtom);
    oldEngine?.free();

    const newEngine = createDictionaryEngine(newDictionaries);
    set(dictionaryEngineBaseAtom, newEngine);
    handleInitialization(set, newEngine);
  },
);

addCustomInitializer((get, set) => {
  const dictionaries = get(dictionariesAtom);
  const engine = createDictionaryEngine(dictionaries);
  set(dictionaryEngineBaseAtom, engine);
  handleInitialization(set, engine);

  return () => {
    get(dictionaryEngineBaseAtom)?.free();
    set(dictionaryEngineBaseAtom, undefined);
  };
});
