import type { ResourceDefinition } from "../core/resources.js";
import { createApp, type App } from "../factory.js";
import { matchesCombo } from "../key-utils.js";
import type { StorageLevel } from "../states/app/storage-utils.js";

export function init(resourceDefinition?: ResourceDefinition): App {
  const app = createApp({
    resourceDefinition,
    storage: {
      loadStorage: (key: string, level: StorageLevel) => {
        return Promise.resolve(localStorage.getItem(`cps:${level}:${key}`));
      },
      saveStorage: (key: string, value: string, level: StorageLevel) => {
        if (localStorage.getItem(`cps:${level}:${key}`) === value) {
          return Promise.resolve();
        }
        localStorage.setItem(`cps:${level}:${key}`, value);
        return Promise.resolve();
      },
      subscribeToStorage: (
        key: string,
        level: StorageLevel,
        callback: (value: string | null) => void,
      ) => {
        const fullKey = `cps:${level}:${key}`;
        const handler = (event: StorageEvent) => {
          if (event.key !== fullKey) {
            return;
          }
          const value = localStorage.getItem(fullKey);
          callback(value);
        };
        window.addEventListener("storage", handler);
        return () => {
          window.removeEventListener("storage", handler);
        };
      },
    },
    data: {
      fetchData: async (source): Promise<string> => {
        if (source.type === "url") {
          // Only support HTTP/HTTPS URLs for security
          if (
            !source.source.startsWith("http://") &&
            !source.source.startsWith("https://")
          ) {
            throw new Error("Only HTTP and HTTPS URLs are supported");
          }

          const response = await fetch(source.source, {
            method: "GET",
            headers: {
              Accept: "text/plain, text/csv, text/*",
            },
          });

          if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
          }

          const contentType = response.headers.get("content-type");
          if (contentType && !contentType.includes("text/")) {
            throw new Error(
              `Unsupported content type: ${contentType}. Only text content is supported.`,
            );
          }

          return await response.text();
        } else if (source.type === "file") {
          throw new Error(
            "File sources are not supported in plain web environment",
          );
        } else {
          throw new Error(`Unsupported source type: ${source.type}`);
        }
      },
    },
    fileStorage: {
      save: async (name: string, content: string, overwrite: boolean) => {
        if (!overwrite && localStorage.getItem(`cps:file:${name}`)) {
          throw new Error(`File already exists: ${name}`);
        }
        localStorage.setItem(`cps:file:${name}`, content);
      },
      load: async (name: string) => {
        const content = localStorage.getItem(`cps:file:${name}`);
        if (content === null) {
          throw new Error(`File not found: ${name}`);
        }
        return content;
      },
      list: async () => {
        const prompts: { name: string; modified: number }[] = [];
        for (const key in localStorage) {
          if (key.startsWith("cps:file:")) {
            const name = key.substring("cps:file:".length);
            const modified = Date.now() / 1000; // Simulate modified time
            prompts.push({ name, modified });
          }
        }
        return { prompts };
      },
      delete: async (name: string) => {
        localStorage.removeItem(`cps:file:${name}`);
      },
    },
  });

  document.addEventListener("keydown", (event) => {
    if (!(event.target instanceof HTMLTextAreaElement)) {
      return;
    }

    if (matchesCombo(event, "mod+space")) {
      event.preventDefault();
      event.stopPropagation();

      const element = app.openPromptStudioForTextArea(event.target);
      element.focusOnMount = true;
      element.focus();
    }
  });

  return app;
}
