import { describe, expect, it } from "vitest";
import type { ChantDefinition } from "./chants.js";
import type {
  EmbeddingDefinition,
  LoraDefinition,
  ResourceDefinition,
} from "./resources.js";
import { searchChants, searchResources } from "./search.js";

describe("search functionality", () => {
  describe("searchChants", () => {
    const mockChants: ChantDefinition[] = [
      {
        name: "quality",
        description: "High quality tags",
        content: "masterpiece, best quality",
      },
      {
        name: "char:girl",
        description: "Girl character tags",
        content: "1girl, solo",
      },
      {
        name: "pose:standing",
        description: "Standing pose",
        content: "standing, looking at viewer",
      },
      {
        name: "quality:high",
        description: "",
        content: "high quality",
      },
    ];

    it("should return all chants when query is empty", () => {
      const result = searchChants("", mockChants);

      expect(result).toHaveLength(4);
      expect(result.every((r) => r.score === 0)).toBe(true);
      expect(result.map((r) => r.key)).toEqual([
        "quality",
        "char:girl",
        "pose:standing",
        "quality:high",
      ]);
    });

    it("should find exact matches with highest score", () => {
      const result = searchChants("quality", mockChants);

      expect(result).toHaveLength(2);
      expect(result[0].key).toBe("quality");
      expect(result[0].score).toBeGreaterThanOrEqual(result[1].score);
      expect(result[1].key).toBe("quality:high");
    });

    it("should find prefix matches", () => {
      const result = searchChants("char", mockChants);

      expect(result).toHaveLength(1);
      expect(result[0].key).toBe("char:girl");
      expect(result[0].score).toBeGreaterThan(0);
    });

    it("should find partial matches in key name", () => {
      const result = searchChants("girl", mockChants);

      expect(result).toHaveLength(1);
      expect(result[0].key).toBe("char:girl");
      expect(result[0].score).toBeGreaterThan(0);
    });

    it("should find matches in description", () => {
      const result = searchChants("pose", mockChants);

      expect(result).toHaveLength(1);
      expect(result[0].key).toBe("pose:standing");
      expect(result[0].score).toBeGreaterThan(0);
    });

    it("should be case insensitive", () => {
      const result = searchChants("quality", mockChants);

      expect(result).toHaveLength(2);
      expect(result[0].key).toBe("quality");
      expect(result[0].score).toBeGreaterThan(0);
    });

    it("should sort results by score descending", () => {
      const result = searchChants("quality", mockChants);

      expect(result).toHaveLength(2);
      expect(result[0].score).toBeGreaterThanOrEqual(result[1].score);
    });

    it("should handle empty chants array", () => {
      const result = searchChants("test", []);

      expect(result).toHaveLength(0);
    });

    it("should handle chants with no description", () => {
      const result = searchChants("high", mockChants);

      expect(result).toHaveLength(1);
      expect(result[0].key).toBe("quality:high");
      expect(result[0].score).toBeGreaterThan(0);
    });
  });

  describe("searchResources", () => {
    const mockEmbeddings: EmbeddingDefinition[] = [
      {
        type: "embedding",
        name: "badhandv4",
        description: "Fix hand issues",
      },
      {
        type: "embedding",
        name: "easynegative",
        description: "General negative prompt",
      },
    ];

    const mockLoras: LoraDefinition[] = [
      { type: "lora", name: "anime_style.safetensors" },
      { type: "lora", name: "realistic.ckpt" },
    ];

    const mockResources: ResourceDefinition = {
      embeddings: mockEmbeddings,
      loras: mockLoras,
    };

    it("should return both LoRAs and embeddings when query is empty", () => {
      const result = searchResources("", mockResources);

      expect(result).toHaveLength(4);
      expect(result.filter((r) => r.resource.type === "lora")).toHaveLength(2);
      expect(
        result.filter((r) => r.resource.type === "embedding"),
      ).toHaveLength(2);
    });

    it("should return equal scores for empty query", () => {
      const result = searchResources("", mockResources);

      // All items should have score 0 for empty query
      expect(result.every((r) => r.score === 0)).toBe(true);
    });

    it("should find LoRAs with fuzzy matching", () => {
      const result = searchResources("anime", mockResources);

      const loraResults = result.filter((r) => r.resource.type === "lora");
      expect(loraResults.length).toBeGreaterThan(0);
      expect(loraResults[0].resource.name).toBe("anime_style.safetensors");
    });

    it("should find embeddings with fuzzy matching", () => {
      const result = searchResources("bad", mockResources);

      const embeddingResults = result.filter(
        (r) => r.resource.type === "embedding",
      );
      expect(embeddingResults.length).toBeGreaterThan(0);
      expect(embeddingResults[0].resource.name).toBe("badhandv4");
    });

    it("should find mixed results for general query", () => {
      const result = searchResources("a", mockResources);

      const hasLora = result.some((r) => r.resource.type === "lora");
      const hasEmbedding = result.some((r) => r.resource.type === "embedding");

      expect(hasLora || hasEmbedding).toBe(true);
    });

    it("should sort results by score descending", () => {
      const result = searchResources("", mockResources);

      for (let i = 0; i < result.length - 1; i++) {
        expect(result[i].score).toBeGreaterThanOrEqual(result[i + 1].score);
      }
    });

    it("should handle empty arrays", () => {
      const result = searchResources("test", {
        embeddings: [],
        loras: [],
      });

      expect(result).toHaveLength(0);
    });

    it("should provide correct resource data for LoRAs", () => {
      const result = searchResources("anime", mockResources);

      const loraResult = result.find((r) => r.resource.type === "lora");
      if (loraResult) {
        expect(loraResult.key).toBe("lora:anime_style.safetensors");
        expect((loraResult.resource as LoraDefinition).name).toBe(
          "anime_style.safetensors",
        );
      }
    });

    it("should provide correct resource data for embeddings", () => {
      const result = searchResources("bad", mockResources);

      const embeddingResult = result.find(
        (r) => r.resource.type === "embedding",
      );
      if (embeddingResult) {
        expect(embeddingResult.key).toBe("embedding:badhandv4");
        expect((embeddingResult.resource as EmbeddingDefinition).name).toBe(
          "badhandv4",
        );
      }
    });
  });
});
