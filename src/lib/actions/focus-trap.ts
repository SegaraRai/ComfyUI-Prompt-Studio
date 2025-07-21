import { createFocusTrap, type Options } from "focus-trap";
import type { Action } from "svelte/action";

export const focusTrap: Action<
  HTMLElement,
  { options?: Options | undefined; paused?: boolean | undefined } | undefined
> = (node, { options, paused } = {}) => {
  const trap = createFocusTrap(node, options);
  trap.activate();

  if (paused) {
    trap.pause();
  }

  return {
    update(newData) {
      if (newData?.paused) {
        trap.pause();
      } else {
        trap.unpause();
      }
    },
    destroy() {
      trap.deactivate();
    },
  };
};
