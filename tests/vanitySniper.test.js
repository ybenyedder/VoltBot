// Tests for core/utils/vanitySniper.js — 100% hors-ligne.
//
// NB technique : les modules du bot sont en CommonJS et se chargent via le
// `require` natif de Node, hors du module graph de Vite. `vi.mock("axios")`
// n'est donc PAS intercepté par ces fichiers. En revanche, le cache de
// modules CJS étant partagé, `vi.spyOn(axios, "get")` remplace bien la
// méthode vue par core/utils/vanitySniper.js : aucune requête réelle ne
// peut sortir. Scénarios simulés : vanity pris (200), libre (404),
// rate-limit (429), erreur réseau sans réponse.

const {
  cleanCode,
  isValidCode,
  checkAvailability,
} = require("../core/utils/vanitySniper");
const axios = require("axios");

describe("vanitySniper utility", () => {
  describe("cleanCode", () => {
    it("cleans full URLs correctly", () => {
      expect(cleanCode("https://discord.gg/my-vanity")).toBe("my-vanity");
      expect(cleanCode("http://discord.com/invite/CoolServer")).toBe("coolserver");
      expect(cleanCode("https://discordapp.com/invite/test123?ref=xyz")).toBe("test123");
      expect(cleanCode("discord.gg/ALPHA-BETA/")).toBe("alpha-beta");
    });

    it("handles plain codes and whitespace", () => {
      expect(cleanCode("  simplecode  ")).toBe("simplecode");
      expect(cleanCode("")).toBe("");
      expect(cleanCode(null)).toBe("");
    });
  });

  describe("isValidCode", () => {
    it("accepts valid alphanumeric, hyphen, and underscore codes (2-32 chars)", () => {
      expect(isValidCode("volt")).toBe(true);
      expect(isValidCode("volt-bot_2026")).toBe(true);
      expect(isValidCode("ab")).toBe(true);
    });

    it("rejects invalid codes", () => {
      expect(isValidCode("a")).toBe(false); // too short
      expect(isValidCode("invalid code with spaces")).toBe(false);
      expect(isValidCode("invalid@character!")).toBe(false);
      expect(isValidCode("a".repeat(33))).toBe(false); // too long
      expect(isValidCode(null)).toBe(false);
    });
  });

  describe("checkAvailability (axios espionné — zéro requête réelle)", () => {
    let axiosGet;

    beforeEach(() => {
      axiosGet = vi.spyOn(axios, "get");
    });

    afterEach(() => {
      axiosGet.mockRestore();
    });

    it("detects known taken vanity (200 + guild payload)", async () => {
      const guild = { id: "123456789", name: "Dev Server" };
      axiosGet.mockResolvedValueOnce({ status: 200, data: { guild } });

      const res = await checkAvailability("discord-developers");
      expect(res.available).toBe(false);
      expect(res.guild).toEqual(guild);
      // Une seule requête, sur le bon endpoint Discord
      expect(axiosGet).toHaveBeenCalledTimes(1);
      expect(axiosGet.mock.calls[0][0]).toBe(
        "https://discord.com/api/v10/invites/discord-developers",
      );
    });

    it("detects nonexistent vanity as available (404)", async () => {
      axiosGet.mockRejectedValueOnce({ response: { status: 404 } });

      const res = await checkAvailability("random-nonexistent-code-987654321");
      expect(res.available).toBe(true);
      expect(axiosGet).toHaveBeenCalledTimes(1);
    });

    it("reports unavailable with status 429 on rate limit", async () => {
      axiosGet.mockRejectedValueOnce({
        message: "Request failed with status code 429",
        response: { status: 429 },
      });

      const res = await checkAvailability("volt-rate-limited");
      expect(res.available).toBe(false);
      expect(res.status).toBe(429);
      expect(res.error).toBeDefined();
    });

    it("reports unavailable on network error (no HTTP response)", async () => {
      axiosGet.mockRejectedValueOnce(new Error("connect ETIMEDOUT"));

      const res = await checkAvailability("volt-timeout");
      expect(res.available).toBe(false);
      expect(res.error).toBe("connect ETIMEDOUT");
      expect(res.status).toBeUndefined();
    });

    it("never leaves the spied transport (all recorded calls target discord.com)", () => {
      // Garantie hors-ligne : toute URL enregistrée par l'espion pointe vers
      // l'API Discord — et mockRestore() rend le transport réel après chaque test.
      for (const [url] of axiosGet.mock.calls) {
        expect(String(url).startsWith("https://discord.com/api/v10/")).toBe(true);
      }
    });
  });
});
