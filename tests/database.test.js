// Smoke tests for core/utils/database.js
// Covers: guild create+read, module toggle round-trip, blacklist round-trip,
// and mute preset CRUD. DB is sandboxed by tests/setup.js (BOT_INSTANCE_CWD).

// describe/it/expect/beforeAll come from vitest globals (see vitest.config.js)

let db;

beforeAll(() => {
  db = require("../core/utils/database");
});

describe("database.js — guilds", () => {
  it("creates a guild on first getGuild and reads it back", () => {
    const g = db.getGuild("guild-1");
    expect(g).toBeTruthy();
    expect(g.guildId).toBe("guild-1");
    // Default prefix from CREATE TABLE: "+"
    expect(g.prefix).toBe("+");

    // Second call returns same row, no duplicate insert
    const g2 = db.getGuild("guild-1");
    expect(g2.guildId).toBe("guild-1");
  });

  it("updateGuild persists scalar updates", () => {
    db.getGuild("guild-2");
    db.updateGuild("guild-2", { prefix: "!", language: "en" });
    const g = db.getGuild("guild-2");
    expect(g.prefix).toBe("!");
    expect(g.language).toBe("en");
  });
});

describe("database.js — module toggles", () => {
  it("isModuleEnabled defaults to true for unknown modules", () => {
    expect(db.isModuleEnabled("guild-mod", "economy")).toBe(true);
  });

  it("updateGuildModule round-trips and invalidates the cache", () => {
    db.updateGuildModule("guild-mod", "economy", false);
    expect(db.isModuleEnabled("guild-mod", "economy")).toBe(false);

    db.updateGuildModule("guild-mod", "economy", true);
    expect(db.isModuleEnabled("guild-mod", "economy")).toBe(true);
  });
});

describe("database.js — blacklist", () => {
  it("isBlacklisted is false for an unknown user", () => {
    expect(db.isBlacklisted("999000000000000000")).toBe(false);
  });

  it("isBlacklisted is true after inserting via globals", () => {
    db.updateGlobal("blacklist", [
      { userId: "777000000000000000", reason: "spam" },
    ]);
    expect(db.isBlacklisted("777000000000000000")).toBe(true);
    expect(db.isBlacklisted("000000000000000111")).toBe(false);
  });
});

describe("database.js — mute presets CRUD", () => {
  const G = "guild-mute";

  it("starts empty", () => {
    expect(db.getMutePresets(G)).toEqual([]);
  });

  it("addMutePreset + getMutePreset round-trips", () => {
    db.addMutePreset(G, "short", 60, "Spam léger");
    const p = db.getMutePreset(G, "short");
    expect(p).toBeTruthy();
    expect(p.name).toBe("short");
    expect(p.durationSeconds).toBe(60);
    expect(p.reason).toBe("Spam léger");
  });

  it("addMutePreset upserts on conflict (same name)", () => {
    db.addMutePreset(G, "short", 120, "Updated");
    const p = db.getMutePreset(G, "short");
    expect(p.durationSeconds).toBe(120);
    expect(p.reason).toBe("Updated");
  });

  it("delMutePreset returns true when deleting, false otherwise", () => {
    expect(db.delMutePreset(G, "short")).toBe(true);
    expect(db.getMutePreset(G, "short")).toBeFalsy();
    expect(db.delMutePreset(G, "short")).toBe(false);
  });
});
