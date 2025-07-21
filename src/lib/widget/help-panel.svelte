<svelte:options
  customElement={{
    tag: "cps-help-panel",
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

  export declare class CPSHelpPanelElement extends HTMLElement {
    constructor();

    store: ReturnType<typeof createStore>;
  }

  export interface CPSHelpPanelAttributes
    extends HTMLAttributes<CPSHelpPanelElement> {
    store: ReturnType<typeof createStore>;
  }
</script>

<script lang="ts">
  import type { createStore } from "jotai/vanilla";
  import { initializeComponentStylesheet } from "../component-utils.js";
  import { jotai } from "../jotai-to-svelte-store.js";
  import { i18nAtom } from "../states/app/i18n.js";

  let {
    store,
  }: {
    store: ReturnType<typeof createStore>;
  } = $props();

  const m = $derived(jotai(i18nAtom, store));

  /* eslint-disable svelte/no-useless-mustaches */
</script>

<div class="space-y-8">
  <!-- Quick Start -->
  <div class="space-y-4">
    <h4 class="text-lg font-semibold">{$m["help.quickStart"]()}</h4>
    <div class="text-sm">
      <p class="mb-4">
        {$m["help.quickStartDescription"]()}
      </p>
      <ul class="ml-2 list-inside list-disc space-y-2">
        <li>{$m["help.features.autoCompletion"]()}</li>
        <li>{$m["help.features.customChants"]()}</li>
        <li>{$m["help.features.loraSupport"]()}</li>
        <li>{$m["help.features.realTimePreview"]()}</li>
      </ul>
    </div>
  </div>

  <!-- Tag Types -->
  <div class="space-y-4">
    <h4 class="text-lg font-semibold">{$m["help.tagTypes"]()}</h4>
    <div class="space-y-6">
      <div>
        <h5 class="mb-4 font-medium">{$m["help.normalTags"]()}</h5>
        <div class="space-y-4 text-sm">
          <p>{$m["help.normalTagsDescription"]()}</p>
          <pre class="bg-base-300 rounded p-2 font-mono text-xs"><code
              >{`1girl, solo, long_hair, looking_at_viewer\n(dark:0.8), ((smile)), [[sky]]`}</code
            ></pre>
        </div>
      </div>

      <div>
        <h5 class="mb-4 font-medium">{$m["help.customChants"]()}</h5>
        <div class="space-y-4 text-sm">
          <p>{$m["help.customChantsDescription"]()}</p>
          <pre class="bg-base-300 rounded p-2 font-mono text-xs"><code
              >{`@quality, @character:girl, @pose:standing`}</code
            ></pre>
        </div>
      </div>

      <div>
        <h5 class="mb-4 font-medium">{$m["help.lora"]()}</h5>
        <div class="space-y-4 text-sm">
          <p>{$m["help.loraDescription"]()}</p>
          <pre class="bg-base-300 rounded p-2 font-mono text-xs"><code
              >{`<lora:example.safetensors:0.9>`}</code
            ></pre>
        </div>
      </div>

      <div>
        <h5 class="mb-4 font-medium">{$m["help.embeddings"]()}</h5>
        <div class="space-y-4 text-sm">
          <p>{$m["help.embeddingsDescription"]()}</p>
          <pre class="bg-base-300 rounded p-2 font-mono text-xs"><code
              >{`<embedding:example>\n<embedding:example:0.9>`}</code
            ></pre>
        </div>
      </div>
    </div>
  </div>

  <!-- Comments -->
  <div class="space-y-4">
    <h4 class="text-lg font-semibold">{$m["help.comments"]()}</h4>
    <div class="space-y-4 text-sm">
      <p>{$m["help.commentsDescription"]()}</p>
      <pre class="bg-base-300 rounded p-2 font-mono text-xs"><code
          >{`1girl, solo // Single line comment
/*
  Multi-line comment
  for longer explanations
*/`}</code
        ></pre>
    </div>
  </div>

  <!-- Chants Definition -->
  <div class="space-y-4">
    <h4 class="text-lg font-semibold">{$m["help.chantsDefinition"]()}</h4>
    <div class="space-y-4 text-sm">
      <p>{$m["help.chantsDefinitionDescription"]()}</p>
      <pre class="bg-base-300 rounded p-2 font-mono text-xs"><code
          >{`@@quality
/// High quality tags for better results
masterpiece, best quality, high quality

@@character:girl
1girl, solo
// Basic girl character setup

@@pose:standing
standing, looking at viewer, smile`}</code
        ></pre>
      <p class="text-base-content/70 text-xs">
        {$m["help.chantsNote"]()}
      </p>
    </div>
  </div>

  <!-- Weight Syntax -->
  <div class="space-y-4">
    <h4 class="text-lg font-semibold">{$m["help.weightSyntax"]()}</h4>
    <div class="space-y-4 text-sm">
      <p>{$m["help.weightSyntaxDescription"]()}</p>
      <pre class="bg-base-300 rounded p-2 font-mono text-xs"><code
          >{`(emphasis:1.1) // Increase weight
((strong emphasis)) // Multiple levels
[reduce:0.9] // Decrease weight
[[very reduced]] // Multiple levels`}</code
        ></pre>
    </div>
  </div>

  <!-- Tag Deletion -->
  <div class="space-y-4">
    <h4 class="text-lg font-semibold">{$m["help.tagDeletion"]()}</h4>
    <div class="space-y-4 text-sm">
      <p>{$m["help.tagDeletionDescription"]()}</p>
      <pre class="bg-base-300 rounded p-2 font-mono text-xs"><code
          >{`-1girl, -<lora:example>`}</code
        ></pre>
      <p class="text-base-content/70 text-xs">
        {$m["help.tagDeletionNote"]()}
      </p>
    </div>
  </div>

  <!-- Keyboard Shortcuts -->
  <div class="space-y-4">
    <h4 class="text-lg font-semibold">{$m["help.keyboardShortcuts"]()}</h4>
    <dl
      class="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm *:[dd]:space-x-1.5"
    >
      <dt>{$m["help.shortcuts.close"]()}</dt>
      <dd>
        <kbd class="kbd kbd-sm">Ctrl+Enter</kbd>
        <kbd class="kbd kbd-sm">Esc</kbd>
      </dd>
      <dt>{$m["help.shortcuts.autoComplete"]()}</dt>
      <dd><kbd class="kbd kbd-sm">Ctrl+Space</kbd></dd>
      <dt>{$m["help.shortcuts.increaseWeight"]()}</dt>
      <dd><kbd class="kbd kbd-sm">Ctrl+↑</kbd></dd>
      <dt>{$m["help.shortcuts.decreaseWeight"]()}</dt>
      <dd><kbd class="kbd kbd-sm">Ctrl+↓</kbd></dd>
    </dl>
  </div>

  <!-- Dictionary Sources -->
  <div class="space-y-4">
    <h4 class="text-lg font-semibold">{$m["help.dictionarySources"]()}</h4>
    <div class="space-y-4 text-sm">
      <p>{$m["help.dictionarySourcesDescription"]()}</p>
      <p>{$m["help.dictionarySourcesDetails"]()}</p>
      <pre class="bg-base-300 rounded p-2 font-mono text-xs"><code
          >{$m["help.dictionarySourcesExample"]()}</code
        ></pre>
    </div>
  </div>

  <!-- Compilation -->
  <div class="space-y-4">
    <h4 class="text-lg font-semibold">{$m["help.compilationProcess"]()}</h4>
    <div class="space-y-4 text-sm">
      <p>{$m["help.compilationDescription"]()}</p>
      <ol class="ml-2 list-inside list-decimal space-y-2">
        <li>{$m["help.compilationSteps.removeComments"]()}</li>
        <li>{$m["help.compilationSteps.resolveChants"]()}</li>
        <li>{$m["help.compilationSteps.processDuplicates"]()}</li>
        <li>{$m["help.compilationSteps.embedOriginal"]()}</li>
      </ol>
      <p class="text-base-content/70 text-xs">
        {$m["help.compilationNote"]()}
      </p>
    </div>
  </div>
</div>
