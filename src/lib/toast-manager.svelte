<svelte:options
  customElement={{
    tag: "cps-toast-manager",
    extend: (cls) => {
      return class extends cls {
        constructor() {
          super();
          initializeComponentStylesheet(
            this,
            ":host{display:block;position:fixed;top:1rem;right:1rem;z-index:9999;pointer-events:none;}",
          );
        }
      };
    },
  }}
/>

<script module lang="ts">
  import type { HTMLAttributes } from "svelte/elements";

  export declare class CPSToastManagerElement extends HTMLElement {
    constructor();

    store: ReturnType<typeof createStore>;
  }

  export interface CPSToastManagerAttributes
    extends HTMLAttributes<CPSToastManagerElement> {
    store: ReturnType<typeof createStore>;
  }
</script>

<script lang="ts">
  import type { createStore } from "jotai/vanilla";
  import { onMount, tick } from "svelte";
  import { initializeComponentStylesheet } from "./component-utils.js";
  import { jotai } from "./jotai-to-svelte-store.js";
  import { i18nAtom } from "./states/app/i18n.js";
  import { settingsAppearanceAtom } from "./states/app/settings.js";
  import { removeToast, toastsAtom, type Toast } from "./states/app/toast.js";

  let {
    store,
  }: {
    store: ReturnType<typeof createStore>;
  } = $props();

  const toasts = $derived(jotai(toastsAtom, store));
  const settingsAppearance = $derived(jotai(settingsAppearanceAtom, store));
  const i18n = $derived(jotai(i18nAtom, store));

  let containerElement: HTMLElement;
  let toastElements: Map<string, HTMLElement> = new Map();
  let timeouts: Map<string, number> = new Map();
  let animatingOut: Set<string> = new Set();

  function handleToastClick(toast: Toast) {
    removeToastWithAnimation(toast.id);
  }

  function removeToastWithAnimation(id: string) {
    if (animatingOut.has(id)) return;

    animatingOut.add(id);
    const element = toastElements.get(id);

    if (element) {
      element.dataset.state = "removing";

      setTimeout(() => {
        removeToast(store.set, id);
        animatingOut.delete(id);
        toastElements.delete(id);
        clearTimeout(timeouts.get(id));
        timeouts.delete(id);
      }, 300);
    } else {
      removeToast(store.set, id);
      animatingOut.delete(id);
    }
  }

  function setupAutoRemove(toast: Toast) {
    const duration = toast.duration === null ? null : (toast.duration ?? 5000);

    if (duration !== null && duration > 0) {
      const timeoutId = window.setTimeout(() => {
        removeToastWithAnimation(toast.id);
      }, duration);

      timeouts.set(toast.id, timeoutId);
    }
  }

  $effect(() => {
    const currentToasts = $toasts;

    currentToasts.forEach((toast) => {
      if (!toastElements.has(toast.id) && !animatingOut.has(toast.id)) {
        tick().then(() => {
          const element = containerElement.querySelector(
            `[data-toast-id="${toast.id}"]`,
          ) as HTMLDivElement;
          if (element) {
            toastElements.set(toast.id, element);
            setupAutoRemove(toast);

            requestAnimationFrame(() => {
              element.dataset.state = "shown";
            });
          }
        });
      }
    });

    toastElements.forEach((element, id) => {
      if (!currentToasts.find((t) => t.id === id) && !animatingOut.has(id)) {
        toastElements.delete(id);
        clearTimeout(timeouts.get(id));
        timeouts.delete(id);
      }
    });
  });

  onMount(() => {
    return () => {
      timeouts.forEach(clearTimeout);
      timeouts.clear();
      toastElements.clear();
      animatingOut.clear();
    };
  });

  /* eslint-disable @typescript-eslint/no-explicit-any */
</script>

<div
  bind:this={containerElement}
  class="pointer-events-none fixed inset-0 z-5000 size-full overflow-hidden bg-transparent px-8 py-6"
  data-theme={$settingsAppearance.theme}
>
  <div class="flex flex-col-reverse items-end gap-y-4">
    {#each $toasts as toast (toast.id)}
      <div
        class="flex-none translate-x-[200%] transition-transform duration-300 ease-in-out data-[state=removing]:translate-x-[200%] data-[state=shown]:translate-x-0"
        role="alert"
        aria-live="polite"
        data-toast-id={toast.id}
      >
        <div
          class="alert data-[severity=error]:alert-error data-[severity=warning]:alert-warning data-[severity=info]:alert-info alert-vertical sm:alert-horizontal pointer-events-auto"
          data-severity={toast.severity}
        >
          <span class="text-sm whitespace-pre-wrap"
            >{$i18n[toast.message](toast.params as any)}</span
          >
          <button
            class="btn btn-sm btn-ghost btn-error btn-square"
            aria-label="Close"
            onclick={() => handleToastClick(toast)}
          >
            <span class="icon-[iconoir--xmark] size-4"></span>
          </button>
        </div>
      </div>
    {/each}
  </div>
</div>
