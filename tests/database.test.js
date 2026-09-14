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

describe("database.js — economy helpers", () => {
  const G = "guild-econ";

  it("getUser(field) returns falsy field values (coins=0 → 0), not the row", () => {
    const coins = db.getUser("user-econ-a", G, "coins");
    expect(coins).toBe(0); // valeur du champ, même falsy — pas la ligne entière
    expect(coins).not.toBeInstanceOf(Object);

    const row = db.getUser("user-econ-a", G);
    expect(row).toBeInstanceOf(Object); // sans champ : la ligne complète
    expect(row.coins).toBe(0);
  });

  it("addCoins credits the balance and returns the updated user", () => {
    db.getUser("user-econ-b", G); // addCoins ne crée pas la ligne : caller la garantit
    const u = db.addCoins("user-econ-b", G, 150);
    expect(u.coins).toBe(150);
    expect(db.getUser("user-econ-b", G, "coins")).toBe(150);
  });

  it("addCoins rejects NaN/Infinity (returns false, balance untouched)", () => {
    db.getUser("user-econ-c", G);
    db.addCoins("user-econ-c", G, 100);
    expect(db.addCoins("user-econ-c", G, NaN)).toBe(false);
    expect(db.addCoins("user-econ-c", G, Infinity)).toBe(false);
    expect(db.getUser("user-econ-c", G, "coins")).toBe(100); // solde inchangé
  });

  it("addCoins clamps negative amounts to 0 (balance untouched)", () => {
    db.getUser("user-econ-d", G);
    db.addCoins("user-econ-d", G, 100);
    const u = db.addCoins("user-econ-d", G, -50);
    expect(db.getUser("user-econ-d", G, "coins")).toBe(100); // solde inchangé
    expect(u.coins).toBe(100);
  });

  it("removeCoins clamps the balance at 0", () => {
    db.getUser("user-econ-e", G);
    db.addCoins("user-econ-e", G, 30);
    expect(db.removeCoins("user-econ-e", G, 100).coins).toBe(0); // 30-100 → 0
    db.addCoins("user-econ-e", G, 10); // 0 + 10
    expect(db.removeCoins("user-econ-e", G, 4).coins).toBe(6); // débit normal
  });

  it("addItem upserts: two adds of the same item → one row, amount summed", () => {
    db.addItem("user-econ-f", G, "sword", 3);
    db.addItem("user-econ-f", G, "sword", 2);

    let inv = db.getInventory("user-econ-f", G);
    expect(inv.length).toBe(1); // une seule ligne grâce à l'upsert
    expect(inv[0].item).toBe("sword");
    expect(inv[0].amount).toBe(5); // 3 + 2 cumulés

    db.addItem("user-econ-f", G, "shield", 1); // un autre item → 2e ligne
    inv = db.getInventory("user-econ-f", G);
    expect(inv.length).toBe(2);
  });

  it("tryClaimDaily: 1st claim true, immediate 2nd false, true after cooldown expiry", () => {
    vi.useFakeTimers();
    try {
      const day = 24 * 60 * 60 * 1000;
      const U = "user-econ-g";
      vi.setSystemTime(new Date("2026-01-01T00:00:00.000Z").getTime());
      db.getUser(U, G); // garantit la ligne (dailyTimestamp DEFAULT 0 → claimable)

      expect(db.tryClaimDaily(U, G, day)).toBe(true); // 1er claim accordé
      expect(db.getUser(U, G, "dailyTimestamp")).toBe(
        new Date("2026-01-01T00:00:00.000Z").getTime(),
      );

      expect(db.tryClaimDaily(U, G, day)).toBe(false); // ré-claim immédiat refusé

      // Mi-chemin du cooldown : encore refusé
      vi.setSystemTime(new Date("2026-01-01T12:00:00.000Z").getTime());
      expect(db.tryClaimDaily(U, G, day)).toBe(false);

      // Cooldown expiré (+24h01) : accordé
      vi.setSystemTime(new Date("2026-01-02T00:00:01.000Z").getTime());
      expect(db.tryClaimDaily(U, G, day)).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });
});
