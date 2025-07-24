<svelte:options
  customElement={{
    tag: "cps-settings-panel",
    extend: (cls) => {
      return class extends cls {
        constructor() {
          super();
          initializeComponentStylesheet(
            this,
            ":host{background:none!important}",
          );
        }
      };
    },
  }}
/>

<script module lang="ts">
  import type { HTMLAttributes } from "svelte/elements";

  export declare class CPSSettingsPanelElement extends HTMLElement {
    constructor();

    store: ReturnType<typeof createStore>;
  }

  export interface CPSSettingsPanelAttributes
    extends HTMLAttributes<CPSSettingsPanelElement> {
    store: ReturnType<typeof createStore>;
  }
</script>

<script lang="ts">
  import type { createStore } from "jotai/vanilla";
  import { locales } from "../../paraglide/runtime.js";
  import { initializeComponentStylesheet } from "../component-utils.js";
  import { jotai } from "../jotai-to-svelte-store.js";
  import {
    isDataLoadingAtom,
    loadDictionaryData,
  } from "../states/app/data-loading.js";
  import { i18nAtom, LOCALE_NAMES, localeAtom } from "../states/app/i18n.js";
  import {
    settingsAppearanceAtom,
    settingsCompilationAtom,
    settingsDataAtom,
    settingsEditorAtom,
  } from "../states/app/settings.js";

  let {
    store,
  }: {
    store: ReturnType<typeof createStore>;
  } = $props();

  const m = $derived(jotai(i18nAtom, store));
  const locale = $derived(jotai(localeAtom, store));
  const settingsAppearance = $derived(jotai(settingsAppearanceAtom, store));
  const settingsEditor = $derived(jotai(settingsEditorAtom, store));
  const settingsCompilation = $derived(jotai(settingsCompilationAtom, store));
  const settingsData = $derived(jotai(settingsDataAtom, store));
  const isDataLoading = $derived(jotai(isDataLoadingAtom, store));

  async function handleLoadDictionaryData() {
    await loadDictionaryData(store.get, store.set);
  }
</script>

