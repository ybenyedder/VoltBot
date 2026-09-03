const { getAnimeGif, FALLBACK_GIFS } = require("../core/utils/animeGif");

describe("animeGif utility", () => {
  it("provides fallback gifs for all supported actions", () => {
    for (const action of ["kiss", "hug", "pat", "slap"]) {
      expect(FALLBACK_GIFS[action]).toBeDefined();
      expect(Array.isArray(FALLBACK_GIFS[action])).toBe(true);
      expect(FALLBACK_GIFS[action].length).toBeGreaterThan(0);
      for (const url of FALLBACK_GIFS[action]) {
        expect(url.startsWith("http")).toBe(true);
      }
    }
  });

  it("successfully returns a valid URL for kiss", async () => {
    const url = await getAnimeGif("kiss");
    expect(typeof url).toBe("string");
    expect(url.startsWith("http")).toBe(true);
  });

  it("throws for unsupported action", async () => {
    await expect(getAnimeGif("nonexistent_action_xyz")).rejects.toThrow();
  });
});
