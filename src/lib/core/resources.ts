export interface EmbeddingDefinition {
  readonly type: "embedding";
  readonly name: string;
  readonly description?: string;
}

export interface LoraDefinition {
  readonly type: "lora";
  readonly name: string;
  readonly description?: string;
}

export interface ResourceDefinition {
  readonly embeddings: readonly EmbeddingDefinition[];
  readonly loras: readonly LoraDefinition[];
}

export function createEmptyResourceDefinition(): ResourceDefinition {
  return {
    embeddings: [],
    loras: [],
  };
}
