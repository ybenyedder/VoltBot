// Smoke tests for core/utils/permissions.js
// Covers isOwner / isPrimaryOwner / isAdmin / isWhitelisted happy paths.
// OWNER_ID is set by tests/setup.js to "111111111111111111".

// describe/it/expect come from vitest globals (see vitest.config.js)
const { PermissionsBitField, PermissionFlagsBits } = require("discord.js");
const perms = require("../core/utils/permissions");

const OWNER = "111111111111111111";
const RANDO = "222222222222222222";

const adminBits = new PermissionsBitField(
  PermissionFlagsBits.Administrator,
);
const emptyBits = new PermissionsBitField();

const mkMessage = (authorId, { permissions = emptyBits, guildOwnerId = "999" } = {}) => ({
  author: { id: authorId },
  guild: { id: "g1", ownerId: guildOwnerId },
  member: { permissions },
});

describe("permissions — isPrimaryOwner / isOwner", () => {
  it("isPrimaryOwner true for the env OWNER_ID", () => {
    expect(perms.isPrimaryOwner(OWNER)).toBe(true);
  });

  it("isPrimaryOwner false for anyone else", () => {
    expect(perms.isPrimaryOwner(RANDO)).toBe(false);
  });

  it("isOwner delegates to isPrimaryOwner via message.author.id", () => {
    expect(perms.isOwner(mkMessage(OWNER))).toBe(true);
    expect(perms.isOwner(mkMessage(RANDO))).toBe(false);
  });
});

describe("permissions — isAdmin", () => {
  const client = { db: { isBotOwner: () => false } };

  it("returns true for the bot owner regardless of guild perms", () => {
    expect(perms.isAdmin(mkMessage(OWNER), client)).toBe(true);
  });

  it("returns true when author is the guild owner", () => {
    const msg = mkMessage(RANDO, { guildOwnerId: RANDO });
    expect(perms.isAdmin(msg, client)).toBe(true);
  });

  it("returns true when member has Administrator permission", () => {
    expect(
      perms.isAdmin(mkMessage(RANDO, { permissions: adminBits }), client),
    ).toBe(true);
  });

  it("returns false for a regular member", () => {
    expect(perms.isAdmin(mkMessage(RANDO), client)).toBe(false);
  });
});

describe("permissions — isWhitelisted", () => {
  it("primary owner is always whitelisted", () => {
    expect(perms.isWhitelisted(OWNER, "g1", null)).toBe(true);
  });

  it("user listed in guildData.whitelist is whitelisted", () => {
    const guildSettings = { whitelist: JSON.stringify([RANDO]) };
    expect(
      perms.isWhitelisted(RANDO, "g1", null, guildSettings),
    ).toBe(true);
  });

  it("user listed in guildData.bypass is whitelisted", () => {
    const guildSettings = { bypass: [RANDO] };
    expect(
      perms.isWhitelisted(RANDO, "g1", null, guildSettings),
    ).toBe(true);
  });

  it("unknown user without guild data is not whitelisted", () => {
    expect(perms.isWhitelisted(RANDO, "g1", null)).toBe(false);
  });
});
