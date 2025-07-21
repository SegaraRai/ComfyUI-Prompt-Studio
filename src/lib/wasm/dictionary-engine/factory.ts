import type { IDictionaryEngine } from "./interface.js";
import { DictionaryEngineWorkerProxy } from "./proxy.js";
import { DictionaryEngineWrapper } from "./wrapper.js";

import "../init.js";

const supportsWorkers = typeof Worker !== "undefined";

export function createDictionaryEngine(
  dictionaries: readonly string[],
): IDictionaryEngine {
  if (supportsWorkers) {
    // Use web worker for non-blocking initialization
    return new DictionaryEngineWorkerProxy(dictionaries);
  } else {
    // Fallback to main thread (will block UI during initialization)
    console.warn(
      "[DictionaryEngine] Web Workers not supported, falling back to main thread",
    );
    return new DictionaryEngineWrapper(dictionaries);
  }
}
