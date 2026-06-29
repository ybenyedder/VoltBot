// Minimal vitest config for the bot (Node) test suite.
// dashboard-client has its own vitest config (see dashboard-client/vitest.config.js).
const path = require("path");
const { defineConfig } = require("vitest/config");

module.exports = defineConfig({
  test: {
    include: ["tests/**/*.test.js"],
    exclude: ["node_modules/**", "dashboard-client/**"],
    environment: "node",
    globals: true, // describe/it/expect become globals → test files stay CJS-friendly
    setupFiles: [path.join(__dirname, "tests/setup.js")],
    testTimeout: 10000,
    // better-sqlite3 + module-scoped DB ⇒ isolate per worker
    pool: "forks",
    forks: { singleFork: true }, // Vitest 4: pool opts are top-level
    reporters: ["default"],
  },
});
