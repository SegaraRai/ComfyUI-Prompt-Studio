import type { ChantDefinition } from "./chants.js";
import { fuzzyFind } from "./fuzzy.js";
import type {
  EmbeddingDefinition,
  LoraDefinition,
  ResourceDefinition,
} from "./resources.js";

export interface ChantSearchResult {
  key: string;
  chant: ChantDefinition;
  score: number;
}

export interface ResourceSearchResult {
  key: string;
  resource: EmbeddingDefinition | LoraDefinition;
  score: number;
}

/**
 * Chant search algorithm (for @ prefix) - Using custom fuzzy matching
 */
export function searchChants(
  query: string,
  userChants: readonly ChantDefinition[],
): ChantSearchResult[] {
  return fuzzyFind(userChants, query).map((result) => ({
    key: result.item.name,
    chant: result.item,
    score: result.score,
  }));
}

/**
 * Combined search for both LoRAs and embeddings (for < prefix) - Using custom fuzzy matching
 */
export function searchResources(
  query: string,
  resources: ResourceDefinition,
): ResourceSearchResult[] {
  const items = [
    ...resources.embeddings.map((embedding) => ({
      key: `embedding:${embedding.name}`,
      type: "embedding" as const,
      name: embedding.name,
      resource: embedding,
    })),
    ...resources.loras.map((lora) => ({
      key: `lora:${lora.name}`,
      type: "lora" as const,
      name: lora.name,
      resource: lora,
    })),
  ];

  return fuzzyFind(items, query).map((result) => ({
    key: result.item.key,
    resource: result.item.resource,
    type: result.item.type,
    score: result.score,
  }));
}
