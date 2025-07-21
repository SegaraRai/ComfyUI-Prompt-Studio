import { atom, type Getter, type Setter } from "jotai/vanilla";
import { addToast } from "./toast.js";

export interface SavedFile {
  name: string;
  modified: number;
}

export interface FileStorageAPI {
  save: (name: string, content: string, overwrite: boolean) => Promise<void>;
  load: (name: string) => Promise<string>;
  list: (search?: string) => Promise<{ prompts: SavedFile[] }>;
  delete: (name: string) => Promise<void>;
}

export const fileStorageAPIAtom = atom<FileStorageAPI>();

const savedFilesBaseAtom = atom<readonly SavedFile[]>([]);

export const savedFilesAtom = atom<readonly SavedFile[]>((get) =>
  get(savedFilesBaseAtom),
);

export function isValidFilename(name: string): boolean {
  if (!name || name.length > 64) {
    return false;
  }

  // Do not start or end with a dot
  if (name.startsWith(".") || name.endsWith(".")) {
    return false;
  }

  // No consecutive dots
  if (name.includes("..")) {
    return false;
  }

  // Allow alphanumeric, underscore, hyphen, dot, and non-ASCII characters
  // Disallow path separators and other problematic characters
  return !/[/\\:<>"|?*]/.test(name);
}

export async function savePromptFile(
  get: Getter,
  name: string,
  content: string,
  overwrite: boolean,
): Promise<void> {
  const fileStorageAPI = get(fileStorageAPIAtom);
  if (!fileStorageAPI) {
    throw new Error("File storage API is not initialized");
  }

  try {
    await fileStorageAPI.save(name, content, overwrite);
    console.log(`Saved prompt file: ${name}`);
  } catch (error) {
    console.error("Failed to save prompt:", error);
    throw error;
  }
}

export async function loadPromptFile(
  get: Getter,
  name: string,
): Promise<string> {
  const fileStorageAPI = get(fileStorageAPIAtom);
  if (!fileStorageAPI) {
    throw new Error("File storage API is not initialized");
  }

  try {
    return await fileStorageAPI.load(name);
  } catch (error) {
    console.error("Failed to load prompt:", error);
    throw error;
  }
}

export async function refreshSavedFiles(
  get: Getter,
  set: Setter,
): Promise<void> {
  try {
    const fileStorageAPI = get(fileStorageAPIAtom);
    if (!fileStorageAPI) {
      throw new Error("File storage API is not initialized");
    }

    const result = await fileStorageAPI.list();
    set(savedFilesBaseAtom, result.prompts);
  } catch (error) {
    console.error("Failed to load saved files:", error);
    addToast(set, {
      severity: "error",
      message: "toast.promptListLoadFailed",
      params: { error: error instanceof Error ? error.message : String(error) },
    });
  }
}
