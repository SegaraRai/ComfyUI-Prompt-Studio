<svelte:options
  customElement={{
    tag: "cps-prompt-file-list",
    extend: (cls) => {
      return class extends cls {
        constructor() {
          super();

          initializeComponentStylesheet(this, ":host{display:contents;}");
        }

        override focus(options?: FocusOptions): void {
          this.shadowRoot?.querySelector<HTMLElement>("input")?.focus(options);
        }
      };
    },
  }}
/>

<script module lang="ts">
  import type { HTMLAttributes } from "svelte/elements";

  export declare class CPSPromptListElement extends HTMLElement {
    constructor();

    store: ReturnType<typeof createStore>;
    widgetStore: ReturnType<typeof createStore>;

    disabled: boolean;
    focusOnMount: boolean;
  }

  export interface CPSPromptListAttributes
    extends HTMLAttributes<CPSPromptListElement> {
    store: ReturnType<typeof createStore>;
    widgetStore: ReturnType<typeof createStore>;
    disabled?: boolean | null | undefined;
    focusOnMount?: boolean | null | undefined;
  }
</script>

<script lang="ts">
  import type { createStore } from "jotai/vanilla";
  import { focus } from "../actions/focus.js";
  import { initializeComponentStylesheet } from "../component-utils.js";
  import { jotai } from "../jotai-to-svelte-store.js";
  import {
    fileStorageAPIAtom,
    loadPromptFile,
    refreshSavedFiles,
    savedFilesAtom,
  } from "../states/app/file-storage.js";
  import { i18nAtom } from "../states/app/i18n.js";
  import { addToast, formatErrorMessage } from "../states/app/toast.js";
  import { documentStateAtom } from "../states/widget/document.js";

  let {
    store,
    widgetStore,
    disabled = false,
    focusOnMount = false,
  }: {
    store: ReturnType<typeof createStore>;
    widgetStore: ReturnType<typeof createStore>;
    disabled?: boolean;
    focusOnMount?: boolean;
  } = $props();

  // Container
  let containerElement = $state<HTMLElement>();

  // States and i18n
  const m = $derived(jotai(i18nAtom, store));
  const savedFiles = $derived(jotai(savedFilesAtom, store));
  const fileStorageAPI = $derived(jotai(fileStorageAPIAtom, store));
  const documentState = $derived(jotai(documentStateAtom, widgetStore));

  // Search
  let searchQuery = $state("");

  const filteredSavedFiles = $derived(
    $savedFiles.filter((file) =>
      file.name.toLowerCase().includes(searchQuery.toLowerCase()),
    ),
  );
  const defaultName = $derived(filteredSavedFiles?.[0].name ?? null);

  // File Operations
  const handleLoadPromptFile = async (name: string) => {
    try {
      const content = await loadPromptFile(store.get, name);

      $documentState = {
        type: "linked",
        name,
        content,
        lastSavedContent: content,
      };

      addToast(store.set, {
        message: "toast.promptLoaded",
        params: { name },
        severity: "info",
      });

      $host().dispatchEvent(
        new CustomEvent("cps-file-select", {
          detail: { name },
        }),
      );
    } catch (error) {
      console.error("Failed to load prompt:", error);
      addToast(store.set, {
        message: "toast.promptLoadFailed",
        params: { error: formatErrorMessage(error) },
        severity: "error",
      });
    }
  };

  const handleDeletePromptFile = async (name: string) => {
    try {
      await $fileStorageAPI!.delete(name);

      if ($documentState.type === "linked" && $documentState.name === name) {
        $documentState = {
          type: "unlinked",
          content: "",
        };
      }

      await refreshSavedFiles(store.get, store.set);

      addToast(store.set, {
        message: "toast.promptDeleted",
        params: { name },
        severity: "info",
      });
    } catch (error) {
      console.error("Failed to delete prompt:", error);
      addToast(store.set, {
        message: "toast.promptDeleteFailed",
        params: { error: formatErrorMessage(error) },
        severity: "error",
      });
    }
  };

  const handleFileSelect = (name: string) => {
    handleLoadPromptFile(name);
  };

  // Keyboard Navigation
  const handleButtonKeydown = (event: KeyboardEvent) => {
    if (disabled) {
      return;
    }

    const strIndex = (event.currentTarget as HTMLElement).dataset.index;
    if (!strIndex) {
      return;
    }

    if (event.shiftKey && event.key === "Tab") {
      event.preventDefault();
      containerElement?.querySelector("input")?.focus();
      return;
    }

    const index = parseInt(strIndex, 10);
    const { name } = filteredSavedFiles[index];

    if (event.key === "Delete" || event.key === "Backspace") {
      event.preventDefault();
      handleFileDelete(name, event);
      return;
    }

    const offset = {
      ArrowUp: -1,
      ArrowDown: 1,
    }[event.key];
    if (!offset) {
      return;
    }

    const nextIndex =
      (index + offset + filteredSavedFiles.length) % filteredSavedFiles.length;

    event.preventDefault();

    containerElement
      ?.querySelector<HTMLButtonElement>(
        `button[data-index="${nextIndex}"][data-item]`,
      )
      ?.focus();
  };

  // Delete Confirmation Dialog
  let deleteDialogElement = $state<HTMLDialogElement>();
  let fileToDelete = $state<string>();

  const handleFileDelete = (name: string, event: Event) => {
    event.stopPropagation();
    fileToDelete = name;
    deleteDialogElement?.showModal();
  };

  const handleDeleteConfirm = () => {
    if (fileToDelete != null) {
      handleDeletePromptFile(fileToDelete);
    }
    deleteDialogElement?.close();
  };

  const handleDeleteCancel = () => {
    deleteDialogElement?.close();
  };
