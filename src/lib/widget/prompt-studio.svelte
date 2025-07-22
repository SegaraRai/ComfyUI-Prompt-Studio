<svelte:options
  customElement={{
    tag: "cps-prompt-studio",
    extend: (cls) => {
      return class extends cls {
        constructor() {
          super();

          initializeComponentStylesheet(this);
        }

        get #internal() {
          return this as unknown as WithInternal;
        }

        get compiledPrompt(): CompiledPrompt | null {
          return this.#internal.__internalCompiledPrompt ?? null;
        }

        override focus(options?: FocusOptions): void {
          this.shadowRoot
            ?.querySelector<HTMLElement>("cps-prompt-editor[mode=prompt]")
            ?.focus(options);
        }
      };
    },
  }}
/>

<script module lang="ts">
  import type { EventHandler, HTMLAttributes } from "svelte/elements";

  export declare class CPSPromptStudioElement extends HTMLElement {
    store: ReturnType<typeof createStore>;
    focusOnMount: boolean;
    resourceDefinition: ResourceDefinition;
    value: string;

    readonly compiledPrompt: CompiledPrompt | null;
  }

  export interface CPSPromptStudioAttributes
    extends HTMLAttributes<CPSPromptStudioElement> {
    store: ReturnType<typeof createStore>;
    focusOnMount?: boolean | null | undefined;
    resourceDefinition?: ResourceDefinition | null | undefined;
    value?: string | null | undefined;

    "oncps-input"?:
      | EventHandler<Event, CPSPromptStudioElement>
      | null
      | undefined;
    "oncps-close"?:
      | EventHandler<Event, CPSPromptStudioElement>
      | null
      | undefined;
  }
</script>

