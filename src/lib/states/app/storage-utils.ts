import { atom, type Getter, type Setter } from "jotai/vanilla";
import { addToast, formatErrorMessage } from "./toast.js";

export type StorageState = "initial" | "loading" | "ready" | "reloading";

export type StorageLevel = "user" | "local" | "server";

export interface StorageAPI {
  loadStorage(key: string, level: StorageLevel): Promise<string | null>;
  saveStorage(key: string, value: string, level: StorageLevel): Promise<void>;
  subscribeToStorage(
    key: string,
    level: StorageLevel,
    callback: (value: string | null) => void,
  ): () => void;
}

const storageAPIAtom = atom<StorageAPI>();

const storageStateBaseAtom = atom<StorageState>("initial");

const initializers: ((
  get: Getter,
  set: Setter,
  api: StorageAPI,
  deinitializers: (() => void)[],
) => Promise<void>)[] = [];
const deinitializersMap = new WeakMap<StorageAPI, (() => void)[]>();

const customInitializers: ((
  get: Getter,
  set: Setter,
) => void | (() => void))[] = [];

export const storageInitializedAtom = atom((get) => get(storageStateBaseAtom));

export async function setStorageAPI(
  get: Getter,
  set: Setter,
  api: StorageAPI,
): Promise<void> {
  set(storageStateBaseAtom, (value) =>
    value === "initial" ? "loading" : "reloading",
  );

  set(storageAPIAtom, (previousApi) => {
    if (previousApi) {
      const deinitializers = deinitializersMap.get(previousApi);
      if (deinitializers) {
        for (const deinitializer of deinitializers) {
          deinitializer();
        }
        deinitializersMap.delete(previousApi);
      }
    }

    return api;
  });

  // Run initializers
  const deinitializers: (() => void)[] = [];
  deinitializersMap.set(api, deinitializers);
  for (const initializer of initializers) {
    await initializer(get, set, api, deinitializers).catch((error) => {
      addToast(set, {
        severity: "error",
        message: "toast.storageInitializationFailed",
        params: { error: formatErrorMessage(error) },
      });
    });
  }

  // Run custom initializers
  for (const customInitializer of customInitializers) {
    try {
      const deinitializer = customInitializer(get, set);
      if (typeof deinitializer === "function") {
        deinitializers.unshift(deinitializer);
      }
    } catch (error) {
      addToast(set, {
        severity: "error",
        message: "toast.customInitializerFailed",
        params: { error: formatErrorMessage(error) },
      });
    }
  }

  set(storageStateBaseAtom, "ready");
}

export function addCustomInitializer(
  initializer: (get: Getter, set: Setter) => void | (() => void),
): void {
  customInitializers.push(initializer);
}

export function atomWithAppStorage<T>(
  key: string,
  level: StorageLevel,
  initialValue: T,
) {
  const baseAtom = atom(initialValue);

  const derivedAtom = atom(
    (get) => get(baseAtom),
    (get, set, update) => {
      const nextValue =
        typeof update === "function" ? update(get(baseAtom)) : update;
      set(baseAtom, nextValue);

      const api = get(storageAPIAtom);
      if (!api) {
        throw new Error(
          "Storage API is not initialized. Ensure storageAPIAtom is set before using atomWithAppStorage.",
        );
      }

      api.saveStorage(key, JSON.stringify(nextValue), level).catch((error) => {
        addToast(set, {
          severity: "error",
          message: "toast.storageSaveFailed",
          params: { key, level, error: formatErrorMessage(error) },
        });
      });
    },
  );

  initializers.push(async (_get, set, api, deinitializers) => {
    try {
      const unsubscribe = api.subscribeToStorage(key, level, (value) => {
        if (value !== null) {
          try {
            const parsedValue = JSON.parse(value);
            set(baseAtom, parsedValue);
          } catch (error) {
            addToast(set, {
              severity: "error",
              message: "toast.storageParsingFailed",
              params: { key, level, error: formatErrorMessage(error) },
            });
          }
        }
      });
      deinitializers.unshift(unsubscribe);
    } catch (cause) {
      throw new Error(
        `Failed to subscribe to storage for key "${key}" at level "${level}"`,
        { cause },
      );
    }

    try {
      const value = await api.loadStorage(key, level);
      if (value !== null) {
        const parsedValue = JSON.parse(value);
        set(baseAtom, parsedValue);
        return;
      }
    } catch (cause) {
      throw new Error(
        `Failed to load storage for key "${key}" at level "${level}"`,
        { cause },
      );
    }

    // Store the initial value if no value exists
    try {
      await api.saveStorage(key, JSON.stringify(initialValue), level);
      set(baseAtom, initialValue);
    } catch (cause) {
      throw new Error(
        `Failed to save initial value for key "${key}" at level "${level}"`,
        { cause },
      );
    }
  });

  return derivedAtom;
}
