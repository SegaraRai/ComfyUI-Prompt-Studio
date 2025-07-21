import { atom } from "jotai/vanilla";
import { parseChants, type ChantDefinition } from "../../core/chants.js";
import { atomWithAppStorage } from "./storage-utils.js";

export const chantsTextAtom = atomWithAppStorage<string>("chants", "user", "");

export const chantDefinitionsAtom = atom<readonly ChantDefinition[]>((get) =>
  parseChants(get(chantsTextAtom)),
);
