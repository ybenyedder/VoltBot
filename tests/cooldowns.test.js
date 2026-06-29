// Smoke tests for core/utils/cooldowns.js
// Verifies first call passes (returns false), second call within the cooldown
// is blocked (returns remaining seconds > 0).

// describe/it/expect come from vitest globals (see vitest.config.js)
const { Collection } = require("discord.js");
const cooldowns = require("../core/utils/cooldowns");

const mkClient = () => ({ cooldowns: new Collection() });
const mkMessage = (authorId) => ({ author: { id: authorId } });

describe("cooldowns.check", () => {
  it("returns false when the command has no cooldown configured", () => {
    const client = mkClient();
    const out = cooldowns.check(client, { name: "ping" }, mkMessage("u1"));
    expect(out).toBe(false);
  });

  it("first call passes (false), second call within window is blocked", () => {
    const client = mkClient();
    const cmd = { name: "work", cooldown: 5 };

    const first = cooldowns.check(client, cmd, mkMessage("u2"));
    expect(first).toBe(false);

    const second = cooldowns.check(client, cmd, mkMessage("u2"));
    expect(typeof second).toBe("number");
    expect(second).toBeGreaterThan(0);
    expect(second).toBeLessThanOrEqual(5);
  });

  it("different users have independent cooldown buckets", () => {
    const client = mkClient();
    const cmd = { name: "daily", cooldown: 10 };

    expect(cooldowns.check(client, cmd, mkMessage("a"))).toBe(false);
    expect(cooldowns.check(client, cmd, mkMessage("b"))).toBe(false);
    expect(cooldowns.check(client, cmd, mkMessage("a"))).toBeGreaterThan(0);
  });
});
