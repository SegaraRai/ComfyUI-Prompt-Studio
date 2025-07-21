/**
 * Data source specification interface
 */
export interface DataSourceSpec {
  type: "url" | "file";
  source: string;
}

/**
 * Extracts data source specifications from a multi-line string
 * Each line can contain either a URL or filename, with optional "#" comments
 *
 * @param text - Multi-line string containing source specifications
 * @returns Array of parsed data source specifications
 */
export function extractDataSources(text: string): DataSourceSpec[] {
  const sources: DataSourceSpec[] = [];

  if (!text) {
    return sources;
  }

  const lines = text.split(/\r?\n/);

  for (const line of lines) {
    const trimmedLine = line.trim();

    // Skip empty lines
    if (!trimmedLine) {
      continue;
    }

    // Skip comment-only lines
    if (trimmedLine.startsWith("#")) {
      continue;
    }

    // Extract content before any comment
    const commentIndex = trimmedLine.indexOf("#");
    const content =
      commentIndex >= 0
        ? trimmedLine.substring(0, commentIndex).trim()
        : trimmedLine;

    // Skip if no content after removing comments
    if (!content) {
      continue;
    }

    // Determine if it's a URL or file path
    const isUrl = /^https?:\/\//.test(content);

    sources.push({
      type: isUrl ? "url" : "file",
      source: content,
    });
  }

  return sources;
}

/**
 * Validates a data source specification
 *
 * @param spec - Data source specification to validate
 * @returns True if valid, false otherwise
 */
export function validateDataSource(spec: DataSourceSpec): boolean {
  if (!spec.source?.trim()) {
    return false;
  }

  if (spec.type === "url") {
    try {
      new URL(spec.source);
      return true;
    } catch {
      return false;
    }
  }

  if (spec.type === "file") {
    // Basic filename validation - no empty string, no invalid characters
    const invalidChars = /[<>:"|?*]/;
    return !invalidChars.test(spec.source);
  }

  return false;
}

/**
 * Normalizes a data source specification
 *
 * @param spec - Data source specification to normalize
 * @returns Normalized specification
 */
export function normalizeDataSource(spec: DataSourceSpec): DataSourceSpec {
  return {
    type: spec.type,
    source: spec.source.trim(),
  };
}

/**
 * Serializes data sources back to a multi-line string format
 *
 * @param sources - Array of data source specifications
 * @returns Multi-line string representation
 */
export function serializeDataSources(sources: DataSourceSpec[]): string {
  return sources.map((source) => source.source).join("\n");
}
