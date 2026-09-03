const {
  cleanCode,
  isValidCode,
  checkAvailability,
} = require("../core/utils/vanitySniper");

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

  describe("checkAvailability", () => {
    it("detects known taken vanity", async () => {
      const res = await checkAvailability("discord-developers");
      expect(res.available).toBe(false);
      expect(res.guild).toBeDefined();
    });

    it("detects nonexistent vanity as available (404)", async () => {
      const res = await checkAvailability("random-nonexistent-code-987654321");
      expect(res.available).toBe(true);
    });
  });
});
