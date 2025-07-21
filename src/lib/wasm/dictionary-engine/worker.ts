// Dictionary Engine Web Worker
import init, { DictionaryEngine } from "../../../../wasm/pkg/cps_lib.js";

interface InitData {
  dictionaries: readonly string[];
}

interface FuzzySearchData {
  query: string;
  maxEntries?: number;
  forceNonAscii?: boolean;
}

interface QueryWordsData {
  words: readonly string[];
}

type WorkerMessageData = InitData | FuzzySearchData | QueryWordsData;

export interface WorkerMessage {
  id: string;
  type: "init" | "fuzzy_search" | "query_words";
  data?: WorkerMessageData;
}

export interface WorkerResponse {
  id: string;
  type: "success" | "error";
  data?: unknown;
  error?: string;
}

const initPromise = init();

let dictionaryEngine: DictionaryEngine | null = null;

self.addEventListener("message", async (event: MessageEvent<WorkerMessage>) => {
  // Note: In a web worker context, we trust the origin since it's from our own application
  const { id, type, data } = event.data;

  try {
    await initPromise;

    switch (type) {
      case "init": {
        if (!data) {
          throw new Error("Missing data for init");
        }

        const { dictionaries } = data as InitData;
        console.time("[DictionaryWorker] Engine initialization");
        dictionaryEngine = new DictionaryEngine(dictionaries as string[]);
        console.timeEnd("[DictionaryWorker] Engine initialization");

        const response: WorkerResponse = {
          id,
          type: "success",
          data: { initialized: true },
        };
        self.postMessage(response);
        break;
      }

      case "fuzzy_search": {
        if (!dictionaryEngine) {
          throw new Error("Dictionary engine not initialized");
        }
        if (!data) {
          throw new Error("Missing data for fuzzy_search");
        }

        const { query, maxEntries, forceNonAscii } = data as FuzzySearchData;
        const results = dictionaryEngine.fuzzy_search(
          query,
          maxEntries,
          forceNonAscii,
        );

        const response: WorkerResponse = {
          id,
          type: "success",
          data: results,
        };
        self.postMessage(response);
        break;
      }

      case "query_words": {
        if (!dictionaryEngine) {
          throw new Error("Dictionary engine not initialized");
        }
        if (!data) {
          throw new Error("Missing data for query_words");
        }

        const { words } = data as QueryWordsData;
        const results = dictionaryEngine.query_words(words as string[]);

        const response: WorkerResponse = {
          id,
          type: "success",
          data: results,
        };
        self.postMessage(response);
        break;
      }

      default:
        throw new Error(`Unknown message type: ${type}`);
    }
  } catch (error) {
    const response: WorkerResponse = {
      id,
      type: "error",
      error: error instanceof Error ? error.message : String(error),
    };
    self.postMessage(response);
  }
});

// Send ready signal
self.postMessage({ type: "ready" });
