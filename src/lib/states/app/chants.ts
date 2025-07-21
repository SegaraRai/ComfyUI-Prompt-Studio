import { atom } from "jotai/vanilla";
import { parseChants, type ChantDefinition } from "../../core/chants.js";
import { addCustomInitializer, atomWithAppStorage } from "./storage-utils.js";

const chantsTextBaseAtom = atomWithAppStorage<string>("chants", "user", "");

const chantDefinitionsBaseAtom = atom<readonly ChantDefinition[]>([]);

export const chantsTextAtom = atom(
  (get) => get(chantsTextBaseAtom),
  (get, set, newValue: string) => {
    if (newValue === get(chantsTextBaseAtom)) {
      return;
    }

    set(chantsTextBaseAtom, newValue);
    set(chantDefinitionsBaseAtom, parseChants(newValue));
  },
);

export const chantDefinitionsAtom = atom<readonly ChantDefinition[]>((get) =>
  get(chantDefinitionsBaseAtom),
);

addCustomInitializer((get, set) => {
  const chantsText = get(chantsTextAtom);
  set(chantDefinitionsBaseAtom, parseChants(chantsText));
});
