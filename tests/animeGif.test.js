// Tests for core/utils/animeGif.js — 100% hors-ligne.
//
// NB technique : les modules du bot sont en CommonJS chargés via le
// `require` natif (hors module graph Vite), donc `vi.mock("axios")` n'est
// pas intercepté. Le cache CJS étant partagé, on espionne directement
// `axios.get` : aucune requête vers nekos.life / purrbot / otakugifs ne
// sort. On simule chaque étage de la chaîne de fallback : provider 1 OK,
// provider 2 OK après échec du 1, fallback statique quand tout échoue,
// et throw pour une action inconnue (sans réseau).

const { getAnimeGif, FALLBACK_GIFS } = require("../core/utils/animeGif");
const axios = require("axios");

describe("animeGif utility", () => {
  let axiosGet;

  beforeEach(() => {
    axiosGet = vi.spyOn(axios, "get");
  });

  afterEach(() => {
    axiosGet.mockRestore();
  });

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

  it("returns a valid URL for kiss when nekos.life answers (provider 1)", async () => {
    const url = "https://cdn.nekos.life/kiss/kiss_mock_001.gif";
    axiosGet.mockResolvedValueOnce({ data: { url } });

    await expect(getAnimeGif("kiss")).resolves.toBe(url);
    expect(axiosGet).toHaveBeenCalledTimes(1);
    expect(axiosGet.mock.calls[0][0]).toBe("https://nekos.life/api/v2/img/kiss");
  });

  it("falls back to purrbot.site when nekos.life fails (provider 2)", async () => {
    axiosGet
      .mockRejectedValueOnce(new Error("nekos.life down"))
      .mockResolvedValueOnce({ data: { link: "https://cdn.purrbot.site/gif/hug.gif" } });

    await expect(getAnimeGif("hug")).resolves.toBe(
      "https://cdn.purrbot.site/gif/hug.gif",
    );
    expect(axiosGet).toHaveBeenCalledTimes(2);
  });

  it("falls back to otakugifs.xyz when the first two providers fail (provider 3)", async () => {
    axiosGet
      .mockRejectedValueOnce(new Error("nekos.life down"))
      .mockRejectedValueOnce(new Error("purrbot down"))
      .mockResolvedValueOnce({ data: { url: "https://cdn.otakugifs.xyz/slap.gif" } });

    await expect(getAnimeGif("slap")).resolves.toBe(
      "https://cdn.otakugifs.xyz/slap.gif",
    );
    expect(axiosGet).toHaveBeenCalledTimes(3);
  });

  it("falls back to the static curated list when every provider fails", async () => {
    axiosGet.mockRejectedValue(new Error("all providers down"));

    const url = await getAnimeGif("pat");
    expect(FALLBACK_GIFS.pat).toContain(url); // URL issue de la liste statique
    expect(axiosGet).toHaveBeenCalledTimes(3); // les 3 providers essayés
  });

  it("throws for unsupported action without any network access", async () => {
    axiosGet.mockRejectedValue(new Error("provider down"));

    await expect(getAnimeGif("nonexistent_action_xyz")).rejects.toThrow(
      "No GIF found for action: nonexistent_action_xyz",
    );
    expect(axiosGet).toHaveBeenCalledTimes(3);
  });
});
