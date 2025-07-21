import type { Action } from "svelte/action";

export const focus: Action<
  HTMLElement,
  { activate?: boolean; restore?: boolean } | undefined
> = (node, { activate = true, restore = true } = {}) => {
  const originalFocused = document.activeElement;

  if (activate) {
    node.focus();
  }

  return {
    destroy() {
      node.blur();

      if (restore && originalFocused instanceof HTMLElement) {
        originalFocused?.focus();
      }
    },
  };
};