<script lang="ts">
  import { createStore } from "jotai/vanilla";
  import { cssVars } from "../actions/css-vars.js";
  import { focusTrap } from "../actions/focus-trap.js";
  import { focus } from "../actions/focus.js";
  import { initializeComponentStylesheet } from "../component-utils.js";
  import {
    createEmptyResourceDefinition,
    type ResourceDefinition,
  } from "../core/resources.js";
  import { debounce } from "../debounce.js";
  import type { CPSPromptEditorElement } from "../editor/prompt-editor.svelte";
  import { jotai } from "../jotai-to-svelte-store.js";
  import {
    chantDefinitionsAtom,
    chantsTextAtom,
  } from "../states/app/chants.js";
  import { dictionaryEngineAtom } from "../states/app/dictionary.js";
  import {
    isValidFilename,
    refreshSavedFiles,
    savedFilesAtom,
    savePromptFile,
  } from "../states/app/file-storage.js";
  import { i18nAtom } from "../states/app/i18n.js";
  import {
    settingsAppearanceAtom,
    settingsCompilationAtom,
    settingsEditorAtom,
  } from "../states/app/settings.js";
  import { addToast, formatErrorMessage } from "../states/app/toast.js";
  import { appStoreAtom } from "../states/widget/app-store.js";
  import {
    cleanCompiledPromptAtom,
    compileContextAtom,
    compiledPromptAtom,
    type CompiledPrompt,
  } from "../states/widget/compilation.js";
  import {
    documentContentAtom,
    documentIsDirtyAtom,
    documentStateAtom,
  } from "../states/widget/document.js";
  import {
    isRestoringAtom,
    restorationStateAtom,
    restoredPromptAtom,
    valueAtom,
  } from "../states/widget/restoration.js";
  import type { CPSPromptListElement } from "./prompt-file-list.svelte";

  import "../editor/prompt-editor.svelte";
  import "./help-panel.svelte";
  import "./prompt-file-list.svelte";
  import "./settings-panel.svelte";

  const AUTO_SAVE_DELAY = 300; // 300 milliseconds for auto-save debounce

  interface WithInternal {
    __internalCompiledPrompt?: CompiledPrompt;
  }

  let {
    store,
    focusOnMount = false,
    resourceDefinition = createEmptyResourceDefinition(),
    value = "",
  }: {
    store: ReturnType<typeof createStore>;
    focusOnMount?: boolean;
    resourceDefinition?: ResourceDefinition;
    value?: string;
  } = $props();

  // Widget-level store setup
  const widgetStore = createStore();
  widgetStore.set(appStoreAtom, store);

  // Settings and i18n
  const m = $derived(jotai(i18nAtom, store));
  const settingsAppearance = $derived(jotai(settingsAppearanceAtom, store));
  const settingsCompilation = $derived(jotai(settingsCompilationAtom, store));
  const settingsEditor = $derived(jotai(settingsEditorAtom, store));

  let theme = $derived($settingsAppearance.theme);

  // Dictionary Engine
  const dictionaryEngine = $derived(jotai(dictionaryEngineAtom, store));

  // Chants
  const chantsText = $derived(jotai(chantsTextAtom, store));
  const chantDefinitions = $derived(jotai(chantDefinitionsAtom, store));

  const handleChantsInput = (event: Event) => {
    $chantsText = (event.target as CPSPromptEditorElement).value;
  };

  // Prompt Restoration
  const valueState = $derived(jotai(valueAtom, widgetStore));
  const restorationState = $derived(jotai(restorationStateAtom, widgetStore));
  const isRestoring = $derived(jotai(isRestoringAtom, widgetStore));
  const restoredPrompt = $derived(jotai(restoredPromptAtom, widgetStore));

  // - Sync external value with internal state
  $effect(() => {
    if ($valueState !== value) {
      $valueState = value;
    }
  });

  // - Update prompt text when restoration completes
  $effect(() => {
    if (
      $restorationState.state === "idle" ||
      $restorationState.state === "error"
    ) {
      $promptText = $restoredPrompt;
    }
  });

  // Prompt Compilation
  const promptText = $derived(jotai(documentContentAtom, widgetStore));
  const compileContext = $derived(jotai(compileContextAtom, widgetStore));
  const compiledPrompt = $derived(jotai(compiledPromptAtom, widgetStore));
  const cleanCompiledPrompt = $derived(
    jotai(cleanCompiledPromptAtom, widgetStore),
  );

  // - Update compile context with latest definitions, resources, and options
  $effect(() => {
    const newContext = {
      chantDefinitions: $chantDefinitions,
      resourceDefinition,
      options: $settingsCompilation,
    };

    if (JSON.stringify($compileContext) === JSON.stringify(newContext)) {
      return;
    }

    $compileContext = {
      chantDefinitions: $chantDefinitions,
      resourceDefinition,
      options: $settingsCompilation,
    };
  });

  // - Expose compiled prompt through internal API
  // - Dispatch input events when compiled prompt changes
  $effect(() => {
    ($host() as unknown as WithInternal).__internalCompiledPrompt =
      $compiledPrompt;

    $host().dispatchEvent(new Event("cps-input"));
  });

  const handlePromptInput = (event: Event) => {
    if ($isRestoring) {
      return;
    }

    const newValue = (event.target as CPSPromptEditorElement).value;
    $promptText = newValue;
  };

  // Document (Prompt) State
  const documentState = $derived(jotai(documentStateAtom, widgetStore));
  const documentIsDirty = $derived(jotai(documentIsDirtyAtom, widgetStore));

  // File Operations
  const handleSavePromptFile = async (
    name: string,
    content: string,
    autoSave: boolean,
  ): Promise<boolean> => {
    try {
      await savePromptFile(store.get, name, content, autoSave);

      $documentState = {
        type: "linked",
        name,
        content,
        lastSavedContent: content,
      };

      if (!autoSave) {
        addToast(store.set, {
          severity: "info",
          message: "toast.promptSaved",
          params: { name },
        });
      }

      await refreshSavedFiles(store.get, store.set);
      return true;
    } catch (error) {
      console.error("Failed to save prompt:", error);
      addToast(store.set, {
        severity: "error",
        message: "toast.promptSaveFailed",
        params: { error: formatErrorMessage(error) },
      });
      return false;
    }
  };

  const handleNewPrompt = async () => {
    if ($documentState.type === "unlinked") {
      return;
    }

    const succeeded = await handleSavePromptFile(
      $documentState.name,
      $promptText,
      true,
    );
    if (succeeded) {
      $documentState = {
        type: "unlinked",
        content: "",
      };
    }
  };

  const handleSave = (saveAs: boolean) => {
    if ($documentState.type === "linked" && !saveAs) {
      return;
    }

    if ($promptText.trim() === "") {
      return;
    }

    refreshSavedFiles(store.get, store.set);

    filenameInput = "";
    showFilenameDialog = true;
  };

  // - Auto-save
  const debouncedAutoSave = debounce(() => {
    if ($documentIsDirty && $documentState.type === "linked") {
      handleSavePromptFile($documentState.name, $promptText, true);
    }
  }, AUTO_SAVE_DELAY);

  $effect(() => {
    if ($documentIsDirty && $documentState.type === "linked") {
      debouncedAutoSave();
    }
  });

  // Filename Dialog
  const savedFiles = $derived(jotai(savedFilesAtom, store));
  let showFilenameDialog = $state(false);
  let filenameInput = $state("");

  const filenameError = $derived.by(() => {
    const trimmedFilename = filenameInput.trim();
    if (!trimmedFilename) {
      return null;
    }
    if (!isValidFilename(trimmedFilename)) {
      return $m["prompts.invalidFilename"]();
    }
    if ($savedFiles.some((file) => file.name === trimmedFilename)) {
      return $m["prompts.filenameAlreadyExists"]();
    }
    return null;
  });
  const canConfirmFilename = $derived(
    filenameInput.trim() !== "" && filenameError == null,
  );

  const handleFilenameConfirm = async () => {
    if (!canConfirmFilename) {
      return;
    }
    const trimmedFilename = filenameInput.trim();
    const succeeded = await handleSavePromptFile(
      trimmedFilename,
      $documentState.content,
      false,
    );
    if (succeeded) {
      showFilenameDialog = false;
      filenameInput = "";
    }
  };

  const handleFilenameCancel = () => {
    showFilenameDialog = false;
    filenameInput = "";
  };

  // Prompt List
  let showPromptList = $state(false);
  let promptListElement = $state<CPSPromptListElement>();

  const canLoadPrompt = $derived(
    !$isRestoring &&
      !$documentIsDirty &&
      ($documentState.type === "linked" || $promptText.trim() === ""),
  );
  const needsSave = $derived(
    $documentState.type === "unlinked" && $promptText.trim() !== "",
  );

  const handleOpen = (open: boolean) => {
    if (open) {
      if (showPromptList) {
        promptListElement?.focus();
      } else {
        showPromptList = true;
        refreshSavedFiles(store.get, store.set);
      }
    } else {
      showPromptList = false;
      promptEditorElement?.focus();
    }
  };

  // UI Panels
  let showSettings = $state(false);
  let showPreview = $state(true);
  let showHelp = $state(false);

  // Focus Trap States
  let autoCompletingPromptEditor = $state(false);
  let autoCompletingChantsEditor = $state(false);

  // Editor Integration
  let autoCompleteContainerElement = $state<HTMLElement>();
  let promptEditorElement = $state<CPSPromptEditorElement>();

  const focusToPromptEditor = () => {
    promptEditorElement?.focus();
  };

  const handlePromptEditorEvent = (event: Event) => {
    switch (event.type) {
      case "cps-editor-save":
        handleSave(false);
        break;
      case "cps-editor-save-as":
        handleSave(true);
        break;
      case "cps-editor-new":
        handleNewPrompt();
        break;
      case "cps-editor-open":
        handleOpen(true);
        break;
      case "cps-editor-input":
        handlePromptInput(event);
        break;
      case "cps-editor-submit":
        handleClose();
        break;
    }
  };

  // Application Control
  const handleClose = () => {
    $host().dispatchEvent(new Event("cps-close"));
  };
