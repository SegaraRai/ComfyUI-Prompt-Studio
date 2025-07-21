export function normalizeForQuery(key: string): string {
  return key.trim().normalize().replaceAll("_", " ");
}
