const { spawn } = require("child_process");
const path = require("path");
const fs = require("fs");
const express = require("express");
const { createProxyMiddleware } = require("http-proxy-middleware");
const dotenv = require("dotenv");

let logger = null;
try {
  logger = require("./core/utils/logger");
} catch (e) {
  logger = null;
}

const BOTS_DIR = path.join(__dirname, "bots", "instances");
const CORE_DIR = path.join(__dirname, "core");
const DASHBOARD_DIST = path.join(__dirname, "dashboard-client", "dist");

if (!fs.existsSync(BOTS_DIR)) {
  fs.mkdirSync(BOTS_DIR, { recursive: true });
}

process.on("uncaughtException", (err) => {
  if (logger && typeof logger.error === "function") {
    logger.error(
      `[ORCHESTRATOR] uncaughtException: ${err && err.message}`,
      err,
    );
  } else {
    console.error("[ORCHESTRATOR] uncaughtException:", err);
  }
});

process.on("unhandledRejection", (reason) => {
  if (logger && typeof logger.error === "function") {
    logger.error(
      `[ORCHESTRATOR] unhandledRejection: ${reason && reason.message ? reason.message : reason}`,
      reason,
    );
  } else {
    console.error("[ORCHESTRATOR] unhandledRejection:", reason);
  }
});

let isStopping = false;
const children = new Map(); // botName -> process
const botRegistry = new Map(); // accessId -> { name, port, data }

function getBotConfig(botName) {
  const envPath = path.join(BOTS_DIR, botName, ".env");
  if (!fs.existsSync(envPath)) return null;

  const content = fs.readFileSync(envPath, "utf8");
  const config = dotenv.parse(content);
  return {
    accessId: config.BOT_ACCESS_ID,
    port: parseInt(config.PORT || "3000"),
    name: botName,
    _raw: config,
  };
}

// Required env vars per bot instance. If any missing, the orchestrator
// refuses to spawn (avoids the 5s restart loop on a broken .env).
const REQUIRED_BOT_ENV = [
  "DISCORD_TOKEN",
  "OWNER_ID",
  "BOT_ACCESS_ID",
  "DISCORD_CLIENT_ID",
  "DISCORD_CLIENT_SECRET",
  "JWT_SECRET",
];

function validateBotEnv(botName) {
  const envPath = path.join(BOTS_DIR, botName, ".env");
  if (!fs.existsSync(envPath)) {
    return { ok: false, missing: ["<.env file>"], envPath };
  }
  const config = dotenv.parse(fs.readFileSync(envPath, "utf8"));
  const missing = REQUIRED_BOT_ENV.filter(
    (k) => !config[k] || String(config[k]).trim() === "",
  );
  return { ok: missing.length === 0, missing, envPath };
}

function startBot(botName) {
  if (isStopping) return;

  // Prevent path traversal attacks
  if (
    typeof botName !== "string" ||
    botName.includes("/") ||
    botName.includes("\\") ||
    botName === ".." ||
    botName === "."
  ) {
    console.error(`[ORCHESTRATOR] Error: Invalid bot name "${botName}".`);
    return;
  }

  const botPath = path.resolve(BOTS_DIR, botName);
  if (!fs.existsSync(botPath)) {
    console.error(`[ORCHESTRATOR] Error: Bot directory ${botPath} not found.`);
    return;
  }

  const validation = validateBotEnv(botName);
  if (!validation.ok) {
    console.error(
      `[ORCHESTRATOR] [FATAL] Skipping bot "${botName}": missing required env vars: ${validation.missing.join(", ")} (file: ${validation.envPath}). See .env.example.`,
    );
    return;
  }

  const config = getBotConfig(botName);
  if (config && config.accessId) {
    botRegistry.set(config.accessId, { ...config, status: "starting" });
  }

  console.log(
    `[ORCHESTRATOR] Starting bot: ${botName} (Port: ${config?.port || "?"})...`,
  );

  const botProcess = spawn(
    process.execPath,
    [path.join(CORE_DIR, "index.js")],
    {
      cwd: __dirname,
      stdio: "inherit",
      env: {
        ...process.env,
        BOT_INSTANCE_NAME: botName,
        BOT_INSTANCE_CWD: botPath,
      },
    },
  );

  children.set(botName, botProcess);

  botProcess.on("close", (code) => {
    console.log(`[ORCHESTRATOR] Bot ${botName} exited with code ${code}`);
    children.delete(botName);

    const lockFile = path.join(botPath, ".bot.lock");
    if (fs.existsSync(lockFile)) {
      try {
        fs.unlinkSync(lockFile);
      } catch (e) {}
    }

    if (!isStopping) {
      console.log(`[ORCHESTRATOR] Restarting bot ${botName} in 5 seconds...`);
      setTimeout(() => startBot(botName), 5000);
    }
  });
}

