import { atom, type Getter, type Setter } from "jotai/vanilla";
import { extractOriginalPrompt, type RestorationResult } from "../../core/restoration.js";
import { fileStorageAPIAtom } from "../app/file-storage.js";
import { appStoreAtom } from "./app-store.js";

export type RestorationState =
  | { state: "idle"; originalPrompt: string }
  | { state: "restoring"; originalPrompt: null }
  | { state: "error"; originalPrompt: string }
  | { 
      state: "conflict"; 
      originalPrompt: null;
      conflict: {
        savedPrompt: string;
        currentFileContent: string;
        filename: string;
      };
    };

export type ConflictResolution = "keep-restored" | "use-current-file";

// Base atoms (non-exported)
const valueBaseAtom = atom<string>("");
const restorationStateBaseAtom = atom<RestorationState>({
  state: "idle",
  originalPrompt: "",
});

// Conflict resolution atom
const conflictResolutionBaseAtom = atom<ConflictResolution | null>(null);

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
    
    // Use the new overload that returns conflict information
    const result: RestorationResult | null = await extractOriginalPrompt(value, fileAPI, true);

    // Check if the value hasn't changed during restoration
    if (get(valueBaseAtom) === value) {
      if (!result) {
        set(restorationStateBaseAtom, {
          state: "idle",
          originalPrompt: value,
        });
      } else if (result.conflict) {
        // There's a conflict between saved and current file content
        set(restorationStateBaseAtom, {
          state: "conflict",
          originalPrompt: null,
          conflict: result.conflict,
        });
      } else {
        // No conflict, use the restored prompt
        set(restorationStateBaseAtom, {
          state: "idle",
          originalPrompt: result.originalPrompt,
        });
      }
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

// Conflict resolution atom 
export const conflictResolutionAtom = atom(
  (get) => get(conflictResolutionBaseAtom),
  (get, set, resolution: ConflictResolution) => {
    const state = get(restorationStateBaseAtom);
    if (state.state !== "conflict") {
      return;
    }

    set(conflictResolutionBaseAtom, resolution);

    // Resolve the conflict based on user choice
    if (resolution === "keep-restored") {
      // Keep the restored prompt as untitled (no file association)
      set(restorationStateBaseAtom, {
        state: "idle",
        originalPrompt: state.conflict.savedPrompt,
      });
    } else if (resolution === "use-current-file") {
      // Use the current file content and maintain file association
      set(restorationStateBaseAtom, {
        state: "idle", 
        originalPrompt: state.conflict.currentFileContent,
      });
    }
  },
);

// Convenience atoms for common checks
export const isRestoringAtom = atom<boolean>(
  (get) => get(restorationStateAtom).state === "restoring",
);

export const hasConflictAtom = atom<boolean>(
  (get) => get(restorationStateAtom).state === "conflict",
);

export const restoredPromptAtom = atom<string>(
  (get) => get(restorationStateAtom).originalPrompt ?? "",
);
