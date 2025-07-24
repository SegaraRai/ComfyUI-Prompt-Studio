import { decodeText, encodeText } from "../wasm/coding.js";

export async function embedOriginalPrompt(
  prompt: string,
  compiledPrompt: string,
  name: string | null,
  options?: { encodeOriginalForLinkedFiles?: boolean },
): Promise<string> {
  // Embed the original prompt encoded at the end
  try {
    if (name != null && !options?.encodeOriginalForLinkedFiles) {
      // Use name-based format for linked files (legacy behavior)
      const encodedName = encodeURIComponent(name);
      return `${compiledPrompt}\n\n/*# PROMPT_STUDIO_SRC: FILE:${encodedName} */`.trim();
    } else if (name != null && options?.encodeOriginalForLinkedFiles) {
      // Use data encoding with file reference for linked files (new behavior)
      const encodedOriginal = await encodeText(prompt);
      const encodedName = encodeURIComponent(name);
      return `${compiledPrompt}\n\n/*# PROMPT_STUDIO_SRC: FILE_DATA:${encodedName}:${encodedOriginal} */`.trim();
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

export interface RestorationResult {
  originalPrompt: string;
  conflict?: {
    savedPrompt: string;
    currentFileContent: string;
    filename: string;
  };
}

/**
 * Extract the original prompt from compiled text that contains embedded source
 */
export async function extractOriginalPrompt(
  compiledText: string,
  fileAPI: {
    load: (name: string) => Promise<string>;
  } | null,
): Promise<string | null>;
export async function extractOriginalPrompt(
  compiledText: string,
  fileAPI: {
    load: (name: string) => Promise<string>;
  } | null,
  returnConflictInfo: true,
): Promise<RestorationResult | null>;
export async function extractOriginalPrompt(
  compiledText: string,
  fileAPI: {
    load: (name: string) => Promise<string>;
  } | null,
  returnConflictInfo?: boolean,
): Promise<string | RestorationResult | null> {
  const match = /\/\*# PROMPT_STUDIO_SRC: (.+?) \*\//.exec(compiledText);
  if (!match) {
    return null;
  }

  try {
    const encodedData = match[1];

    // Check if it's a FILE_DATA: reference (new format with embedded content)
    if (encodedData.startsWith("FILE_DATA:")) {
      const restOfData = encodedData.substring(10); // Remove "FILE_DATA:"
      const colonIndex = restOfData.indexOf(":");
      if (colonIndex === -1) {
        console.warn("Invalid FILE_DATA format: missing colon separator");
        return null;
      }
      
      const filename = decodeURIComponent(restOfData.substring(0, colonIndex));
      const encodedContent = restOfData.substring(colonIndex + 1);
      const savedPrompt = await decodeText(encodedContent);
      
      if (fileAPI && returnConflictInfo) {
        try {
          const currentFileContent = await fileAPI.load(filename);
          if (currentFileContent !== savedPrompt) {
            return {
              originalPrompt: savedPrompt,
              conflict: {
                savedPrompt,
                currentFileContent,
                filename,
              },
            };
          }
        } catch (error) {
          // File doesn't exist, no conflict but return saved prompt
          console.warn(`File ${filename} not found during restoration:`, error);
          return returnConflictInfo 
            ? { originalPrompt: savedPrompt }
            : savedPrompt;
        }
      }
      
      return returnConflictInfo 
        ? { originalPrompt: savedPrompt }
        : savedPrompt;
    }
    // Check if it's a FILE: reference (legacy format)
    else if (encodedData.startsWith("FILE:")) {
      const filename = decodeURIComponent(encodedData.substring(5));
      if (fileAPI) {
        try {
          const currentFileContent = await fileAPI.load(filename);
          return returnConflictInfo 
            ? { originalPrompt: currentFileContent }
            : currentFileContent;
        } catch (error) {
          console.warn(`Failed to load file ${filename}:`, error);
          return null;
        }
      } else {
        console.warn("File reference found but no file API provided");
        return null;
      }
    } else {
      // Legacy Brotli encoding
      const savedPrompt = await decodeText(encodedData.replace(/^DATA:/, ""));
      return returnConflictInfo 
        ? { originalPrompt: savedPrompt }
        : savedPrompt;
    }
  } catch (error) {
    console.warn("Failed to decode embedded original prompt:", error);
    return null;
  }
}