const app = express();
app.set("trust proxy", 1);
const GATEWAY_PORT = 3000;

app.get("/api/identify", (req, res) => {
  const bots = Array.from(botRegistry.values()).map((b) => ({
    accessId: b.accessId,
    botName: b.name,
    port: b.port,
    isGateway: true,
  }));
  res.json(bots);
});

const botProxies = new Map(); // port -> middleware

function getOrCreateBotProxy(port) {
  if (botProxies.has(port)) return botProxies.get(port);

  const proxy = createProxyMiddleware({
    target: `http://127.0.0.1:${port}`,
    changeOrigin: true,
    logger: console,
    pathRewrite: (path, req) => {
      const cleanPath = path.replace(/^\/\d+/, "");
      return "/api" + (cleanPath.startsWith("/") ? cleanPath : "/" + cleanPath);
    },
    on: {
      proxyReq: (proxyReq, req) => {
        console.log(
          `[GATEWAY] Proxy ${req.method} ${req.originalUrl} -> http://127.0.0.1:${port}${proxyReq.path}`,
        );
      },
      error: (err, req, res) => {
        if (res.headersSent) return;
        console.error(`[GATEWAY] Proxy Error (${port}):`, err.message);
        res
          .status(504)
          .json({ error: "Bot unreachable", details: err.message });
      },
    },
  });

  botProxies.set(port, proxy);
  return proxy;
}

const ALLOWED_BOT_PORTS = new Set([3001, 3002, 3003, 3004, 3005]);

app.use("/api/bot/:port", (req, res, next) => {
  const port = parseInt(req.params.port);
  if (isNaN(port) || !ALLOWED_BOT_PORTS.has(port)) {
    return res.status(403).json({ error: "Port non autorisé" });
  }
  const proxy = getOrCreateBotProxy(port);
  return proxy(req, res, next);
});

if (fs.existsSync(DASHBOARD_DIST)) {
  app.use(express.static(DASHBOARD_DIST));
  app.use((req, res) => {
    if (req.path.startsWith("/api")) {
      return res.status(404).json({ error: "Endpoint non trouvé" });
    }
    res.sendFile(path.join(DASHBOARD_DIST, "index.html"));
  });
}

const gatewayServer = app.listen(GATEWAY_PORT, () => {
  console.log(`[ORCHESTRATOR] Gateway started on port ${GATEWAY_PORT}`);
  console.log(
    `[ORCHESTRATOR] Access the dashboard at http://localhost:${GATEWAY_PORT}`,
  );
});

const shutdownOrchestrator = (signal) => {
  if (isStopping) return;
  isStopping = true;
  console.log(`\n[ORCHESTRATOR] Signal ${signal} reçu, stopping all bots...`);
  // Send SIGTERM so children run their graceful shutdown handler
  children.forEach((child, botName) => {
    try {
      child.kill("SIGTERM");
    } catch (e) {}
    const botPath = path.resolve(BOTS_DIR, botName);
    const lockFile = path.join(botPath, ".bot.lock");
    if (fs.existsSync(lockFile)) {
      try {
        fs.unlinkSync(lockFile);
      } catch (e) {}
    }
  });
  try {
    gatewayServer.close();
  } catch (e) {}
  // Give children up to 4s to exit cleanly, then force kill + exit
  setTimeout(() => {
    children.forEach((child) => {
      try {
        child.kill("SIGKILL");
      } catch (e) {}
    });
    process.exit(0);
  }, 4000).unref();
};

process.on("SIGINT", () => shutdownOrchestrator("SIGINT"));
process.on("SIGTERM", () => shutdownOrchestrator("SIGTERM"));

const botFolders = fs
  .readdirSync(BOTS_DIR)
  .filter((f) => fs.statSync(path.join(BOTS_DIR, f)).isDirectory());
if (botFolders.length === 0) {
  console.log("[ORCHESTRATOR] No bot instances found in bots/instances/.");
} else {
  botFolders.forEach((botName, index) => {
    setTimeout(() => startBot(botName), index * 2500);
  });
}
