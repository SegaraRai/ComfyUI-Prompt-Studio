import { atom, type Getter, type Setter } from "jotai/vanilla";
import { extractOriginalPrompt, type RestorationResult } from "../../core/restoration.js";
import { fileStorageAPIAtom } from "../app/file-storage.js";
import { documentContentAtom } from "./document.js";
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
    }
  | {
      state: "editing-conflict";
      originalPrompt: null;
      conflict: {
        currentContent: string;
        restoredContent: string;
      };
    };

export type ConflictResolution = "keep-restored" | "use-current-file" | "keep-current-edit" | "use-restored";

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
      } else {
        // Check for editing conflict first - compare restored content with current document content
        const currentDocumentContent = appStore.get(documentContentAtom);
        const restoredContent = result.originalPrompt;
        
        if (currentDocumentContent && currentDocumentContent.trim() !== "" && currentDocumentContent !== restoredContent) {
          // There's an editing conflict
          set(restorationStateBaseAtom, {
            state: "editing-conflict",
            originalPrompt: null,
            conflict: {
              currentContent: currentDocumentContent,
              restoredContent,
            },
          });
        } else if (result.conflict) {
          // There's a file conflict between saved and current file content
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
          set(shouldClearUndoHistoryBaseAtom, true);
        }
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
    if (state.state !== "conflict" && state.state !== "editing-conflict") {
      return;
    }

    set(conflictResolutionBaseAtom, resolution);

    // Resolve the conflict based on user choice
    if (state.state === "conflict") {
      // File conflict resolution
      if (resolution === "keep-restored") {
        // Keep the restored prompt as untitled (no file association)
        set(restorationStateBaseAtom, {
          state: "idle",
          originalPrompt: state.conflict.savedPrompt,
        });
        set(shouldClearUndoHistoryBaseAtom, true);
      } else if (resolution === "use-current-file") {
        // Use the current file content and maintain file association
        set(restorationStateBaseAtom, {
          state: "idle", 
          originalPrompt: state.conflict.currentFileContent,
        });
        set(shouldClearUndoHistoryBaseAtom, true);
      }
    } else if (state.state === "editing-conflict") {
      // Editing conflict resolution
      if (resolution === "keep-current-edit") {
        // Keep the current edited content
        set(restorationStateBaseAtom, {
          state: "idle",
          originalPrompt: state.conflict.currentContent,
        });
        // Don't clear history when keeping current edit
      } else if (resolution === "use-restored") {
        // Use the restored content
        set(restorationStateBaseAtom, {
          state: "idle",
          originalPrompt: state.conflict.restoredContent,
        });
        set(shouldClearUndoHistoryBaseAtom, true);
      }
    }
  },
);

// Convenience atoms for common checks
export const isRestoringAtom = atom<boolean>(
  (get) => get(restorationStateAtom).state === "restoring",
);

export const hasConflictAtom = atom<boolean>(
  (get) => {
    const state = get(restorationStateAtom).state;
    return state === "conflict" || state === "editing-conflict";
  },
);

export const restoredPromptAtom = atom<string>(
  (get) => get(restorationStateAtom).originalPrompt ?? "",
);

// Atom to track when undo history should be cleared
const shouldClearUndoHistoryBaseAtom = atom<boolean>(false);

export const shouldClearUndoHistoryAtom = atom(
  (get) => get(shouldClearUndoHistoryBaseAtom),
  (get, set, value: boolean) => {
    set(shouldClearUndoHistoryBaseAtom, value);
  },
);
