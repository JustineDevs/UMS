import assert from "node:assert/strict";
import test from "node:test";
import {
  expandSearchQueries,
  rankSearchSuggestions,
  type SearchSuggestion,
} from "./search-suggestion-ranking";

const suggestion = (name: string, slug = name.toLowerCase().replaceAll(" ", "-")): SearchSuggestion => ({
  name,
  slug,
  minPrice: 1,
});

test("search suggestions rank exact and prefix names ahead of incidental matches", () => {
  const ranked = rankSearchSuggestions(
    [suggestion("Electric Canary"), suggestion("Canary"), suggestion("Acoustic Canary"), suggestion("Blue Guitar")],
    "canary",
  );
  assert.deepEqual(ranked.map((item) => item.name), [
    "Canary",
    "Electric Canary",
    "Acoustic Canary",
    "Blue Guitar",
  ]);
});

test("search suggestion ranking is stable for equal scores", () => {
  const ranked = rankSearchSuggestions(
    [suggestion("Canary Tone"), suggestion("Canary Case")],
    "canary",
  );
  assert.deepEqual(ranked.map((item) => item.name), ["Canary Tone", "Canary Case"]);
});

test("search suggestions tolerate bounded music-catalog typos", () => {
  const ranked = rankSearchSuggestions(
    [suggestion("Acoustic Guitar"), suggestion("Electric Bass")],
    "acustic guitar",
  );
  assert.equal(ranked[0]?.name, "Acoustic Guitar");
});

test("search query expansion adds synonyms and corrections without duplicates", () => {
  assert.deepEqual(expandSearchQueries("guiter"), ["guiter", "guitar"]);
  assert.deepEqual(expandSearchQueries("amp"), ["amp", "amplifier"]);
});
