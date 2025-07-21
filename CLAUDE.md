# ComfyUI Prompt Studio

This project is an extension that provides rich prompt input functionality for ComfyUI and other applications.
It can be called from any text area on the screen and displays the extension screen on top of it.

Use English for all text, including UI elements, code comments, and documentation.

## Architecture Overview

The extension window (prompt-studio.svelte) features a prompt input box (code editor, prompt-editor.svelte with mode="prompt") in the left pane, a chants code editor (prompt-editor.svelte with mode="chants") in the right pane, and a preview/settings area in the bottom pane.
To support other apps besides ComfyUI, settings such as saving, loading, calling from text areas, and LoRA retrieval are implemented in the lib/comfyui/ directory.

## Technical Requirements

### Custom Elements + Tailwind CSS

Since this app will be embedded into various applications, all components MUST be implemented as:

- **Custom Elements**: Use Svelte's `customElement` configuration with proper tag names (e.g., `cps-prompt-studio`, `cps-prompt-editor`)
- **Tailwind CSS**: Use Tailwind utility classes for all styling instead of custom CSS/SCSS to ensure consistent styling across host applications
- **Host Isolation**: Components should be self-contained and not depend on external stylesheets from host applications

Example pattern (see prompt-editor.svelte for reference):

```svelte
<svelte:options
  customElement={{
    tag: "cps-component-name",
    extend: (cls) => {
      return class extends cls {
        constructor() {
          super();
          initializeComponentStylesheet(this, ":host{display:block;}");
        }
      };
    },
  }}
/>
```

## Prompt Editor

The prompt editor handles a list of Danbooru tags separated by commas or line breaks. It highlights and displays pills for each tag.

There are four types of tags:

- Normal: Plain strings such as `1girl`, `looking_at_viewer`, `(dark:0.8)`, `((smile))`, or `[[sky]]`.
  Underscores can be replaced with spaces. The internal dictionary unifies underscores on JS and whitespace on WASM, but the user can configure it to convert them to spaces during input.
  Any characters except for commas and line breaks are allowed, including alphanumeric characters, colons, slashes, underscores (spaces), parentheses, and square brackets.
- Custom chants: Formatted like `@quality` (prefixed with "@"), calls a chant tag defined in the chant list.
- LoRA: Formatted like `<lora:example.safetensors>` or `<lora:example.safetensors:0.9>`.
- Embeddings: Formatted like `<embedding:example>` or `<embedding:example:0.9>`.

The prompt editor allows the user to use single-line and multi-line comments in JS style.

## Custom Chants

Custom chants are user-defined tags that start with "@" and are aliases for lists of normal tags or LoRA tags. These tags can include weights.
You cannot include other custom chant tags within the definition of a custom chant tag. (In other words, recursive resolution is not supported.)
When using custom chant tags, the user can set weights and apply them to all included tags at once.

## Chants Editor

A custom chant definition is represented by a single piece of text data.
This is the usual prompt syntax with the following label syntax added: `@@name`
The list of tags after `@@name` is treated as belonging to `@@name` until the next label is reached.
Comments beginning with `///` within a chant are treated as descriptions of that chant.
A complete example is as follows (though indentation is not required, it is recommended for readability):

```text
@@q:ill
  /// Default positive prompts (quality prompts) for the "ill" model.
  masterpiece, best quality, high quality

@@neg:ill
  /// Default NEGATIVE prompts for the "ill" model.
  low quality, worst quality

@@char:girl
  1girl, solo
  // you can also use comments like this

@@pose:standing1
  standing
  looking at viewer
  smile
```

## Interoperability between prompt editor and textarea

The text entered in the prompt editor is normalized and set in the text editor when confirmed (Ctrl-Enter or button).

The following processes are performed during normalization.

- Delete comments
- Resolve custom chants
- Process duplicate tags (overwrite, multiply, or add)

This operation is irreversible, and it is not possible to restore the original prompt from the normalized prompt.
Therefore, compress the original code using Brotli compression and embed it at the end of the normalized prompt in the form `\n/*# PROMPT_STUDIO_SRC: <data> */`.
Note that this behavior requires the text encoder of the target application to support multi-line comments.

## Development

Use `npm run check` to check for errors. Though we use `pnpm` for package management, scripts should be run with `npm` to ensure compatibility with the VSCode extension environment.
