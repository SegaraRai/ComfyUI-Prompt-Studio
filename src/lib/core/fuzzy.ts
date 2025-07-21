/**
 * Calculate fuzzy match score between query and target string
 * Returns a score from 0 (no match) to 1 (perfect match)
 */
function calculateScore(query: string, target: string): number {
  if (!query) {
    return 1;
  }

  if (!target) {
    return 0;
  }

  const normalizedQuery = query.toLowerCase();
  const normalizedTarget = target.toLowerCase();

  // Exact match gets highest score
  if (normalizedTarget === normalizedQuery) {
    return 1;
  }

  // Prefix match gets high score
  if (normalizedTarget.startsWith(normalizedQuery)) {
    return 0.9;
  }

  // Calculate fuzzy match score
  let queryIndex = 0;
  let targetIndex = 0;
  let consecutiveMatches = 0;
  let maxConsecutive = 0;

  while (
    queryIndex < normalizedQuery.length &&
    targetIndex < normalizedTarget.length
  ) {
    if (normalizedQuery[queryIndex] === normalizedTarget[targetIndex]) {
      consecutiveMatches++;
      maxConsecutive = Math.max(maxConsecutive, consecutiveMatches);
      queryIndex++;
    } else {
      consecutiveMatches = 0;
    }
    targetIndex++;
  }

  // If we didn't match all query characters, it's not a match
  if (queryIndex < normalizedQuery.length) {
    return 0;
  }

  // Calculate score based on:
  // 1. How many characters matched (coverage)
  // 2. How consecutive the matches are
  // 3. Length of target string (shorter is better)

  const coverage = queryIndex / normalizedQuery.length;
  const consecutiveBonus = maxConsecutive / normalizedQuery.length;
  const lengthPenalty =
    target.length > query.length ? query.length / target.length : 1;

  return (coverage * 0.5 + consecutiveBonus * 0.3 + lengthPenalty * 0.2) * 0.8;
}

export interface FuzzyResult<T> {
  item: T;
  score: number;
}

/**
 * Fuzzy search function for items with a name property
 */
export function fuzzyFind<T extends { readonly name: string }>(
  items: readonly T[],
  query: string,
): FuzzyResult<T>[] {
  if (!query.trim()) {
    return items.map((item) => ({
      item,
      score: 0,
    }));
  }

  const results: FuzzyResult<T>[] = [];
  for (const item of items) {
    const score = calculateScore(query, item.name);
    if (score > 0.1) {
      results.push({
        item,
        score,
      });
    }
  }

  // Sort by score (descending), then by original order for ties
  results.sort((a, b) => {
    if (Math.abs(a.score - b.score) < 0.001) {
      // Preserve original order for items with very similar scores
      return items.indexOf(a.item) - items.indexOf(b.item);
    }
    return b.score - a.score;
  });

  return results;
}
