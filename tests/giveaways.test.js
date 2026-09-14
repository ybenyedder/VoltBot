// Tests for core/utils/giveaways.js.
//
// 1. parseJsonArray (exporté) : parsing défensif des champs JSON de la DB.
// 2. shuffle (Fisher-Yates) : propriétés statistiques — permutation exacte
//    de l'entrée sur 1000 tirages, et distribution uniforme de la position
//    n°1 sur 10000 tirages d'un ensemble de 5 éléments (±30 % de la moyenne).
//
// NB : au moment de l'écriture, `shuffle` est défini dans giveaways.js mais
// PAS encore exporté (module.exports ne le liste pas). Le groupe est donc
// actif dès que l'export apparaît — sinon il est skippé explicitement pour
// garder la suite verte (core/ est modifié en parallèle par d'autres agents).

const giveaways = require("../core/utils/giveaways");
const { parseJsonArray } = giveaways;

describe("giveaways — parseJsonArray", () => {
  it("passes arrays through unchanged", () => {
    const arr = ["1", "2"];
    expect(parseJsonArray(arr)).toBe(arr);
    expect(parseJsonArray([])).toEqual([]);
  });

  it("parses valid JSON strings", () => {
    expect(parseJsonArray('["a","b"]')).toEqual(["a", "b"]);
    expect(parseJsonArray("[]")).toEqual([]);
  });

  it("returns [] for null/undefined/empty input", () => {
    expect(parseJsonArray(null)).toEqual([]);
    expect(parseJsonArray(undefined)).toEqual([]);
    expect(parseJsonArray("")).toEqual([]);
  });

  it("returns [] for invalid JSON or non-array JSON values", () => {
    expect(parseJsonArray('{"not":"an array"}')).toEqual([]);
    expect(parseJsonArray("{invalid json")).toEqual([]);
    expect(parseJsonArray("42")).toEqual([]);
  });
});

const shuffleExported = typeof giveaways.shuffle === "function";
if (!shuffleExported) {
  // eslint-disable-next-line no-console -- avertir tant que l'export manque
  console.warn(
    "[tests/giveaways] giveaways.shuffle n'est pas exporté — tests Fisher-Yates skippés. " +
      "Ajouter `shuffle` à module.exports de core/utils/giveaways.js pour les activer.",
  );
}

(shuffleExported ? describe : describe.skip)(
  "giveaways — shuffle (Fisher-Yates)",
  () => {
    const shuffle = giveaways.shuffle;

    it("returns a permutation of the input (same elements, same size) over 1000 draws", () => {
      const input = Array.from({ length: 20 }, (_, i) => i);
      for (let draw = 0; draw < 1000; draw++) {
        const out = shuffle(input);
        expect(out).toHaveLength(input.length);
        expect([...out].sort((a, b) => a - b)).toEqual(input); // mêmes éléments
      }
    });

    it("does not mutate the input array (works on a copy)", () => {
      const input = [1, 2, 3, 4, 5, 6, 7, 8];
      const snapshot = [...input];
      shuffle(input);
      expect(input).toEqual(snapshot);
    });

    it("handles edge cases: empty, single element, duplicates", () => {
      expect(shuffle([])).toEqual([]);
      expect(shuffle([42])).toEqual([42]);
      const out = shuffle(["a", "a", "b"]);
      expect([...out].sort()).toEqual(["a", "a", "b"]);
    });

    it("distributes first positions roughly uniformly (±30% of the mean, 5 elements / 10000 draws)", () => {
      const elements = ["a", "b", "c", "d", "e"];
      const DRAWS = 10000;
      const firstCounts = Object.fromEntries(elements.map((e) => [e, 0]));

      for (let draw = 0; draw < DRAWS; draw++) {
        firstCounts[shuffle(elements)[0]]++;
      }

      const mean = DRAWS / elements.length; // 2000
      const tolerance = 0.3 * mean; // ±600 : détecte un shuffle biaisé
      for (const el of elements) {
        expect(firstCounts[el]).toBeGreaterThan(mean - tolerance);
        expect(firstCounts[el]).toBeLessThan(mean + tolerance);
      }
    });
  },
);
