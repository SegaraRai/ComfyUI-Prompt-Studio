import { describe, expect, it } from "vitest";
import type { ChantDefinition } from "./chants.js";
import type { CompileContext, CompileOptions } from "./compile.js";
import { compilePrompt, formatTag } from "./compile.js";

describe("compile functionality", () => {
  describe("formatTag", () => {
    const defaultOptions: CompileOptions = {
      normalize: "none",
      escapeTarget: "none",
      duplicateTagHandling: "overwrite",
    };

    it("should format normal tags", () => {
      const tag = {
        notation: "default" as const,
        type: "normal" as const,
        prefix: "" as const,
        name: "1girl",
        weight: 1.0,
        precision: 2,
      };
      expect(formatTag(tag, defaultOptions)).toBe("1girl");
    });

    it("should format normal tags with weights", () => {
      const tag = {
        notation: "default" as const,
        type: "normal" as const,
        prefix: "" as const,
        name: "smile",
        weight: 0.9,
        precision: 1,
      };
      expect(formatTag(tag, defaultOptions)).toBe("(smile:0.9)");
    });

    it("should format LoRA tags", () => {
      const tag = {
        notation: "lora" as const,
        type: "lora" as const,
        prefix: "lora:" as const,
        name: "example.safetensors",
        weight: 0.8,
        precision: 1,
        extra: "",
      };
      expect(formatTag(tag, defaultOptions)).toBe(
        "<lora:example.safetensors:0.8>",
      );
    });

    it("should format LoRA tags with extra parameters", () => {
      const tag = {
        notation: "lora" as const,
        type: "lora" as const,
        prefix: "lora:" as const,
        name: "example.safetensors",
        weight: 0.8,
        precision: 1,
        extra: ":extra",
      };
      expect(formatTag(tag, defaultOptions)).toBe(
        "<lora:example.safetensors:0.8:extra>",
      );
    });

    it("should format embedding tags", () => {
      const tag = {
        notation: "default" as const,
        type: "embedding" as const,
        prefix: "embedding:" as const,
        name: "example",
        weight: 0.9,
        precision: 1,
      };
      expect(formatTag(tag, defaultOptions)).toBe("<embedding:example:0.9>");
    });

    it("should return null for zero weight", () => {
      const tag = {
        notation: "default" as const,
        type: "normal" as const,
        prefix: "" as const,
        name: "bad_quality",
        weight: 0.0,
        precision: 2,
      };
      expect(formatTag(tag, defaultOptions)).toBeNull();
    });

    it("should escape parentheses when escapeTarget is parentheses", () => {
      const options: CompileOptions = {
        ...defaultOptions,
        escapeTarget: "parentheses",
      };
      const tag = {
        notation: "default" as const,
        type: "normal" as const,
        prefix: "" as const,
        name: "tag(with)parens",
        weight: 1.0,
        precision: 2,
      };
      expect(formatTag(tag, options)).toBe("tag\\(with\\)parens");
    });

    it("should handle precision formatting", () => {
      const tag = {
        notation: "default" as const,
        type: "normal" as const,
        prefix: "" as const,
        name: "smile",
        weight: 0.75,
        precision: 2,
      };
      expect(formatTag(tag, defaultOptions)).toBe("(smile:0.75)");
    });

    it("should remove trailing zeros", () => {
      const tag = {
        notation: "default" as const,
        type: "normal" as const,
        prefix: "" as const,
        name: "smile",
        weight: 0.5,
        precision: 3,
      };
      expect(formatTag(tag, defaultOptions)).toBe("(smile:0.5)");
    });
  });

  describe("compilePrompt", () => {
    const mockChants: ChantDefinition[] = [
      {
        name: "quality",
        description: "Quality tags",
        content: "masterpiece, best quality",
      },
      {
        name: "char:girl",
        description: "Girl character",
        content: "1girl, solo",
      },
    ];

    const defaultContext: CompileContext = {
      chantDefinitions: mockChants,
      resourceDefinition: { loras: [], embeddings: [] },
      options: {
        normalize: "none",
        escapeTarget: "none",
        duplicateTagHandling: "overwrite",
      },
    };

    it("should expand chant tags", () => {
      const result = compilePrompt("@quality, @char:girl", defaultContext);
      expect(result).toBe("masterpiece, best quality, 1girl, solo");
    });

    it("should handle mixed tags and chants", () => {
      const result = compilePrompt(
        "@quality, smile, long hair",
        defaultContext,
      );
      expect(result).toBe("masterpiece, best quality, smile, long hair");
    });

    it("should handle duplicate tags with overwrite", () => {
      const result = compilePrompt("1girl, 1girl", defaultContext);
      expect(result).toBe("1girl");
    });

    it("should handle duplicate tags with add", () => {
      const context: CompileContext = {
        ...defaultContext,
        options: {
          ...defaultContext.options,
          duplicateTagHandling: "add",
        },
      };
      const result = compilePrompt("(1girl:0.5), (1girl:0.3)", context);
      expect(result).toBe("(1girl:0.8)");
    });

    it("should handle duplicate tags with multiply", () => {
      const context: CompileContext = {
        ...defaultContext,
        options: {
          ...defaultContext.options,
          duplicateTagHandling: "multiply",
        },
      };
      const result = compilePrompt("(1girl:0.5), (1girl:0.8)", context);
      expect(result).toBe("(1girl:0.4)");
    });

    it("should handle duplicate tags with ignore", () => {
      const context: CompileContext = {
        ...defaultContext,
        options: {
          ...defaultContext.options,
          duplicateTagHandling: "ignore",
        },
      };
      const result = compilePrompt("(1girl:0.5), (1girl:0.8)", context);
      expect(result).toBe("(1girl:0.5)");
    });

    it("should normalize underscores to spaces", () => {
      const context: CompileContext = {
        ...defaultContext,
        options: {
          ...defaultContext.options,
          normalize: "whitespace",
        },
      };
      const result = compilePrompt("long_hair, looking_at_viewer", context);
      expect(result).toBe("long hair, looking at viewer");
    });

    it("should normalize spaces to underscores", () => {
      const context: CompileContext = {
        ...defaultContext,
        options: {
          ...defaultContext.options,
          normalize: "underscore",
        },
      };
      const result = compilePrompt("long hair, looking at viewer", context);
      expect(result).toBe("long_hair, looking_at_viewer");
    });

    it("should handle LoRA tags", () => {
      const result = compilePrompt(
        "<lora:example.safetensors:0.8>",
        defaultContext,
      );
      expect(result).toBe("<lora:example.safetensors:0.8>");
    });

    it("should handle embedding tags", () => {
      const result = compilePrompt("<embedding:example:0.9>", defaultContext);
      expect(result).toBe("<embedding:example:0.9>");
    });

    it("should handle weight tags", () => {
      const result = compilePrompt("(smile:0.9)", defaultContext);
      expect(result).toBe("(smile:0.9)");
    });

    it("should handle parentheses modifiers", () => {
      const result = compilePrompt("((smile))", defaultContext);
      expect(result).toBe("(smile:1.21)");
    });

    it("should handle bracket modifiers", () => {
      const result = compilePrompt("[smile]", defaultContext);
      expect(result).toBe("(smile:0.9)");
    });

    it("should filter out zero weight tags", () => {
      const result = compilePrompt("-bad_quality, 1girl", defaultContext);
      expect(result).toBe("1girl");
    });

    it("should handle empty input", () => {
      const result = compilePrompt("", defaultContext);
      expect(result).toBe("");
    });

    it("should handle chant markers", () => {
      const result = compilePrompt("@@quality", defaultContext);
      expect(result).toBe("");
    });

    it("should handle unknown chants", () => {
      const result = compilePrompt("@unknown", defaultContext);
      expect(result).toBe("");
    });

    it("should handle complex mixed prompt", () => {
      const result = compilePrompt(
        "@quality, (smile:0.9), <lora:example:0.8>, long hair",
        defaultContext,
      );
      expect(result).toBe(
        "masterpiece, best quality, (smile:0.9), <lora:example:0.8>, long hair",
      );
    });

    it("should handle chant weights", () => {
      const result = compilePrompt("(@quality:0.8)", defaultContext);
      expect(result).toBe("(masterpiece:0.8), (best quality:0.8)");
    });

    it("should escape parentheses when needed", () => {
      const context: CompileContext = {
        ...defaultContext,
        options: {
          ...defaultContext.options,
          escapeTarget: "parentheses",
        },
      };
      const result = compilePrompt("tag(with)parens", context);
      expect(result).toBe("tag\\(with\\)parens");
    });

    describe("chant weight multiplication", () => {
      const chantWithWeightContext: CompileContext = {
        chantDefinitions: [
          {
            name: "test",
            description: "Test chant",
            content: "1girl, (standing:0.5)",
          },
        ],
        resourceDefinition: { loras: [], embeddings: [] },
        options: defaultContext.options,
      };

      it("should multiply chant weight with tag weights", () => {
        const result = compilePrompt("(@test:0.5)", chantWithWeightContext);
        expect(result).toBe("(1girl:0.5), (standing:0.3)");
      });

      it("should handle chant weight multiplication with normal weight", () => {
        const result = compilePrompt("(@test:2.0)", chantWithWeightContext);
        expect(result).toBe("(1girl:2.0), standing");
      });

      it("should handle mixed chant and normal tags with weights", () => {
        const result = compilePrompt(
          "(@test:0.8), (smile:1.2)",
          chantWithWeightContext,
        );
        expect(result).toBe("(1girl:0.8), (standing:0.4), (smile:1.2)");
      });
    });

    describe("zero weight erasure", () => {
      it("should erase preceding tags with minus prefix", () => {
        const result = compilePrompt("(1girl:2.0), -1girl", defaultContext);
        expect(result).toBe("");
      });

      it("should erase and then add back with minus prefix", () => {
        const result = compilePrompt(
          "(1girl:0.5), -1girl, (1girl:2.0)",
          defaultContext,
        );
        expect(result).toBe("(1girl:2.0)");
      });

      it("should erase with explicit zero weight", () => {
        const result = compilePrompt(
          "(1girl:2.0), (1girl:0.0)",
          defaultContext,
        );
        expect(result).toBe("");
      });

      it("should handle zero weight erasure for LoRA tags", () => {
        const result = compilePrompt(
          "<lora:test:0.8>, <lora:test:0.0>",
          defaultContext,
        );
        expect(result).toBe("");
      });

      it("should handle minus prefix erasure for LoRA tags", () => {
        const result = compilePrompt(
          "<lora:test:0.8>, -<lora:test>",
          defaultContext,
        );
        expect(result).toBe("");
      });

      it("should handle minus prefix with weight for LoRA tags", () => {
        const result = compilePrompt(
          "<lora:test:0.8>, -<lora:test:0.5>",
          defaultContext,
        );
        expect(result).toBe("");
      });

      it("should handle zero weight erasure for embedding tags", () => {
        const result = compilePrompt(
          "<embedding:test:0.9>, <embedding:test:0.0>",
          defaultContext,
        );
        expect(result).toBe("");
      });

      it("should handle minus prefix for chants", () => {
        const result = compilePrompt(
          "1girl, 1boy, -@char:girl",
          defaultContext,
        );
        expect(result).toBe("1boy");
      });

      it("should handle complex erasure scenario", () => {
        const result = compilePrompt(
          "1girl, 1boy, smile, -1girl, -smile, long_hair",
          defaultContext,
        );
        expect(result).toBe("1boy, long_hair");
      });

      it("should handle erasure with different tag types", () => {
        const result = compilePrompt(
          "1girl, <lora:test:0.8>, <embedding:example:0.9>, -1girl, -<lora:test>, -<embedding:example>",
          defaultContext,
        );
        expect(result).toBe("");
      });

      it("should handle zero weight with chant multiplication", () => {
        const chantContext: CompileContext = {
          chantDefinitions: [
            {
              name: "test",
              description: "Test chant",
              content: "1girl, standing",
            },
          ],
          resourceDefinition: { loras: [], embeddings: [] },
          options: defaultContext.options,
        };
        const result = compilePrompt("(@test:0.0)", chantContext);
        expect(result).toBe("");
      });

      it("should handle partial erasure in chants", () => {
        const chantContext: CompileContext = {
          chantDefinitions: [
            {
              name: "test",
              description: "Test chant",
              content: "1girl, 1boy, -1girl",
            },
          ],
          resourceDefinition: { loras: [], embeddings: [] },
          options: defaultContext.options,
        };
        const result = compilePrompt("@test", chantContext);
        expect(result).toBe("1boy");
      });
    });

    describe("comment handling", () => {
      it("should strip single-line comments", () => {
        const result = compilePrompt(
          "1girl, smile // this is a comment\nlong hair",
          defaultContext,
        );
        expect(result).toBe("1girl, smile, long hair");
      });

      it("should strip multi-line comments", () => {
        const result = compilePrompt(
          "1girl, /* this is a\n   multi-line comment */ smile",
          defaultContext,
        );
        expect(result).toBe("1girl, smile");
      });

      it("should handle comments at the beginning of input", () => {
        const result = compilePrompt(
          "// comment at start\n1girl, smile",
          defaultContext,
        );
        expect(result).toBe("1girl, smile");
      });

      it("should handle comments at the end of input", () => {
        const result = compilePrompt(
          "1girl, smile // comment at end",
          defaultContext,
        );
        expect(result).toBe("1girl, smile");
      });

      it("should handle multiple single-line comments", () => {
        const result = compilePrompt(
          "1girl, // first comment\nsmile, // second comment\nlong hair",
          defaultContext,
        );
        expect(result).toBe("1girl, smile, long hair");
      });

      it("should handle multiple multi-line comments", () => {
        const result = compilePrompt(
          "1girl, /* comment1 */ smile /* comment2 */ long hair",
          defaultContext,
        );
        // After comment stripping and tokenization, extra spaces are normalized
        expect(result).toBe("1girl, smile                long hair");
      });

      it("should handle mixed comment types", () => {
        const result = compilePrompt(
          "1girl, /* multi-line */ smile // single-line\nlong hair",
          defaultContext,
        );
        expect(result).toBe("1girl, smile, long hair");
      });

      it("should handle comments within chant expansion", () => {
        const result = compilePrompt(
          "@quality, // comment after chant\nsmile",
          defaultContext,
        );
        expect(result).toBe("masterpiece, best quality, smile");
      });

      it("should handle comments with weights", () => {
        const result = compilePrompt(
          "(1girl:0.8), // comment\n(smile:1.2)",
          defaultContext,
        );
        expect(result).toBe("(1girl:0.8), (smile:1.2)");
      });

      it("should handle comments with LoRA tags", () => {
        const result = compilePrompt(
          "<lora:example:0.8>, // LoRA comment\n1girl",
          defaultContext,
        );
        expect(result).toBe("<lora:example:0.8>, 1girl");
      });

      it("should handle comments with embedding tags", () => {
        const result = compilePrompt(
          "<embedding:example:0.9>, /* embedding comment */ 1girl",
          defaultContext,
        );
        expect(result).toBe("<embedding:example:0.9>, 1girl");
      });

      it("should handle comments with parentheses and bracket modifiers", () => {
        const result = compilePrompt(
          "((smile)), // doubled parentheses\n[background] /* bracket modifier */",
          defaultContext,
        );
        expect(result).toBe("(smile:1.21), (background:0.9)");
      });

      it("should handle comments with minus prefix tags", () => {
        const result = compilePrompt(
          "1girl, 1boy, // initial tags\n-1girl // remove girl",
          defaultContext,
        );
        expect(result).toBe("1boy");
      });

      it("should handle comments with duplicate tag scenarios", () => {
        const result = compilePrompt(
          "1girl, // first instance\n1girl // duplicate",
          defaultContext,
        );
        expect(result).toBe("1girl");
      });

      it("should handle comments with chant weights", () => {
        const result = compilePrompt(
          "(@quality:0.8), // chant with weight\nsmile",
          defaultContext,
        );
        expect(result).toBe("(masterpiece:0.8), (best quality:0.8), smile");
      });

      it("should handle empty lines with comments", () => {
        const result = compilePrompt(
          "1girl,\n\n// comment on empty line\n\nsmile",
          defaultContext,
        );
        expect(result).toBe("1girl, smile");
      });

      it("should handle comments with special characters", () => {
        const result = compilePrompt(
          "1girl, // comment with special chars: @#$%^&*()\nsmile",
          defaultContext,
        );
        expect(result).toBe("1girl, smile");
      });

      it("should handle comments with unicode characters", () => {
        const result = compilePrompt(
          "1girl, // コメント with 日本語 and émojis: 😊\nsmile",
          defaultContext,
        );
        expect(result).toBe("1girl, smile");
      });

      it("should handle unclosed multi-line comments", () => {
        const result = compilePrompt(
          "1girl, /* unclosed comment\nsmile",
          defaultContext,
        );
        // Unclosed comments are NOT treated as comments, so they remain in the output
        expect(result).toBe("1girl, /* unclosed comment, smile");
      });

      it("should handle nested comment-like patterns", () => {
        const result = compilePrompt(
          "1girl, /* comment with // inside */ smile",
          defaultContext,
        );
        expect(result).toBe("1girl");
      });

      it("should handle comment-like content in tag names", () => {
        const result = compilePrompt(
          "tag_with_//slashes, tag_with_/*stars*/",
          defaultContext,
        );
        expect(result).toBe("tag_with_");
      });

      it("should handle comments with complex prompt structures", () => {
        const result = compilePrompt(
          `@quality, // quality tags
        (1girl:0.8), // character
        <lora:example:0.7>, // LoRA
        /* multi-line comment
           with multiple lines */
        smile, long hair // final tags`,
          defaultContext,
        );
        expect(result).toBe(
          "masterpiece, best quality, (1girl:0.8), <lora:example:0.7>, smile, long hair",
        );
      });

      it("should preserve tag functionality when comments are removed", () => {
        const contextWithAdd: CompileContext = {
          ...defaultContext,
          options: {
            ...defaultContext.options,
            duplicateTagHandling: "add",
          },
        };

        const result = compilePrompt(
          "(1girl:0.5), // first instance\n(1girl:0.3) // second instance",
          contextWithAdd,
        );
        expect(result).toBe("(1girl:0.8)");
      });

      it("should handle comments with normalization", () => {
        const contextWithNormalize: CompileContext = {
          ...defaultContext,
          options: {
            ...defaultContext.options,
            normalize: "whitespace",
          },
        };

        const result = compilePrompt(
          "long_hair, // comment\nlooking_at_viewer",
          contextWithNormalize,
        );
        expect(result).toBe("long hair, looking at viewer");
      });

      it("should handle comments with escaping", () => {
        const contextWithEscape: CompileContext = {
          ...defaultContext,
          options: {
            ...defaultContext.options,
            escapeTarget: "parentheses",
          },
        };

        const result = compilePrompt(
          "tag(with)parens, // comment\nother_tag",
          contextWithEscape,
        );
        expect(result).toBe("tag\\(with\\)parens, other_tag");
      });
    });
  });
});