</script>

<div
  bind:this={containerElement}
  class="bg-base-100 text-base-content group grid grid-rows-[auto_1fr] gap-4 overflow-hidden p-4"
>
  <!-- Search Input -->
  <input
    use:focus={{ activate: focusOnMount, restore: false }}
    type="text"
    class="input w-full"
    placeholder={$m["prompts.searchPrompts"]()}
    {disabled}
    bind:value={searchQuery}
    onkeydown={(e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        if (defaultName != null) {
          handleFileSelect(defaultName);
        }
      }
    }}
  />

  <!-- Prompt Files List -->
  <div class="overflow-y-auto">
    {#if filteredSavedFiles.length > 0}
      <div class="space-y-2">
        {#each filteredSavedFiles as file, index (file.name)}
          <div
            class="group item relative data-[disabled]:opacity-60"
            data-disabled={disabled ? "" : null}
          >
            <button
              class="bg-base-200 group-[.item:hover]:enabled:bg-base-300 outline-primary flex w-full items-center justify-between rounded-lg p-3 pr-14 text-left -outline-offset-2 transition-colors enabled:cursor-pointer group-has-[input:focus]:data-[default]:outline-2"
              type="button"
              {disabled}
              tabindex={file.name === defaultName ? 0 : -1}
              data-item
              data-index={index}
              data-default={file.name === defaultName ? "" : null}
              onclick={() => handleFileSelect(file.name)}
              onkeydown={handleButtonKeydown}
            >
              <div class="flex-1">
                <div class="text-sm font-medium">{file.name}</div>
                <div class="text-xs opacity-60">
                  {new Date(file.modified * 1000).toLocaleString()}
                </div>
              </div>
            </button>
            <button
              type="button"
              class="btn btn-ghost btn-sm btn-square text-error absolute top-0 right-3 bottom-0 m-auto opacity-0 transition-opacity group-[.item:has(:focus-visible)]:opacity-100 group-[.item:hover]:opacity-100 disabled:hidden"
              tabindex="-1"
              aria-label={$m["prompts.deleteButton"]()}
              {disabled}
              data-index={index}
              onclick={(e) => handleFileDelete(file.name, e)}
              onkeydown={handleButtonKeydown}
            >
              <span class="icon-[iconoir--trash] size-4"></span>
            </button>
          </div>
        {/each}
      </div>
    {:else}
      <div class="mt-8 text-center text-sm opacity-60">
        {searchQuery
          ? $m["prompts.noPromptsFound"]()
          : $m["prompts.noSavedPrompts"]()}
      </div>
    {/if}
  </div>

  <!-- Delete Confirmation Dialog -->
  <dialog bind:this={deleteDialogElement} class="modal">
    <div class="modal-box">
      <h3 class="mb-4 text-lg font-semibold">
        {$m["prompts.confirmDeleteTitle"]()}
      </h3>
      <p class="mb-4 text-sm">
        {$m["prompts.confirmDelete"]({ name: fileToDelete ?? "" })}
      </p>
      <div class="space-x-2 text-right">
        <button
          type="button"
          class="btn btn-ghost"
          onclick={handleDeleteCancel}
        >
          {$m["buttons.cancel"]()}
        </button>
        <button
          type="button"
          class="btn btn-error"
          onclick={handleDeleteConfirm}
        >
          {$m["buttons.delete"]()}
        </button>
      </div>
    </div>
  </dialog>
</div>
