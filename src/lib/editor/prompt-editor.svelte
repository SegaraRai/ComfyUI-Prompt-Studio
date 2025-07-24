<svelte:options
  customElement={{
    tag: "cps-prompt-editor",
    extend: (cls) => {
      return class extends cls {
        constructor() {
          super();

          this.addEventListener("keydown", (event) => {
            event.stopPropagation();
            if (event.key === "Escape") {
              event.preventDefault();
            }
          });

          initializeComponentStylesheet(
            this,
            ":host{display:block;width:100%;height:100%;position:relative;background:none!important}",
          );
        }

        get ready(): boolean {
          return !!this.shadowRoot?.querySelector(".cm-content");
        }

        override focus(options?: FocusOptions): void {
          this.shadowRoot
            ?.querySelector<HTMLDivElement>(".cm-content")
            ?.focus(options);
        }
      };
    },
    props: {
      mode: { reflect: true },
      disabled: { reflect: true },
    },
  }}
/>

<script module lang="ts">
  import type { EventHandler, HTMLAttributes } from "svelte/elements";

  export declare class CPSPromptEditorElement extends HTMLElement {
    constructor();

    mode: "prompt" | "chants";
    focusOnMount: boolean;
    disabled: boolean;
    placeholder: string;
    value: string;
    readonly ready: boolean;

    i18n: typeof import("../../paraglide/messages.js").m;
    dictionaryEngine: IDictionaryEngine | null | undefined;
    chantDefinitions: readonly ChantDefinition[];
    resourceDefinition: ResourceDefinition;
    normalizeOnAutoComplete: NormalizeOnAutoComplete;
    tooltipParent: HTMLElement | null;

    override focus(options?: FocusOptions): void;
  }

  export interface CPSPromptEditorAttributes
    extends HTMLAttributes<CPSPromptEditorElement> {
    mode?: "prompt" | "chants" | null | undefined;
    focusOnMount?: boolean | null | undefined;
    disabled?: boolean | null | undefined;
    placeholder?: string | null | undefined;
    value?: string | null | undefined;

    i18n: typeof import("../../paraglide/messages.js").m;
    dictionaryEngine: IDictionaryEngine | null | undefined;
    chantDefinitions: readonly ChantDefinition[];
    resourceDefinition: ResourceDefinition;
    normalizeOnAutoComplete: NormalizeOnAutoComplete;
    tooltipParent?: HTMLElement | null | undefined;

    "oncps-editor-input"?:
      | EventHandler<Event, CPSPromptEditorElement>
      | null
      | undefined;
    "oncps-editor-submit"?:
      | EventHandler<Event, CPSPromptEditorElement>
      | null
      | undefined;
    "oncps-editor-close"?:
      | EventHandler<Event, CPSPromptEditorElement>
      | null
      | undefined;
    "oncps-editor-save"?:
      | EventHandler<Event, CPSPromptEditorElement>
      | null
      | undefined;
    "oncps-editor-save-as"?:
      | EventHandler<Event, CPSPromptEditorElement>
      | null
      | undefined;
    "oncps-editor-new"?:
      | EventHandler<Event, CPSPromptEditorElement>
      | null
      | undefined;
    "oncps-editor-open"?:
      | EventHandler<Event, CPSPromptEditorElement>
      | null
      | undefined;
    "oncps-editor-autocompletion"?:
      | EventHandler<CustomEvent<{ active: boolean }>, CPSPromptEditorElement>
      | null
      | undefined;
  }
</script>

