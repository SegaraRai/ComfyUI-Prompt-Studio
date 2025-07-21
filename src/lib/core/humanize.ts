export function humanizeCount(count: number) {
  if (count < 1000) {
    return count.toString();
  }
  if (count < 1_000_000) {
    return `${(count / 1000).toFixed(1)}k`;
  }
  if (count < 1_000_000_000) {
    return `${(count / 1_000_000).toFixed(1)}m`;
  }
  return `${(count / 1_000_000_000).toFixed(1)}b`;
}
