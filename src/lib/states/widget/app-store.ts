import { atom, type createStore } from "jotai/vanilla";

export const appStoreAtom = atom<ReturnType<typeof createStore>>();
