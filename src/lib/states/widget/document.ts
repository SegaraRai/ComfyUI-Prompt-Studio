import { atom, type Getter, type Setter } from "jotai/vanilla";

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
