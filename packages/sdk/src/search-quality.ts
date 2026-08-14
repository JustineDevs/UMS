export type SynonymGroup = string[];

const SYNONYM_GROUPS: SynonymGroup[] = [
  ["guitar", "electric guitar", "acoustic guitar", "bass guitar"],
  ["keyboard", "piano", "digital piano", "stage piano", "synth", "keys"],
  ["drums", "drum kit", "drum set", "percussion", "cymbals"],
  ["amplifier", "amp", "speaker cabinet", "cab"],
  ["pedal", "effects pedal", "fx", "stompbox"],
  ["strings", "string set", "guitar strings"],
  ["pick", "plectrum", "guitar pick"],
  ["strap", "instrument strap", "guitar strap"],
  ["cable", "instrument cable", "patch cable"],
  ["stand", "instrument stand", "rack"],
  ["accessories", "gear", "instrument accessories", "accessories & gear"],
];

export function expandSynonyms(query: string): string[] {
  const lower = query.toLowerCase().trim();
  const terms = lower.split(/\s+/);
  const expanded = new Set<string>(terms);

  for (const group of SYNONYM_GROUPS) {
    if (group.some((s) => lower.includes(s))) {
      for (const synonym of group) {
        expanded.add(synonym);
      }
    }
  }

  return [...expanded];
}

export function generateTypoVariants(word: string, maxDistance = 1): string[] {
  if (word.length < 3) return [word];
  const variants = new Set<string>();
  variants.add(word);

  if (maxDistance >= 1) {
    for (let i = 0; i < word.length; i++) {
      variants.add(word.slice(0, i) + word.slice(i + 1));
    }
    for (let i = 0; i < word.length - 1; i++) {
      const arr = word.split("");
      [arr[i], arr[i + 1]] = [arr[i + 1], arr[i]];
      variants.add(arr.join(""));
    }
  }
  return [...variants];
}

export function levenshteinDistance(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));

  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost);
    }
  }
  return dp[m][n];
}

export function fuzzyMatch(query: string, target: string, maxDistance = 2): boolean {
  const q = query.toLowerCase();
  const t = target.toLowerCase();
  if (t.includes(q)) return true;
  if (q.length <= 2) return t.startsWith(q);
  return levenshteinDistance(q, t) <= maxDistance;
}

export type MerchandisingRule = {
  id: string;
  type: "boost" | "bury" | "pin";
  query?: string;
  productIds?: string[];
  categoryIds?: string[];
  boostFactor?: number;
  position?: number;
};

export function applyMerchandisingRules<T extends { id: string; category_id?: string }>(
  results: T[],
  rules: MerchandisingRule[],
  query: string,
): T[] {
  const sorted = [...results];

  for (const rule of rules) {
    if (rule.query && !query.toLowerCase().includes(rule.query.toLowerCase())) continue;

    if (rule.type === "pin" && rule.productIds && rule.position !== undefined) {
      for (const pid of rule.productIds) {
        const idx = sorted.findIndex((r) => r.id === pid);
        if (idx >= 0) {
          const [item] = sorted.splice(idx, 1);
          sorted.splice(Math.min(rule.position, sorted.length), 0, item);
        }
      }
    }

    if (rule.type === "bury" && rule.productIds) {
      const buried = sorted.filter((r) => rule.productIds!.includes(r.id));
      const rest = sorted.filter((r) => !rule.productIds!.includes(r.id));
      sorted.length = 0;
      sorted.push(...rest, ...buried);
    }
  }

  return sorted;
}
