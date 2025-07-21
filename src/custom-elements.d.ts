import type {
  CPSPromptEditorAttributes,
  CPSPromptEditorElement,
} from "./lib/editor/prompt-editor.svelte";
import type {
  CPSToastManagerAttributes,
  CPSToastManagerElement,
} from "./lib/toast-manager.svelte";
import type {
  CPSHelpPanelAttributes,
  CPSHelpPanelElement,
} from "./lib/widget/help-panel.svelte";
import type {
  CPSPromptListAttributes,
  CPSPromptListElement,
} from "./lib/widget/prompt-file-list.svelte";
import type {
  CPSPromptStudioAttributes,
  CPSPromptStudioElement,
} from "./lib/widget/prompt-studio.svelte";
import type {
  CPSSettingsPanelAttributes,
  CPSSettingsPanelElement,
} from "./lib/widget/settings-panel.svelte";

declare module "svelte/elements" {
  export interface SvelteHTMLElements {
    "cps-help-panel": CPSHelpPanelAttributes;
    "cps-prompt-editor": CPSPromptEditorAttributes;
    "cps-prompt-list": CPSPromptListAttributes;
    "cps-prompt-studio": CPSPromptStudioAttributes;
    "cps-settings-panel": CPSSettingsPanelAttributes;
    "cps-toast-manager": CPSToastManagerAttributes;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "cps-help-panel": CPSHelpPanelElement;
    "cps-prompt-editor": CPSPromptEditorElement;
    "cps-prompt-list": CPSPromptListElement;
    "cps-prompt-studio": CPSPromptStudioElement;
    "cps-settings-panel": CPSSettingsPanelElement;
    "cps-toast-manager": CPSToastManagerElement;
  }

  interface HTMLElementEventMap {
    "cps-editor-input": Event;
    "cps-editor-submit": Event;
    "cps-editor-save": Event;
    "cps-editor-save-as": Event;
    "cps-editor-new": Event;
    "cps-editor-open": Event;
    "cps-editor-autocompletion": CustomEvent<{ active: boolean }>;

    "cps-input": Event;
    "cps-close": Event;

    "cps-file-select": CustomEvent<{ name: string }>;
  }
}

export {};
