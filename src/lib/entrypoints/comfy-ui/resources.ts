import { api as comfyUIAPI } from "virtual:comfy-ui/scripts/api.js";

export interface ComfyUIModel {
  readonly checkpoints: string[];
  readonly loras: string[];
  readonly vaes: string[];
  readonly controlnets: string[];
  readonly embeddings: string[];
}

function extractStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item) => typeof item === "string")
    : [];
}

function extractModelList(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  objectInfo: any,
  nodeType: string,
  paramName: string,
): string[] {
  return extractStringArray(
    objectInfo[nodeType]?.input?.required?.[paramName]?.[0] ?? [],
  );
}

async function getEmbeddings(): Promise<string[]> {
  try {
    const response = await comfyUIAPI.fetchApi("/embeddings");
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    return extractStringArray(await response.json());
  } catch (error) {
    console.error("Failed to fetch embeddings:", error);
  }
  return [];
}

export async function getAvailableModels(): Promise<ComfyUIModel> {
  try {
    const objectInfoResponse = await comfyUIAPI.fetchApi("/object_info");
    if (!objectInfoResponse.ok) {
      throw new Error(
        `HTTP ${objectInfoResponse.status}: ${objectInfoResponse.statusText}`,
      );
    }

    const objectInfo = await objectInfoResponse.json();

    const models: ComfyUIModel = {
      loras: extractModelList(objectInfo, "LoraLoader", "lora_name"),
      checkpoints: extractModelList(
        objectInfo,
        "CheckpointLoaderSimple",
        "ckpt_name",
      ),
      vaes: extractModelList(objectInfo, "VAELoader", "vae_name"),
      controlnets: extractModelList(
        objectInfo,
        "ControlNetLoader",
        "control_net_name",
      ),
      embeddings: await getEmbeddings(),
    };

    return models;
  } catch (error) {
    console.error("Failed to fetch models:", error);
    return {
      loras: [],
      checkpoints: [],
      vaes: [],
      controlnets: [],
      embeddings: [],
    };
  }
}
