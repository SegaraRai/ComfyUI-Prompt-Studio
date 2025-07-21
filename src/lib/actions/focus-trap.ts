import { createFocusTrap, type Options } from "focus-trap";
import type { Action } from "svelte/action";

export const focusTrap: Action<HTMLElement, Options | undefined> = (
  node,
  options,
) => {
  const trap = createFocusTrap(node, options);
  trap.activate();

  return {
    destroy() {
      trap.deactivate();
    },
  };
};