</script>

<div
  use:focusTrap={{
    options: {
      checkCanFocusTrap: async () => {
        const until = Date.now() + 1000;
        while (!promptEditorElement?.ready && Date.now() < until) {
          await new Promise((resolve) => setTimeout(resolve, 50));
        }
      },
      tabbableOptions: {
        getShadowRoot: true,
      },
      initialFocus: false,
    },
    paused: autoCompletingPromptEditor || autoCompletingChantsEditor,
  }}
  class="modal modal-open cps-editor-theme [--hint-font-size:calc(var(--editor-font-size)*0.8)]"
  role="dialog"
  data-theme={theme}
  use:cssVars={{
    "--editor-font-size": `${$settingsEditor.fontSize}px`,
    "--editor-font-family": $settingsEditor.fontFamily,
    "--editor-line-height": $settingsEditor.lineHeight,
  }}
>
  <div
    class="modal-box bg-base-200 text-base-content relative mt-4 grid h-[calc(100vh-var(--spacing)*8)] w-320 max-w-[calc(100vw-var(--spacing)*10)] overflow-visible"
  >
    <div class="grid grid-rows-[max-content_1fr] overflow-hidden">
      <!-- Header Section -->
      <div class="flex items-center justify-between pb-6 not-md:justify-end">
        <h2 class="flex-none text-xl font-semibold not-md:hidden">
          {$m["app.title"]()}
        </h2>
        <div class="absolute right-6 space-x-4">
          <span class="space-x-2">
            <button
              class="btn btn-sm btn-soft"
              class:btn-active={showPromptList}
              type="button"
              aria-pressed={showPromptList}
              onclick={() => {
                handleOpen(!showPromptList);
              }}
            >
              {$m["buttons.promptList"]()}
            </button>
            <button
              class="btn btn-sm btn-soft"
              class:btn-active={showPreview}
              type="button"
              aria-pressed={showPreview}
              onclick={() => {
                showPreview = !showPreview;
                if (showPreview) {
                  showHelp = false;
                }
              }}
            >
              {$m["buttons.preview"]()}
            </button>
            <button
              class="btn btn-sm btn-soft"
              class:btn-active={showSettings}
              type="button"
              aria-pressed={showSettings}
              onclick={() => {
                showSettings = !showSettings;
                if (showSettings) {
                  showHelp = false;
                }
              }}
            >
              {$m["buttons.settings"]()}
            </button>
            <button
              class="btn btn-sm btn-soft"
              class:btn-active={showHelp}
              type="button"
              aria-pressed={showHelp}
              onclick={() => {
                showHelp = !showHelp;
                if (showHelp) {
                  showSettings = false;
                  showPreview = false;
                }
              }}
            >
              {$m["buttons.help"]()}
            </button>
          </span>
          <button
            class="btn btn-primary btn-sm min-w-20 flex-none"
            type="button"
            onclick={handleClose}
          >
            {$m["buttons.ok"]()}
          </button>
        </div>
      </div>
      <!-- Main Content Area -->
      <div
        class="grid grid-rows-[minmax(--spacing(80),1fr)_auto] overflow-auto"
      >
        <!-- Top Panel Row -->
        <div class="grid grid-cols-2">
          <!-- Left Panel - Prompt Editor -->
          <div
            class="border-base-content/20 grid grid-rows-[max-content_1fr] overflow-hidden border-r"
          >
            <div
              class="bg-primary/10 grid grid-cols-[max-content_1fr] gap-2 px-4 py-3"
            >
              <h3 class="text-sm font-medium tracking-wide uppercase">
                {$m["editor.promptEditor"]()}
              </h3>
              <div
                class="text-sm opacity-70 empty:before:italic empty:before:content-[attr(data-untitled-text)] data-[dirty]:after:content-['_*']"
                data-dirty={$documentIsDirty ? "" : null}
                data-untitled-text={$m["prompts.untitled"]()}
              >
                {$documentState.type === "linked" ? $documentState.name : null}
              </div>
            </div>
            <cps-prompt-editor
              bind:this={promptEditorElement}
              class="overflow-hidden"
              data-theme={theme}
              placeholder={$m["editor.promptPlaceholder"]()}
              mode="prompt"
              value={$promptText}
              disabled={$isRestoring}
              {focusOnMount}
              i18n={$m}
              dictionaryEngine={$dictionaryEngine}
              chantDefinitions={$chantDefinitions}
              {resourceDefinition}
              normalizeOnAutoComplete={$settingsEditor.normalizeOnAutoComplete}
              tooltipParent={autoCompleteContainerElement}
              oncps-editor-input={handlePromptEditorEvent}
              oncps-editor-submit={handlePromptEditorEvent}
              oncps-editor-save={handlePromptEditorEvent}
              oncps-editor-save-as={handlePromptEditorEvent}
              oncps-editor-new={handlePromptEditorEvent}
              oncps-editor-open={handlePromptEditorEvent}
              oncps-editor-autocompletion={(event) => {
                autoCompletingPromptEditor = event.detail.active;
              }}
            ></cps-prompt-editor>
          </div>

          <!-- Right Panel - Chants Editor or Prompt List -->
          {#if !showPromptList}
            <!-- Chants Editor Panel -->
            <div class="grid grid-rows-[auto_1fr] overflow-hidden">
              <div class="bg-accent/10 px-4 py-3">
                <h3 class="text-sm font-medium tracking-wide uppercase">
                  {$m["editor.chantsEditor"]()}
                </h3>
              </div>
              <cps-prompt-editor
                class="overflow-hidden"
                data-theme={theme}
                placeholder={$m["editor.chantsPlaceholder"]()}
                mode="chants"
                value={$chantsText}
                i18n={$m}
                dictionaryEngine={$dictionaryEngine}
                chantDefinitions={$chantDefinitions}
                {resourceDefinition}
                normalizeOnAutoComplete={$settingsEditor.normalizeOnAutoComplete}
                tooltipParent={autoCompleteContainerElement}
                oncps-editor-input={handleChantsInput}
                oncps-editor-submit={focusToPromptEditor}
                oncps-editor-autocompletion={(event) => {
                  autoCompletingChantsEditor = event.detail.active;
                }}
              ></cps-prompt-editor>
            </div>
          {:else}
            <!-- Prompt List Panel -->
            <div class="grid grid-rows-[max-content_1fr] overflow-hidden">
              <div class="bg-accent/10 px-4 py-3">
                <h3 class="text-sm font-medium tracking-wide uppercase">
                  {$m["panels.promptList"]()}
                </h3>
              </div>
              <div class="relative grid grid-cols-1 overflow-hidden">
                <cps-prompt-file-list
                  bind:this={promptListElement}
                  class="overflow-hidden"
                  data-theme={theme}
                  {store}
                  {widgetStore}
                  disabled={!canLoadPrompt}
                  focusOnMount
                  oncps-file-select={() => {
                    showPromptList = false;
                  }}
                ></cps-prompt-file-list>
                <div
                  class="absolute inset-0 grid size-full px-4 py-10 text-center text-lg backdrop-blur-sm"
                  hidden={!needsSave}
                >
                  {$m["panels.promptListNeedsSave"]()}
                </div>
              </div>
            </div>
          {/if}
        </div>

        <!-- Bottom Panel Row -->
        {#if showHelp}
          <!-- Help Panel (Full Width) -->
          <div
            class="border-base-content/20 bg-base-100 grid max-h-80 grid-rows-[max-content_1fr] border-t"
          >
            <div class="bg-info/10 px-4 py-3">
              <h3 class="text-sm font-medium tracking-wide uppercase">
                {$m["panels.help"]()}
              </h3>
            </div>
            <div class="overflow-y-auto p-4">
              <cps-help-panel data-theme={theme} {store}></cps-help-panel>
            </div>
          </div>
        {:else}
          <!-- Preview and Settings Panels -->
          <div
            class="group grid grid-cols-1 data-[cols=2]:grid-cols-[1fr_minmax(calc(var(--spacing)*130),1fr)]"
            data-cols={Number(showSettings) + Number(showPreview)}
          >
            {#if showPreview}
              <!-- Preview Panel -->
              <div
                class="border-base-content/20 bg-base-100 grid min-h-[min-content] grid-rows-[max-content_1fr] border-t group-data-[cols=2]:border-r"
              >
                <div class="bg-success/10 px-4 py-3">
                  <h3 class="text-sm font-medium tracking-wide uppercase">
                    {$m["panels.preview"]()}
                  </h3>
                </div>
                <div class="grid overflow-hidden p-4">
                  <pre
                    class="bg-base-200 overflow-auto p-3 font-mono text-sm"><code
                      class="whitespace-pre-wrap before:italic before:opacity-60 before:content-[attr(data-placeholder)] not-empty:before:hidden"
                      data-placeholder={$m["panels.noCompiledPrompt"]()}
                      >{$cleanCompiledPrompt ?? ""}</code
                    ></pre>
                </div>
              </div>
            {/if}
            {#if showSettings}
              <!-- Settings Panel -->
              <div
                class="border-base-content/20 bg-base-100 grid max-h-80 grid-rows-[max-content_1fr] border-t"
              >
                <div class="bg-warning/10 px-4 py-3">
                  <h3 class="text-sm font-medium tracking-wide uppercase">
                    {$m["panels.settings"]()}
                  </h3>
                </div>
                <div class="overflow-y-auto p-4">
                  <cps-settings-panel data-theme={theme} {store}
                  ></cps-settings-panel>
                </div>
              </div>
            {/if}
          </div>
        {/if}
      </div>
    </div>
  </div>

  <!-- Editor Autocomplete Tooltip Container (to avoid scrolling) -->
  <div bind:this={autoCompleteContainerElement}></div>

  <!-- Modal Dialogs -->
  {#if showFilenameDialog}
    <!-- Filename Input Dialog -->
    <div
      use:focusTrap
      class="absolute inset-0 z-50 flex items-center justify-center bg-black/50"
    >
      <div class="bg-base-100 mx-4 w-full max-w-md rounded-lg p-6 shadow-lg">
        <h3 class="mb-4 text-lg font-semibold">
          {$m["prompts.enterFilename"]()}
        </h3>
        <input
          use:focus
          type="text"
          class="input input-bordered mb-4 w-full"
          bind:value={filenameInput}
          placeholder="Filename"
          onkeydown={(e) => {
            e.stopPropagation();

            if (e.key === "Enter") {
              e.preventDefault();
              if (canConfirmFilename) {
                handleFilenameConfirm();
              }
            } else if (e.key === "Escape") {
              e.preventDefault();
              handleFilenameCancel();
            }
          }}
        />
        <p class="text-error min-h-10 text-sm">{filenameError}</p>
        <div class="flex justify-end gap-2">
          <button
            type="button"
            class="btn btn-ghost"
            onclick={handleFilenameCancel}
          >
            {$m["buttons.cancel"]()}
          </button>
          <button
            type="button"
            class="btn btn-primary"
            disabled={!canConfirmFilename}
            onclick={handleFilenameConfirm}
          >
            {$m["buttons.save"]()}
          </button>
        </div>
      </div>
    </div>
  {/if}
</div>
