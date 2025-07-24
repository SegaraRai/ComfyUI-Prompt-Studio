import { atom, type Getter, type Setter } from "jotai/vanilla";
import { conflictResolutionAtom, restorationStateAtom, type ConflictResolution } from "./restoration.js";

export type DocumentState =
  | {
      type: "unlinked";
      content: string;
    }
  | {
      type: "linked";
      name: string;
      content: string;
      lastSavedContent: string;
    };

// Core document state atom
const documentStateBaseAtom = atom<DocumentState>({
  type: "unlinked",
  content: "",
});

// Document state with update callbacks
export type DocumentUpdateCallback = (
  get: Getter,
  set: Setter,
  newState: DocumentState,
  oldState: DocumentState,
) => void;

const documentUpdateCallbacks: DocumentUpdateCallback[] = [];

export function registerDocumentUpdateCallback(
  callback: DocumentUpdateCallback,
) {
  documentUpdateCallbacks.push(callback);
}

export const documentStateAtom = atom(
  (get) => get(documentStateBaseAtom),
  (get, set, newValue: DocumentState) => {
    const oldValue = get(documentStateBaseAtom);
    set(documentStateBaseAtom, newValue);

    // Trigger all registered callbacks
    for (const callback of documentUpdateCallbacks) {
      callback(get, set, newValue, oldValue);
    }
  },
);

export const documentContentAtom = atom(
  (get) => get(documentStateAtom).content,
  (get, set, newValue: string) => {
    set(documentStateAtom, {
      ...get(documentStateAtom),
      content: newValue,
    });
  },
);

export const documentFilenameAtom = atom((get) => {
  const state = get(documentStateAtom);
  return state.type === "linked" ? state.name : null;
});

export const documentIsDirtyAtom = atom((get) => {
  const state = get(documentStateAtom);
  return state.type === "linked"
    ? state.content !== state.lastSavedContent
    : false;
});

// Register callback to handle conflict resolution
registerDocumentUpdateCallback(
  (get: Getter, set: Setter, newState, oldState) => {
    const restorationState = get(restorationStateAtom);
    
    // If we have a conflict resolution and the content changed to the restored prompt
    if (restorationState.state === "idle" && 
        newState.content !== oldState.content && 
        restorationState.originalPrompt === newState.content) {
      
      const conflictResolution = get(conflictResolutionAtom);
      
      // If the user chose to keep the restored prompt as untitled, unlink the document
      if (conflictResolution === "keep-restored" && newState.type === "linked") {
        set(documentStateAtom, {
          type: "unlinked",
          content: newState.content,
        });
      }
      // If the user chose to use current file content, ensure it stays linked
      else if (conflictResolution === "use-current-file" && newState.type === "unlinked") {
        // This shouldn't happen in normal flow but handle it just in case
        const state = get(restorationStateAtom);
        if (state.state === "idle" && "conflict" in restorationState && restorationState.conflict) {
          set(documentStateAtom, {
            type: "linked",
            name: restorationState.conflict.filename,
            content: newState.content,
            lastSavedContent: restorationState.conflict.currentFileContent,
          });
        }
      }
    }
  },
);
