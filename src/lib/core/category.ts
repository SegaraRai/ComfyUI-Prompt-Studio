export function categoryToId(category: number): string {
  switch (category) {
    case 0:
      return "general";
    case 1:
      return "artist";
    case 3:
      return "copyright";
    case 4:
      return "character";
    case 5:
      return "meta";
    default:
      return "unknown";
  }
}
