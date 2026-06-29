// Vitest setup: runs BEFORE any test file imports `core/utils/database`.
// We redirect the bot's data dir to a per-run temp folder so the production
// `data/bot.db` is never touched, and we silence the in-process Logger to
// keep test output readable.

const fs = require("fs");
const os = require("os");
const path = require("path");

// 1. Sandbox DB location ---------------------------------------------------
//    database.js reads `process.env.BOT_INSTANCE_CWD || process.cwd()` and
//    creates `<cwd>/data/bot.db`. Pointing BOT_INSTANCE_CWD at a fresh tmp
//    dir gives every vitest run a clean SQLite file with no migration noise.
const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "zeroday-test-"));
fs.mkdirSync(path.join(tmpRoot, "data"), { recursive: true });
process.env.BOT_INSTANCE_CWD = tmpRoot;

// 2. Provide an OWNER_ID for permissions tests -----------------------------
process.env.OWNER_ID = process.env.OWNER_ID || "111111111111111111";

// 3. Silence the Logger ----------------------------------------------------
//    Logger.info etc. call console.log directly; muting console keeps the
//    vitest report clean while still letting console.error/warn surface in
//    case a test deliberately checks them.
const Logger = require("../core/utils/logger");
for (const lvl of ["success", "info", "warn", "error"]) {
  Logger[lvl] = () => {};
}

// 4. Cleanup tmp dir on process exit --------------------------------------
process.on("exit", () => {
  try {
    fs.rmSync(tmpRoot, { recursive: true, force: true });
  } catch (_) {
    /* ignore */
  }
});

// Expose for tests that want to know the sandbox path
globalThis.__TEST_TMP_ROOT__ = tmpRoot;
