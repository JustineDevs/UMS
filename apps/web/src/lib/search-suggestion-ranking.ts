export type SearchSuggestion = {
  slug: string;
  name: string;
  minPrice: number;
  imageUrl?: string;
};

const SEARCH_VOCABULARY = [
  "acoustic",
  "accessories",
  "accessory",
  "amplifier",
  "amp",
  "bass",
  "cable",
  "cables",
  "drum",
  "drums",
  "electric",
  "guitar",
  "guitars",
  "keyboard",
  "microphone",
  "pedal",
  "pedals",
] as const;

const SEARCH_SYNONYMS: Record<string, string> = {
  amp: "amplifier",
  accessory: "accessories",
  cable: "cables",
  drum: "drums",
  guitar: "guitars",
  pedal: "pedals",
};

function editDistance(left: string, right: string): number {
  const previous = Array.from({ length: right.length + 1 }, (_, index) => index);
  for (let row = 1; row <= left.length; row += 1) {
    const current = [row];
    for (let column = 1; column <= right.length; column += 1) {
      current[column] = Math.min(
        current[column - 1]! + 1,
        previous[column]! + 1,
        previous[column - 1]! + (left[row - 1] === right[column - 1] ? 0 : 1),
      );
    }
    previous.splice(0, previous.length, ...current);
  }
  return previous[right.length]!;
}

function nearestCatalogWord(word: string): string | undefined {
  if (word.length < 3) return undefined;
  const maximumDistance = word.length >= 7 ? 2 : 1;
  let nearest: string | undefined;
  let nearestDistance = maximumDistance + 1;
  for (const candidate of SEARCH_VOCABULARY) {
    const distance = editDistance(word, candidate);
    if (distance < nearestDistance) {
      nearest = candidate;
      nearestDistance = distance;
    }
  }
  return nearestDistance <= maximumDistance ? nearest : undefined;
}

/** Return at most three bounded catalog queries: original, synonym, and typo correction. */
export function expandSearchQueries(query: string): string[] {
  const normalized = query.trim().toLocaleLowerCase();
  if (!normalized) return [];
  const terms = normalized.split(/\s+/u);
  const expanded = new Set([normalized]);
  const synonymTerms = terms.map((term) => SEARCH_SYNONYMS[term] ?? term);
  const correctedTerms = terms.map((term) => nearestCatalogWord(term) ?? term);
  expanded.add(synonymTerms.join(" "));
  expanded.add(correctedTerms.join(" "));
  return [...expanded].slice(0, 3);
}

function fuzzyTokenScore(name: string, query: string): number {
  const queryTerms = query.split(/\s+/u).filter(Boolean);
  const nameTerms = name.split(/\s+/u).filter(Boolean);
  if (queryTerms.length === 0) return 0;
  const matched = queryTerms.filter((queryTerm) =>
    nameTerms.some((nameTerm) => {
      const distance = editDistance(queryTerm, nameTerm);
      return distance <= (queryTerm.length >= 7 ? 2 : 1);
    }),
  ).length;
  return matched === queryTerms.length ? 250 : 0;
}

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
  return fuzzyTokenScore(name, q);
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
