import type {
  CompletionResultEntry,
  QueryResultEntry,
} from "../../../../wasm/pkg/cps_lib.js";
import { DictionaryEngine } from "../../../../wasm/pkg/cps_lib.js";
import { wasmReady } from "../init.js";
import type { IDictionaryEngine } from "./interface.js";

export class DictionaryEngineWrapper implements IDictionaryEngine {
  #enginePromise: Promise<DictionaryEngine>;
  readonly #ready: Promise<void>;

  constructor(dictionaries: readonly string[]) {
    this.#enginePromise = wasmReady.then(
      () => new DictionaryEngine(dictionaries as string[]),
    );
    this.#ready = this.#enginePromise.then(() => {});
  }

  async fuzzy_search(
    query: string,
    maxEntries?: number,
    forceNonAscii?: boolean,
  ): Promise<CompletionResultEntry[]> {
    const engine = await this.#enginePromise;
    return engine.fuzzy_search(query, maxEntries, forceNonAscii);
  }

  async query_words(words: readonly string[]): Promise<QueryResultEntry[]> {
    const engine = await this.#enginePromise;
    return engine.query_words(words as string[]);
  }

  free(): void {
    this.#enginePromise.then((engine) => {
      engine.free();
    });
    this.#enginePromise = Promise.reject(
      new Error("DictionaryEngineWrapper has been freed"),
    );
  }

  get ready(): Promise<void> {
    return this.#ready;
  }
}
