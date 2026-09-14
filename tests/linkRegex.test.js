// Tests for core/events/handlers/linkRegex.js — la regex de détection de
// liens partagée entre l'automod (messageCreate) et messageUpdate.
// Détection : domaines nus (example.com), URLs complètes (https://x.y/z),
// sous-domaines, insensibilité à la casse. Capacité réelle documentée :
// l'alternative large `[a-zA-Z0-9-]+\.[a-z]{2,}` matche aussi les noms de
// fichiers comme « readme.txt » (choix assumé de l'automod strict).
// La factory évite la fuite d'état `lastIndex` entre deux `.test()`.

const {
  createLinkRegex,
  LINK_REGEX_SOURCE,
} = require("../core/events/handlers/linkRegex");

const matches = (text) => createLinkRegex().test(text);

describe("linkRegex — factory & source", () => {
  it("exposes the shared regex source and a /gi RegExp factory", () => {
    expect(typeof LINK_REGEX_SOURCE).toBe("string");
    expect(LINK_REGEX_SOURCE.length).toBeGreaterThan(0);

    const re = createLinkRegex();
    expect(re).toBeInstanceOf(RegExp);
    expect(re.flags).toContain("g");
    expect(re.flags).toContain("i");
    expect(re.lastIndex).toBe(0);
  });

  it("returns a fresh independent instance on each call", () => {
    expect(createLinkRegex()).not.toBe(createLinkRegex());
  });
});

describe("linkRegex — détection", () => {
  it("detects bare domains (example.com)", () => {
    expect(matches("go to example.com now")).toBe(true);
    expect(matches("example.com")).toBe(true);
  });

  it("detects full http(s) URLs (https://x.y/z)", () => {
    expect(matches("see https://x.y/z for details")).toBe(true);
    expect(matches("http://a.b/c?d=e&f=g")).toBe(true);
    expect(matches("visitez https://discord.gg/mon-serveur")).toBe(true);
  });

  it("detects subdomains", () => {
    expect(matches("hosted on sub.example.com")).toBe(true);
    expect(matches("https://cdn.static.example.org/img.png")).toBe(true);
  });

  it("detects shortened bit.ly links", () => {
    expect(matches("check bit.ly/3xYz9")).toBe(true);
  });

  it("is case-insensitive", () => {
    expect(matches("HTTPS://EXAMPLE.COM/PATH")).toBe(true);
    expect(matches("Mail moi sur MOI.Example.FR")).toBe(true);
  });

  it("does not flag plain text without links", () => {
    expect(matches("hello world")).toBe(false);
    expect(matches("aucun point ici")).toBe(false);
    expect(matches("")).toBe(false);
  });

  it("matches bare filenames like readme.txt (comportement actuel assumé)", () => {
    // Capacité réelle de la regex : l'alternative domaine est volontairement
    // large (elle ne connaît pas la liste des TLDs), donc « readme.txt » est
    // détecté comme un lien potentiel. Mieux vaut sur-filtrer qu'être
    // contournable — on verrouille ce comportement pour détecter toute
    // régression involontaire.
    expect(matches("see readme.txt")).toBe(true);
  });
});

describe("linkRegex — pas de fuite d'état lastIndex", () => {
  const text = "check https://x.y/z twice";

  it("a reused /g regex would flip results (why the factory exists)", () => {
    const reused = createLinkRegex();
    expect(reused.test(text)).toBe(true); // 1er test : match, lastIndex avance
    expect(reused.test(text)).toBe(false); // 2e test sur la même instance : piège /g
    expect(reused.lastIndex).toBe(0); // reset après échec, mais le coup est passé
  });

  it("consecutive .test() via fresh instances always match", () => {
    // Chaque createLinkRegex() repart de lastIndex = 0 : deux .test()
    // consécutifs sur le même texte renvoient systématiquement true.
    expect(createLinkRegex().test(text)).toBe(true);
    expect(createLinkRegex().test(text)).toBe(true);
    expect(createLinkRegex().test(text)).toBe(true);
  });
});