<script lang="ts">
  import {
    acceptCompletion,
    closeCompletion,
    completionKeymap,
    completionStatus,
  } from "@codemirror/autocomplete";
  import {
    defaultKeymap,
    history,
    redo,
    historyKeymap,
  } from "@codemirror/commands";
  import { EditorState, StateEffect, type Extension } from "@codemirror/state";
  import {
    drawSelection,
    EditorView,
    keymap,
    placeholder,
    tooltips,
  } from "@codemirror/view";
  import { onMount } from "svelte";
  import { initializeComponentStylesheet } from "../component-utils.js";
  import type { ChantDefinition } from "../core/chants.js";
  import type { ResourceDefinition } from "../core/resources.js";
  import type { IDictionaryEngine } from "../wasm/dictionary-engine/interface.js";
  import {
    commentPlugin,
    contextUpdateEffect,
    createAutocompletion,
    modifyNumber,
    tagDecorationPlugin,
    type NormalizeOnAutoComplete,
    type PluginContext,
  } from "./codemirror-extensions/index.js";

  let {
    i18n,
    dictionaryEngine,
    chantDefinitions,
    resourceDefinition,
    normalizeOnAutoComplete,
    tooltipParent = null,
    value = "",
    placeholder: placeholderText = "",
    disabled = false,
    focusOnMount = false,
    mode = "prompt",
  }: {
    i18n: typeof import("../../paraglide/messages.js").m;
    dictionaryEngine: IDictionaryEngine;
    chantDefinitions: readonly ChantDefinition[];
    resourceDefinition: ResourceDefinition;
    normalizeOnAutoComplete: NormalizeOnAutoComplete;
    tooltipParent?: HTMLElement | null;
    value?: string;
    placeholder?: string;
    disabled?: boolean;
    focusOnMount?: boolean;
    mode?: "prompt" | "chants";
  } = $props();

  let editorElement: HTMLDivElement;
  let view = $state<EditorView>();
  let isCompletionActive = $state(false);

  const getContext = (): PluginContext => ({
    i18n,
    mode,
    dictionaryEngine,
    chantDefinitions,
    resourceDefinition,
    normalizeOnAutoComplete,
    tooltipParent,
  });

  // Keymap configuration
  const customKeymap = keymap.of([
    {
      key: "Mod-Enter",
      run: () => {
        $host().dispatchEvent(new Event("cps-editor-submit"));
        return true;
      },
    },
    {
      key: "Escape",
      run: () => {
        $host().dispatchEvent(new Event("cps-editor-close"));
        return true;
      },
    },
    {
      key: "Mod-s",
      run: () => {
        $host().dispatchEvent(new Event("cps-editor-save"));
        return true;
      },
    },
    {
      key: "Mod-Alt-s",
      run: () => {
        $host().dispatchEvent(new Event("cps-editor-save-as"));
        return true;
      },
    },
    {
      key: "Mod-n",
      run: (view) => {
        closeCompletion(view);
        $host().dispatchEvent(new Event("cps-editor-new"));
        return true;
      },
    },
    {
      key: "Mod-m",
      run: (view) => {
        closeCompletion(view);
        $host().dispatchEvent(new Event("cps-editor-new"));
        return true;
      },
    },
    {
      key: "Mod-o",
      run: (view) => {
        closeCompletion(view);
        $host().dispatchEvent(new Event("cps-editor-open"));
        return true;
      },
    },
    {
      key: "Mod-p",
      run: (view) => {
        closeCompletion(view);
        $host().dispatchEvent(new Event("cps-editor-open"));
        return true;
      },
    },
    {
      key: "Mod-ArrowDown",
      run: (view) => modifyNumber(-0.1, view),
      preventDefault: true,
    },
    {
      key: "Mod-ArrowUp",
      run: (view) => modifyNumber(0.1, view),
      preventDefault: true,
    },
    {
      key: "Mod-Shift-z",
      run: redo,
    },
    {
      key: "Tab",
      run: acceptCompletion,
    },
    ...completionKeymap,
    ...defaultKeymap,
  ]);

  // Base editor extensions (without dynamic ones)
  const baseExtensions: Extension[] = [
    commentPlugin,
    tagDecorationPlugin.of(getContext),
    createAutocompletion(getContext),
    history(),
    customKeymap,
    keymap.of(historyKeymap),
    drawSelection(),
    EditorView.lineWrapping,
    EditorState.allowMultipleSelections.of(false),
    EditorView.updateListener.of((update) => {
      if (update.docChanged) {
        const newValue = update.state.doc.toString();

        value = newValue;

        // Dispatch input event
        $host().dispatchEvent(new Event("cps-editor-input"));
      }

      // Check for completion status changes
      const status = completionStatus(update.state);
      const active = status !== null;

      if (active !== isCompletionActive) {
        isCompletionActive = active;

        // Dispatch the autocompletion event
        $host().dispatchEvent(
          new CustomEvent("cps-editor-autocompletion", {
            detail: { active },
          }),
        );
      }
    }),
  ];

  // Function to get all extensions including dynamic ones
  function getExtensions(): Extension[] {
    const extensions = [...baseExtensions];

    extensions.push(
      tooltips({
        parent: tooltipParent ?? undefined,
      }),
    );

    // Handle disabled state
    if (disabled) {
      extensions.push(EditorState.readOnly.of(true));
    }

    // Placeholder configuration
    if (placeholderText) {
      extensions.push(placeholder(placeholderText));
    }

    return extensions;
  }

  // Handle external value changes
  $effect(() => {
    if (!view || view.state.doc.toString() === value) {
      return;
    }

    view.dispatch({
      changes: {
        from: 0,
        to: view.state.doc.length,
        insert: value,
      },
    });
  });

  // Watch disabled and placeholder props for changes
  $effect(() => {
    if (!view) {
      return;
    }

    // Reconfigure extensions when disabled or placeholder changes
    const newExtensions = getExtensions();
    view.dispatch({
      effects: StateEffect.reconfigure.of(newExtensions),
    });
  });

  // Watch userData changes and trigger tag decoration plugin update
  $effect(() => {
    if (!view) {
      return;
    }

    // Access userData to create reactivity
    getContext();

    // Dispatch a custom effect to trigger plugin updates
    view.dispatch({
      effects: contextUpdateEffect.of(null),
    });
  });

  onMount(() => {
    const state = EditorState.create({
      doc: value,
      extensions: getExtensions(),
    });

    view = new EditorView({
      state,
      parent: editorElement,
    });

    if (focusOnMount) {
      const until = Date.now() + 1000;
      const trySetFocus = () => {
        if (Date.now() >= until || !view || view.hasFocus) {
          return;
        }
        view.focus();
        if (!view.hasFocus) {
          setTimeout(trySetFocus, 20);
        }
      };
      trySetFocus();
    }

    return () => {
      view?.destroy();
      view = undefined;
    };
  });
</script>

<div
  bind:this={editorElement}
  class="size-full aria-disabled:pointer-events-none aria-disabled:opacity-50"
  aria-disabled={disabled}
></div>