<div class="space-y-6 **:[input,select]:w-60">
  <!-- Appearance Settings -->
  <div class="space-y-3">
    <h4 class="text-base font-semibold">{$m["settings.appearance"]()}</h4>
    <label class="flex items-center justify-between">
      <span class="text-base-content/80 text-sm font-medium"
        >{$m["settings.theme"]()}</span
      >
      <select
        class="select select-sm"
        bind:value={
          () => $settingsAppearance.theme,
          (v) => ($settingsAppearance = { ...$settingsAppearance, theme: v })
        }
      >
        <option value="light">{$m["settings.light"]()}</option>
        <option value="dark">{$m["settings.dark"]()}</option>
      </select>
    </label>
    <label class="flex items-center justify-between">
      <span class="text-base-content/80 text-sm font-medium">
        {$m["settings.language"]()}
      </span>
      <select
        class="select select-sm"
        bind:value={() => $locale, (v) => ($locale = v)}
      >
        {#each locales as localeOption (localeOption)}
          <option value={localeOption}>
            {LOCALE_NAMES[localeOption]}
          </option>
        {/each}
      </select>
    </label>
  </div>

  <!-- Editor Settings -->
  <div class="space-y-3">
    <h4 class="text-base font-semibold">{$m["settings.editor"]()}</h4>
    <label class="flex items-center justify-between">
      <span class="text-base-content/80 text-sm font-medium"
        >{$m["settings.fontSize"]()}</span
      >
      <input
        class="input input-sm"
        type="number"
        min="10"
        max="24"
        bind:value={
          () => $settingsEditor.fontSize,
          (v) => ($settingsEditor = { ...$settingsEditor, fontSize: v })
        }
      />
    </label>
    <label class="flex items-center justify-between">
      <span class="text-base-content/80 text-sm font-medium"
        >{$m["settings.fontFamily"]()}</span
      >
      <input
        class="input input-sm"
        type="text"
        bind:value={
          () => $settingsEditor.fontFamily,
          (v) => ($settingsEditor = { ...$settingsEditor, fontFamily: v })
        }
      />
    </label>
    <label class="flex items-center justify-between">
      <span class="text-base-content/80 text-sm font-medium"
        >{$m["settings.lineHeight"]()}</span
      >
      <input
        class="input input-sm"
        type="number"
        min="1.0"
        max="3.0"
        step="0.1"
        bind:value={
          () => $settingsEditor.lineHeight,
          (v) => ($settingsEditor = { ...$settingsEditor, lineHeight: v })
        }
      />
    </label>
    <label class="flex items-center justify-between">
      <span class="text-base-content/80 text-sm font-medium">
        {$m["settings.normalizeOnAutoComplete"]()}
      </span>
      <select
        class="select select-sm"
        bind:value={
          () => $settingsEditor.normalizeOnAutoComplete,
          (v) =>
            ($settingsEditor = {
              ...$settingsEditor,
              normalizeOnAutoComplete: v,
            })
        }
      >
        <option value="underscore">{$m["settings.underscore"]()}</option>
        <option value="whitespace">{$m["settings.whitespace"]()}</option>
      </select>
    </label>
    <label class="flex items-center justify-between">
      <span class="text-base-content/80 text-sm font-medium">
        {$m["settings.enableWorkflowExecution"]()}
      </span>
      <input
        type="checkbox"
        class="toggle toggle-sm"
        bind:checked={
          () => $settingsEditor.enableWorkflowExecution,
          (v) =>
            ($settingsEditor = {
              ...$settingsEditor,
              enableWorkflowExecution: v,
            })
        }
      />
    </label>
  </div>

  <!-- Compile Settings -->
  <div class="space-y-3">
    <h4 class="text-base font-semibold">{$m["settings.compile"]()}</h4>
    <label class="flex items-center justify-between">
      <span class="text-base-content/80 text-sm font-medium">
        {$m["settings.normalizeMethod"]()}
      </span>
      <select
        class="select select-sm"
        bind:value={
          () => $settingsCompilation.normalize,
          (v) =>
            ($settingsCompilation = {
              ...$settingsCompilation,
              normalize: v,
            })
        }
      >
        <option value="none">{$m["settings.none"]()}</option>
        <option value="underscore">{$m["settings.underscore"]()}</option>
        <option value="whitespace">{$m["settings.whitespace"]()}</option>
      </select>
    </label>
    <label class="flex items-center justify-between">
      <span class="text-base-content/80 text-sm font-medium">
        {$m["settings.duplicateTagHandling"]()}
      </span>
      <select
        class="select select-sm"
        bind:value={
          () => $settingsCompilation.duplicateTagHandling,
          (v) =>
            ($settingsCompilation = {
              ...$settingsCompilation,
              duplicateTagHandling: v,
            })
        }
      >
        <option value="ignore">{$m["settings.ignore"]()}</option>
        <option value="overwrite">{$m["settings.overwrite"]()}</option>
        <option value="add">{$m["settings.add"]()}</option>
        <option value="multiply">{$m["settings.multiply"]()}</option>
      </select>
    </label>
    <label class="flex items-center justify-between">
      <span class="text-base-content/80 text-sm font-medium">
        {$m["settings.charactersToBeEscaped"]()}
      </span>
      <select
        class="select select-sm"
        bind:value={
          () => $settingsCompilation.escapeTarget,
          (v) =>
            ($settingsCompilation = {
              ...$settingsCompilation,
              escapeTarget: v,
            })
        }
      >
        <option value="none">{$m["settings.none"]()}</option>
        <option value="parentheses">{$m["settings.parentheses"]()}</option>
      </select>
    </label>
  </div>

  <!-- Data Settings -->
  <div class="space-y-3">
    <h4 class="text-base font-semibold">{$m["settings.data"]()}</h4>
    <label class="block space-y-2">
      <span class="text-base-content/80 block text-sm font-medium">
        {$m["settings.dictionarySources"]()}
      </span>
      <div class="relative">
        <textarea
          class="textarea textarea-sm min-h-40 w-full pr-12 font-mono text-xs"
          placeholder={$m["settings.dictionarySourcesPlaceholder"]()}
          bind:value={
            () => $settingsData.dictionarySources,
            (v) => ($settingsData = { ...$settingsData, dictionarySources: v })
          }
        ></textarea>
        <div class="absolute top-1 right-5">
          <div
            class="tooltip tooltip-left"
            data-tip={$m["settings.loadDictionaryTooltip"]()}
          >
            <button
              type="button"
              class="btn btn-ghost btn-sm h-8 min-h-8 w-8 p-0"
              disabled={$isDataLoading}
              onclick={handleLoadDictionaryData}
              aria-label={$m["settings.loadDictionaryButtonLabel"]()}
            >
              <span
                class="icon-[iconoir--refresh-double] size-4 data-[loading]:animate-spin"
                data-loading={$isDataLoading ? "true" : undefined}
              ></span>
            </button>
          </div>
        </div>
      </div>
      <span class="text-base-content/60 block text-xs">
        {$m["settings.dictionarySourcesHelp"]()}
      </span>
    </label>
  </div>
</div>
