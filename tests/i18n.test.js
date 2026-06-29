// Smoke tests for core/utils/i18n.js
// Verifies key resolution, fr/en fallback chain, and unknown-key passthrough.

// describe/it/expect come from vitest globals (see vitest.config.js)
const { t } = require("../core/utils/i18n");

describe("i18n.t — happy path", () => {
  it("resolves a nested key in fr", () => {
    expect(t("fr", "commands.setlang.success")).toBe(
      "La langue du serveur a été définie sur **Français**.",
    );
  });

  it("resolves the same key in en", () => {
    expect(t("en", "commands.setlang.success")).toBe(
      "The server language has been set to **English**.",
    );
  });
});

describe("i18n.t — fallback chain", () => {
  it("falls back to fr when requested locale is missing", () => {
    // "xx" does not exist; chain is xx -> fr -> en
    expect(t("xx", "commands.setlang.success")).toBe(
      "La langue du serveur a été définie sur **Français**.",
    );
  });

  it("returns the raw key when nothing matches", () => {
    expect(t("fr", "this.key.absolutely.does.not.exist")).toBe(
      "this.key.absolutely.does.not.exist",
    );
  });
});

describe("i18n.t — variable interpolation", () => {
  it("substitutes {{var}} placeholders", () => {
    const out = t("fr", "commands.clear.success", { count: 3, target: "" });
    expect(out).toContain("**3**");
  });
});
