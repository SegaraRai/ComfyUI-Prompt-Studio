import type {
  CompletionResultEntry,
  QueryResultEntry,
} from "../../../../wasm/pkg/cps_lib.js";
import type { IDictionaryEngine } from "./interface.js";
import type { WorkerMessage, WorkerResponse } from "./worker.js";

/**
 * Proxy class that mimics the DictionaryEngine interface but delegates to a web worker
 */
export class DictionaryEngineWorkerProxy implements IDictionaryEngine {
  readonly #worker: Worker;
  readonly #abortController: AbortController = new AbortController();
  readonly #pendingRequests = new Map<
    string,
    {
      resolve: (value: unknown) => void;
      reject: (error: Error) => void;
    }
  >();
  readonly #initPromise: Promise<void>;
  #requestIdCounter = 0;

  constructor(dictionaries: readonly string[]) {
    const { signal } = this.#abortController;

    // Create worker from the worker file
    this.#worker = new Worker(new URL("./worker.js", import.meta.url), {
      type: "module",
    });

    this.#worker.addEventListener(
      "message",
      this.#handleWorkerMessage.bind(this),
      { signal },
    );
    this.#worker.addEventListener("error", this.#handleWorkerError.bind(this), {
      signal,
    });

    // Initialize the worker
    this.#initPromise = this.#initialize(dictionaries);
  }

  #handleWorkerMessage(
    event: MessageEvent<WorkerResponse | { type: "ready" }>,
  ) {
    const response = event.data;
    if ("type" in response && response.type === "ready") {
      return; // Worker ready signal, ignore
    }

    const pending = this.#pendingRequests.get(response.id);
    if (!pending) {
      console.warn("Received response for unknown request:", response.id);
      return;
    }

    this.#pendingRequests.delete(response.id);

    if (response.type === "success") {
      pending.resolve(response.data);
    } else {
      pending.reject(new Error(response.error || "Unknown worker error"));
    }
  }

  #handleWorkerError(error: ErrorEvent) {
    console.error("Worker error:", error);

    // Reject all pending requests
    for (const pending of this.#pendingRequests.values()) {
      pending.reject(new Error(`Worker error: ${error.message}`));
    }
    this.#pendingRequests.clear();

    this.#worker.terminate();
    this.#abortController.abort();
  }

  private sendMessage<T = unknown>(
    type: "init" | "fuzzy_search" | "query_words",
    data?: WorkerMessage["data"],
  ): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const id = `req_${++this.#requestIdCounter}`;
      this.#pendingRequests.set(id, {
        resolve: (value: unknown) => resolve(value as T),
        reject,
      });

      const message: WorkerMessage = { id, type, data };
      this.#worker.postMessage(message);
    });
  }

  async #initialize(dictionaries: readonly string[]): Promise<void> {
    try {
      await this.sendMessage("init", { dictionaries });
    } catch (error) {
      throw new Error(`Failed to initialize dictionary engine: ${error}`);
    }
  }

  async fuzzy_search(
    query: string,
    maxEntries?: number,
    forceNonAscii?: boolean,
  ): Promise<CompletionResultEntry[]> {
    await this.#initPromise;
    return this.sendMessage<CompletionResultEntry[]>("fuzzy_search", {
      query,
      maxEntries,
      forceNonAscii,
    });
  }

  async query_words(words: readonly string[]): Promise<QueryResultEntry[]> {
    await this.#initPromise;
    return this.sendMessage<QueryResultEntry[]>("query_words", { words });
  }

  /**
   * Clean up the worker
   */
  free(): void {
    this.#worker.terminate();
    this.#abortController.abort();

    // Reject all pending requests
    for (const pending of this.#pendingRequests.values()) {
      pending.reject(new Error("Worker disposed"));
    }
    this.#pendingRequests.clear();
  }

  get ready(): Promise<void> {
    return this.#initPromise;
  }
}
