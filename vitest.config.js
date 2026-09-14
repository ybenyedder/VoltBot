// Minimal vitest config for the bot (Node) test suite.
// NB : le dashboard-client n'a PAS de fichier vitest.config.js dédié — sa
// suite de tests (src/__tests__/*.test.jsx) est pilotée par le bloc `test`
// défini dans dashboard-client/vite.config.js, via son propre `npm test`.
const path = require("path");
const { defineConfig } = require("vitest/config");

module.exports = defineConfig({
  test: {
    include: ["tests/**/*.test.js"],
    exclude: ["node_modules/**", "dashboard-client/**"],
    environment: "node",
    globals: true, // describe/it/expect deviennent des globaux → tests en CJS
    setupFiles: [path.join(__dirname, "tests/setup.js")],
    testTimeout: 10000,
    // better-sqlite3 + module-scoped DB ⇒ un seul fork partagé entre fichiers
    // (syntaxe poolOptions, l'option top-level `forks` n'existe qu'en Vitest 4 ;
    // la version installée ici est Vitest 3).
    pool: "forks",
    poolOptions: {
      forks: { singleFork: true },
    },
    reporters: ["default"],
  },
});
