import type {
  CompletionResultEntry,
  QueryResultEntry,
} from "../../../../wasm/pkg/cps_lib.js";

export interface IDictionaryEngine {
  fuzzy_search(
    query: string,
    maxEntries?: number,
    forceNonAscii?: boolean,
  ): Promise<CompletionResultEntry[]> | CompletionResultEntry[];

  query_words(
    words: readonly string[],
  ): Promise<QueryResultEntry[]> | QueryResultEntry[];

  free(): void;

  readonly ready: Promise<void>;
}
