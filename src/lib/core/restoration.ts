import { decodeText, encodeText } from "../wasm/coding.js";

export async function embedOriginalPrompt(
  prompt: string,
  compiledPrompt: string,
  name: string | null,
): Promise<string> {
  // Embed the original prompt encoded at the end
  try {
    if (name != null) {
      // Use name-based format for linked files
      const encodedName = encodeURIComponent(name);
      return `${compiledPrompt}\n\n/*# PROMPT_STUDIO_SRC: FILE:${encodedName} */`.trim();
    } else {
      // Use Brotli encoding for non-linked prompts
      const encodedOriginal = await encodeText(prompt);
      return `${compiledPrompt}\n\n/*# PROMPT_STUDIO_SRC: DATA:${encodedOriginal} */`.trim();
    }
  } catch (error) {
    // If encoding fails, return the compiled prompt without the embedded original
    console.warn("Failed to encode original prompt:", error);
    return compiledPrompt;
  }
}

/**
 * Extract the original prompt from compiled text that contains embedded source
 */
export async function extractOriginalPrompt(
  compiledText: string,
  fileAPI: {
    load: (name: string) => Promise<string>;
  } | null,
): Promise<string | null> {
  const match = /\/\*# PROMPT_STUDIO_SRC: (.+?) \*\//.exec(compiledText);
  if (!match) {
    return null;
  }

  try {
    const encodedData = match[1];

    // Check if it's a FILE: reference
    if (encodedData.startsWith("FILE:")) {
      const name = decodeURIComponent(encodedData.substring(5));
      if (fileAPI) {
        try {
          const result = await fileAPI.load(name);
          return result;
        } catch (error) {
          console.warn(`Failed to load file ${name}:`, error);
          return null;
        }
      } else {
        console.warn("File reference found but no file API provided");
        return null;
      }
    } else {
      // Legacy Brotli encoding
      return await decodeText(encodedData.replace(/^DATA:/, ""));
    }
  } catch (error) {
    console.warn("Failed to decode embedded original prompt:", error);
    return null;
  }
}
