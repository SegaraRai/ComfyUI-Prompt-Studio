import type { FileStorageAPI } from "../../states/app/file-storage.js";

export function createComfyUIFileStorage(): FileStorageAPI {
  const fileApiBaseUrl = "/prompt-studio/prompts";

  const handleResponse = async (response: Response) => {
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }
    return response.json();
  };

  const handleTextResponse = async (response: Response) => {
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }
    return response.text();
  };

  return {
    save: async (name: string, content: string, overwrite: boolean) => {
      const response = await fetch(
        `${fileApiBaseUrl}/${encodeURIComponent(name)}?overwrite=${overwrite}`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "text/plain",
          },
          body: content,
        },
      );
      await handleTextResponse(response);
    },

    load: async (name: string) => {
      const response = await fetch(
        `${fileApiBaseUrl}/${encodeURIComponent(name)}`,
      );
      return handleTextResponse(response);
    },

    list: async () => {
      const response = await fetch(fileApiBaseUrl);
      const prompts = await handleResponse(response);
      return { prompts };
    },

    delete: async (name: string) => {
      const response = await fetch(
        `${fileApiBaseUrl}/${encodeURIComponent(name)}`,
        {
          method: "DELETE",
        },
      );
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }
    },
  };
}
