<script lang="ts">
  import { init } from "$lib/entrypoints/plain.js";
  import { onMount } from "svelte";

  onMount(() => {
    init({
      embeddings: [
        {
          type: "embedding",
          name: "demo-embeddings",
          description: "A prompt studio for ComfyUI",
        },
        {
          type: "embedding",
          name: "demo-embeddings-without-description",
        },
      ],
      loras: [
        {
          type: "lora",
          name: "demo-lora-1.safetensors",
          description: "A demo LORA for ComfyUI",
        },
        {
          type: "lora",
          name: "demo-lora-2.safetensors",
          description: "Another demo LORA for ComfyUI",
        },
        {
          type: "lora",
          name: "demo-lora-3.safetensors",
        },
      ],
    });
  });
</script>

<svelte:head>
  <title>ComfyUI Prompt Studio Demo</title>
</svelte:head>

<div class="container mx-auto space-y-8 p-8">
  <h1 class="text-2xl font-semibold">ComfyUI Prompt Studio Demo</h1>

  <div class="space-y-4">
    <p>
      This demo shows how ComfyUI Prompt Studio can be embedded into other
      applications.
    </p>

    <div class="text-base-content/80 space-y-2 text-sm">
      <p><strong>Try this:</strong></p>
      <ol class="list-inside list-decimal space-y-1">
        <li>
          Click in the textarea below and press
          <kbd class="kbd">Ctrl+Space</kbd>
          to open the prompt studio.
        </li>
        <li>
          Edit your prompt and chants, and it will be reflected in the textarea.
        </li>
        <li>
          Press
          <kbd class="kbd">Ctrl+Enter</kbd>
          or click the "OK" button to close.
        </li>
      </ol>
    </div>
  </div>

  <textarea
    class="input min-h-40 w-full"
    placeholder="Focus here and press Ctrl+Space to open prompt studio..."
  ></textarea>
</div>
