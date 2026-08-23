export type SearchSuggestion = {
  slug: string;
  name: string;
  minPrice: number;
  imageUrl?: string;
};

function scoreSuggestion(suggestion: SearchSuggestion, query: string): number {
  const name = suggestion.name.trim().toLocaleLowerCase();
  const slug = suggestion.slug.trim().toLocaleLowerCase();
  const q = query.trim().toLocaleLowerCase();
  if (name === q) return 1000;
  if (name.startsWith(q)) return 800;
  if (name.split(/\s+/u).some((word) => word.startsWith(q))) return 700;
  if (name.includes(q)) return 500;
  if (slug.startsWith(q)) return 400;
  if (slug.includes(q)) return 300;
  return 0;
}

/** Stable, explainable ranking for the already catalog-filtered suggestion set. */
export function rankSearchSuggestions(
  suggestions: SearchSuggestion[],
  query: string,
): SearchSuggestion[] {
  return suggestions
    .map((suggestion, index) => ({
      suggestion,
      index,
      score: scoreSuggestion(suggestion, query),
    }))
    .sort(
      (a, b) =>
        b.score - a.score ||
        a.suggestion.name.length - b.suggestion.name.length ||
        a.index - b.index,
    )
    .map(({ suggestion }) => suggestion);
}
