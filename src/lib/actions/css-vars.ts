import type { Action } from "svelte/action";

// From https://github.com/kaisermann/svelte-css-vars
// MIT License
export const cssVars: Action<HTMLElement, Record<string, string>> = (
  node,
  data,
) => {
  Object.entries(data).forEach(([key, value]) => {
    node.style.setProperty(key, value);
  });

  return {
    update(newData) {
      Object.entries(newData).forEach(([key, value]) => {
        node.style.setProperty(key, value);
        delete data[key];
      });
      Object.keys(data).forEach((key) => node.style.removeProperty(key));
      data = newData;
    },
    destroy() {
      Object.keys(data).forEach((key) => node.style.removeProperty(key));
      data = {};
    },
  };
};
