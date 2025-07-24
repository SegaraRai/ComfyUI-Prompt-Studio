import { api as comfyUIAPI } from "virtual:comfy-ui/scripts/api.js";
import type { DataSourceSpec } from "../../core/data-source.js";
import { createApp, type App } from "../../factory.js";
import { matchesCombo } from "../../key-utils.js";
import type { StorageLevel } from "../../states/app/storage-utils.js";
import type { CPSPromptStudioElement } from "../../widget/prompt-studio.svelte";
import { createComfyUIFileStorage } from "./file-storage.js";

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function waitBackendReady(
  timeout: number,
  pollInterval: number,
): Promise<boolean> {
  const until = Date.now() + timeout;
  while (Date.now() < until) {
    try {
      const response = await comfyUIAPI.fetchApi("/prompt-studio/ready");
      if (response.ok) {
        return true;
      }
    } catch (error) {
      console.error("Error checking backend readiness:", error);
    }

    // Wait a bit before retrying
    await sleep(pollInterval);
  }
  return false;
}

export function init(clientId: string): App {
  const app = createApp({
    fileStorage: createComfyUIFileStorage(),

    storage: {
      async loadStorage(
        key: string,
        level: StorageLevel,
      ): Promise<string | null> {
        try {
          const response = await comfyUIAPI.fetchApi(
            `/prompt-studio/settings/${key}?level=${level}`,
          );
          if (response.status === 404) {
            return null;
          }
          if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
          }
          return await response.text();
        } catch (error) {
          console.error(`Failed to load settings for ${key}:`, error);
          throw error;
        }
      },

      async saveStorage(
        key: string,
        value: string,
        level: StorageLevel,
      ): Promise<void> {
        try {
          const response = await comfyUIAPI.fetchApi(
            `/prompt-studio/settings/${key}?level=${level}&client_id=${encodeURIComponent(clientId)}`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: value,
            },
          );

          if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
          }
        } catch (error) {
          console.error(`Failed to save settings for ${key}:`, error);
          throw error;
        }
      },

      subscribeToStorage(
        key: string,
        level: StorageLevel,
        callback: (value: string | null) => void,
      ): () => void {
        let isSubscribed = true;

        // Listen for WebSocket notifications from the server
        const handleSettingsUpdate = (event: CustomEvent) => {
          if (!isSubscribed) {
            return;
          }

          const data = event.detail;
          if (
            data.key === key &&
            data.level === level &&
            data.client_id !== clientId
          ) {
            // Settings were updated by another client, reload the value
            this.loadStorage(key, level)
              .then((value) => {
                callback(value);
              })
              .catch((error) => {
                console.error(
                  `Error loading updated settings for ${key}:`,
                  error,
                );
              });
          }
        };

        // Add event listener for settings updates
        comfyUIAPI.addEventListener(
          "cps-settings-update",
          handleSettingsUpdate,
        );

        // Return unsubscribe function
        return () => {
          isSubscribed = false;
          comfyUIAPI.removeEventListener(
            "prompt_studio_settings_update",
            handleSettingsUpdate,
          );
        };
      },
    },

    data: {
      async fetchData(source: DataSourceSpec): Promise<string> {
        try {
          if (source.type === "url") {
            // For URLs, we still fetch directly from the client
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
              throw new Error(
                `HTTP ${response.status}: ${response.statusText}`,
              );
            }

            const contentType = response.headers.get("content-type");
            if (contentType && !contentType.includes("text/")) {
              throw new Error(
                `Unsupported content type: ${contentType}. Only text content is supported.`,
              );
            }

            return await response.text();
          } else if (source.type === "file") {
            // For files, use the Python backend API
            const response = await fetch(
              `/prompt-studio/data?type=file&source=${encodeURIComponent(source.source)}`,
            );

            if (!response.ok) {
              throw new Error(
                `HTTP ${response.status}: ${response.statusText}`,
              );
            }

            return await response.text();
          } else {
            throw new Error(`Unsupported source type: ${source.type}`);
          }
        } catch (error) {
          console.error(`Failed to fetch data from ${source.source}:`, error);
          throw error;
        }
      },
    },
  });

  // Override openPromptStudioForTextArea to add workflow execution functionality
  app.openPromptStudioForTextArea = (targetTextArea: HTMLTextAreaElement) => {
    const textAreaToCPSMap = new WeakMap<
      HTMLTextAreaElement,
      CPSPromptStudioElement
    >();
    const existingElement = textAreaToCPSMap.get(targetTextArea);
    if (existingElement) {
      existingElement.focus();
      return existingElement;
    }

    const element = app.openPromptStudio({
      value: targetTextArea.value,
      onInput: (compiledPrompt): void => {
        targetTextArea.value = compiledPrompt;
        targetTextArea.dispatchEvent(new Event("input", { bubbles: true }));
      },
      onClose: (compiledPrompt): void => {
        // re-update the textarea value
        if (compiledPrompt != null) {
          targetTextArea.value = compiledPrompt;
          targetTextArea.dispatchEvent(new Event("input", { bubbles: true }));
        }

        textAreaToCPSMap.delete(targetTextArea);
        targetTextArea.focus();
      },
      onSubmit: (compiledPrompt): void => {
        // Execute workflow when Ctrl+Enter is pressed (if enabled in settings)
        if (compiledPrompt != null) {
          targetTextArea.value = compiledPrompt;
          targetTextArea.dispatchEvent(new Event("input", { bubbles: true }));

          // Trigger ComfyUI workflow execution
          executeWorkflow();
        }
      },
    });
    textAreaToCPSMap.set(targetTextArea, element);

    return element;
  };

  // Workflow execution function
  function executeWorkflow() {
    try {
      // Find the Queue Prompt button and click it
      const queueButton = document.querySelector(
        "#queue-button",
      ) as HTMLButtonElement;
      if (queueButton && !queueButton.disabled) {
        queueButton.click();
        console.log("ComfyUI workflow queued successfully");
      } else {
        console.warn("Queue button not found or disabled");
      }
    } catch (error) {
      console.error("Failed to execute workflow:", error);
    }
  }

  document.addEventListener("keydown", (event) => {
    if (document.querySelector("cps-prompt-studio")) {
      // If a prompt studio is already open, do not open another one
      // Also, prevent the default behavior of the ComfyUI
      event.stopImmediatePropagation();
      return;
    }

    if (!(event.target instanceof HTMLTextAreaElement)) {
      return;
    }

    if (matchesCombo(event, "mod+space")) {
      event.preventDefault();
      event.stopImmediatePropagation();

      const element = app.openPromptStudioForTextArea(event.target);
      element.style.zIndex = "99990";
      element.focusOnMount = true;
      element.focus();

      // Prevent the default keyboard behavior of the ComfyUI
      element.addEventListener("keydown", (event) => {
        event.stopImmediatePropagation();
      });
    }
  });

  app.ready.then(({ toastManager }) => {
    toastManager.style.zIndex = "99999";
  });

  return app;
}
