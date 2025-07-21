import { createStore } from "jotai/vanilla";
import {
  createEmptyResourceDefinition,
  type ResourceDefinition,
} from "./core/resources.js";
import { dataAPIAtom, type DataAPI } from "./states/app/data-loading.js";
import {
  fileStorageAPIAtom,
  type FileStorageAPI,
} from "./states/app/file-storage.js";
import { setStorageAPI, type StorageAPI } from "./states/app/storage-utils.js";
import type { CPSToastManagerElement } from "./toast-manager.svelte";
import type { CPSPromptStudioElement } from "./widget/prompt-studio.svelte";

import "./toast-manager.svelte";
import "./widget/prompt-studio.svelte";

type AppStore = ReturnType<typeof createStore>;

export interface InitializeResult {
  toastManager: CPSToastManagerElement;
}

export interface AppOptions {
  storage: StorageAPI;
  data?: DataAPI;
  fileStorage?: FileStorageAPI;
  resourceDefinition?: ResourceDefinition;
}

export interface App {
  ready: Promise<InitializeResult>;
  cleanup(): void;
  openPromptStudio: (options: {
    onInput?: (compiledPrompt: string) => void;
    onClose?: () => void;
  }) => CPSPromptStudioElement;
  openPromptStudioForTextArea: (
    targetTextArea: HTMLTextAreaElement,
  ) => CPSPromptStudioElement;
  setResourceDefinition: (resourceDefinition: ResourceDefinition) => void;
}

async function initialize(
  store: AppStore,
  storageAPI: StorageAPI,
  dataAPI: DataAPI | undefined,
  fileStorageAPI: FileStorageAPI | undefined,
  signal: AbortSignal,
): Promise<InitializeResult> {
  await setStorageAPI(store.get, store.set, storageAPI);

  if (dataAPI) {
    store.set(dataAPIAtom, dataAPI);
  }

  if (fileStorageAPI) {
    store.set(fileStorageAPIAtom, fileStorageAPI);
  }

  if (signal.aborted) {
    throw new Error("Initialization aborted");
  }

  // Initialize toast manager
  const toastManager = document.createElement("cps-toast-manager");
  toastManager.store = store;
  document.body.appendChild(toastManager);

  // Handle cleanup on signal abort
  signal.addEventListener(
    "abort",
    () => {
      toastManager.remove();
    },
    { once: true },
  );

  return {
    toastManager,
  };
}

export function createApp(appOptions: AppOptions): App {
  const {
    storage,
    data,
    fileStorage,
    resourceDefinition: initialResourceDefinition,
  } = appOptions;

  const controller = new AbortController();
  const { signal } = controller;

  let currentResourceDefinition: ResourceDefinition =
    initialResourceDefinition ?? createEmptyResourceDefinition();
  const existingPromptStudioElementSet = new Set<CPSPromptStudioElement>();

  const appStore = createStore();
  const ready = initialize(appStore, storage, data, fileStorage, signal);

  const cleanup = (): void => {
    if (signal.aborted) {
      return;
    }

    controller.abort();
  };

  const openPromptStudio = ({
    value,
    onInput,
    onClose,
  }: {
    value?: string;
    onInput?: (compiledPrompt: string) => void;
    onClose?: (compiledPrompt: string | null) => void;
  }): CPSPromptStudioElement => {
    const elementController = new AbortController();
    const { signal: elementSignal } = elementController;

    const promptStudioElement = document.createElement("cps-prompt-studio");

    promptStudioElement.value = value ?? "";
    promptStudioElement.store = appStore;
    promptStudioElement.resourceDefinition = currentResourceDefinition;

    promptStudioElement.addEventListener("cps-input", (event) => {
      event.stopPropagation();

      const compiledPrompt = promptStudioElement.compiledPrompt;
      if (compiledPrompt?.state !== "latest") {
        return;
      }

      onInput?.(compiledPrompt.text);
    });

    promptStudioElement.addEventListener("cps-close", () => {
      onClose?.(promptStudioElement.compiledPrompt?.text ?? null);
      elementController.abort();
    });

    elementSignal.addEventListener(
      "abort",
      () => {
        promptStudioElement.remove();
        existingPromptStudioElementSet.delete(promptStudioElement);
      },
      { once: true },
    );

    signal.addEventListener(
      "abort",
      () => {
        elementController.abort();
      },
      { once: true, signal: elementSignal },
    );

    document.body.appendChild(promptStudioElement);
    existingPromptStudioElementSet.add(promptStudioElement);

    return promptStudioElement;
  };

  const textAreaToCPSMap = new WeakMap<
    HTMLTextAreaElement,
    CPSPromptStudioElement
  >();

  const openPromptStudioForTextArea = (
    targetTextArea: HTMLTextAreaElement,
  ): CPSPromptStudioElement => {
    const existingElement = textAreaToCPSMap.get(targetTextArea);
    if (existingElement) {
      existingElement.focus();
      return existingElement;
    }

    const element = openPromptStudio({
      value: targetTextArea.value,
      onInput: (compiledPrompt): void => {
        targetTextArea.value = compiledPrompt;
        targetTextArea.dispatchEvent(new Event("input", { bubbles: true }));
      },
      onClose: (compiledPrompt): void => {
        // re-update the textarea value
        if (compiledPrompt != null) {
          targetTextArea.value = compiledPrompt;
          targetTextArea.dispatchEvent(new Event("input", { bubbles: true }));
        }

        textAreaToCPSMap.delete(targetTextArea);
        targetTextArea.focus();
      },
    });
    textAreaToCPSMap.set(targetTextArea, element);

    return element;
  };

  const setResourceDefinition = (
    resourceDefinition: ResourceDefinition,
  ): void => {
    currentResourceDefinition = resourceDefinition;
    for (const element of existingPromptStudioElementSet) {
      element.resourceDefinition = currentResourceDefinition;
    }
  };

  return {
    ready,
    cleanup,
    openPromptStudio,
    openPromptStudioForTextArea,
    setResourceDefinition,
  };
}
