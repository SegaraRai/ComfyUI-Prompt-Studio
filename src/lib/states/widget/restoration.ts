import { atom, type Getter, type Setter } from "jotai/vanilla";
import { extractOriginalPrompt } from "../../core/restoration.js";
import { fileStorageAPIAtom } from "../app/file-storage.js";
import { appStoreAtom } from "./app-store.js";

export type RestorationState =
  | { state: "idle"; originalPrompt: string }
  | { state: "restoring"; originalPrompt: null }
  | { state: "error"; originalPrompt: string };

// Base atoms (non-exported)
const valueBaseAtom = atom<string>("");
const restorationStateBaseAtom = atom<RestorationState>({
  state: "idle",
  originalPrompt: "",
});

// Async restoration function
const triggerRestoration = async (get: Getter, set: Setter, value: string) => {
  if (!value) {
    set(restorationStateBaseAtom, { state: "idle", originalPrompt: "" });
    return;
  }

  set(restorationStateBaseAtom, { state: "restoring", originalPrompt: null });

  try {
    const appStore = get(appStoreAtom);
    if (!appStore) {
      throw new Error("App store is not initialized");
    }

    const fileStorageAPI = appStore.get(fileStorageAPIAtom);
    const fileAPI = fileStorageAPI ? { load: fileStorageAPI.load } : null;
    const originalPrompt = await extractOriginalPrompt(value, fileAPI);

    // Check if the value hasn't changed during restoration
    if (get(valueBaseAtom) === value) {
      set(restorationStateBaseAtom, {
        state: "idle",
        originalPrompt: originalPrompt ?? value,
      });
    }
  } catch (error) {
    console.error("Failed to restore original prompt:", error);
    if (get(valueBaseAtom) === value) {
      set(restorationStateBaseAtom, {
        state: "error",
        originalPrompt: value,
      });
    }
  }
};

// Value atom that triggers restoration
export const valueAtom = atom(
  (get) => get(valueBaseAtom),
  (get, set, newValue: string) => {
    set(valueBaseAtom, newValue);
    triggerRestoration(get, set, newValue);
  },
);

// Restoration state atom (read-only)
export const restorationStateAtom = atom<RestorationState>((get) =>
  get(restorationStateBaseAtom),
);

// Convenience atoms for common checks
export const isRestoringAtom = atom<boolean>(
  (get) => get(restorationStateAtom).state === "restoring",
);

export const restoredPromptAtom = atom<string>(
  (get) => get(restorationStateAtom).originalPrompt ?? "",
);
