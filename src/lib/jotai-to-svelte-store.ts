import type {
  Atom,
  PrimitiveAtom,
  WritableAtom,
  createStore,
} from "jotai/vanilla";

type JotaiStore = ReturnType<typeof createStore>;

export type SvelteStateReadonly<T> = {
  subscribe: (subscription: (value: T) => void) => () => void;
};
export type SvelteStateWritable<T> = {
  subscribe: (subscription: (value: T) => void) => () => void;
  set: (value: T) => void;
};
export type SvelteState<T> = SvelteStateReadonly<T> | SvelteStateWritable<T>;

export function jotai<T>(
  atom: PrimitiveAtom<T>,
  store: JotaiStore,
): SvelteStateWritable<T>;
export function jotai<T>(
  atom: WritableAtom<T, [T], unknown>,
  store: JotaiStore,
): SvelteStateWritable<T>;
export function jotai<T>(
  atom: Atom<T>,
  store: JotaiStore,
): SvelteStateReadonly<T>;

export function jotai<T>(
  atom: Atom<T> | PrimitiveAtom<T> | WritableAtom<T, [T], unknown>,
  store: JotaiStore,
): SvelteState<T> {
  if ("write" in atom) {
    return {
      subscribe: (subscription) => {
        subscription(store.get(atom));
        return store.sub(atom, () => {
          subscription(store.get(atom));
        });
      },
      set: (value: T) => {
        store.set(atom, value);
      },
    };
  }

  return {
    subscribe: (subscription) => {
      subscription(store.get(atom));
      return store.sub(atom, () => {
        subscription(store.get(atom));
      });
    },
  };
}
