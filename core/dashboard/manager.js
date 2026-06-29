const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const jwt = require("jsonwebtoken");
const path = require("path");
const fs = require("fs");
const Logger = require("../utils/logger.js");
const { t } = require("../utils/i18n");
const { PermissionsBitField } = require("discord.js");

/**
 * Initialise le serveur Express et le connecte au client Discord
 * @param {import('discord.js').Client} client - L'instance de votre bot Discord
 */
function initDashboard(client) {
  const app = express();
  app.set("trust proxy", 1);

  // Correlation ID — attach a short random reqId to every request so we can
  // tie logs to user-reported bugs. Must run before anything that may log/error.
  app.use((req, res, next) => {
    req.reqId = Math.random().toString(36).slice(2, 10);
    res.setHeader("X-Request-Id", req.reqId);
    next();
  });

  // Security headers
  app.use((req, res, next) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "DENY");
    res.setHeader("X-XSS-Protection", "1; mode=block");
    res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
    res.setHeader("Permissions-Policy", "geolocation=(), microphone=()");
    next();
  });

  const port = process.env.PORT || 3000;
  Logger.info(`[DASHBOARD] Initialisation du dashboard sur le port ${port}...`);

  // --- HELPERS ---
  const logDashboardAction = (guildId, userId, username, action, details) => {
    try {
      client.db.db
        .prepare(
          `
 INSERT INTO dashboard_audit_logs (guildId, userId, username, action, details)
 VALUES (?, ?, ?, ?, ?)
 `,
        )
        .run(guildId, userId, username, action, JSON.stringify(details));
    } catch (e) {
      Logger.error("[DASHBOARD AUDIT LOG ERROR]", e);
    }
  };

  const logAccess = (userId, username, req, status) => {
    try {
      let ip =
        req.headers["x-forwarded-for"] || req.socket.remoteAddress || "Unknown";
      if (typeof ip === "string") {
        ip = ip.split(",")[0].trim();
        if (ip.startsWith("::ffff:")) ip = ip.substring(7);
      }
      const userAgent = req.headers["user-agent"];
      client.db.db
        .prepare(
          `
 INSERT INTO dashboard_access_logs (userId, username, ip, userAgent, status)
 VALUES (?, ?, ?, ?, ?)
 `,
        )
        .run(userId, username, ip, userAgent, status);
    } catch (e) {
      Logger.error("[DASHBOARD ACCESS LOG ERROR]", e);
    }
  };

  // --- CONFIGURATION ---
  const DEFAULT_MODULES = [
    "welcome",
    "moderation",
    "vocal_stats",
    "economy",
    "casino",
    "music",
    "fun",
    "tickets",
    "levels",
    "logs",
    "antiraid",
    "joinping",
  ];

  // --- MIDDLEWARES ---

  app.use(
    cors({
      origin: function (origin, callback) {
        const dashboardUrl = (
          process.env.DASHBOARD_URL || "http://localhost:5173"
        ).replace(/\/$/, "");
        const allowed = [
          dashboardUrl,
          "https://dashboard.webtvmedia.net",
          "http://localhost:5173",
          "http://localhost:5174",
          "http://localhost:5175",
          "http://localhost:3000",
          "http://localhost:3001",
          "http://localhost:3002",
          "http://localhost:3003",
          "http://localhost:3004",
          "http://localhost:3005",
        ];

        if (!origin || allowed.includes(origin.replace(/\/$/, ""))) {
          callback(null, true);
        } else {
          Logger.warn(
            `[DASHBOARD] CORS blocked request from origin: ${origin}`,
          );
          callback(new Error("Non autorisé par CORS"));
        }
      },
      credentials: true,
    }),
  );
  app.use(express.json());
  app.use(cookieParser());

  // Langue d'affichage du dashboard — envoyée par le frontend via l'en-tête
  // X-Dashboard-Lang (localStorage "dashboard_lang"). Sert à localiser les
  // messages d'erreur renvoyés par l'API (t(req.lang, "dashboard.*")).
  app.use((req, res, next) => {
    req.lang = req.headers["x-dashboard-lang"] === "en" ? "en" : "fr";
    next();
  });

  // --- OPERATIONAL PROBES ---
  // Mounted BEFORE auth, rate-limiters, and static serving so that
  // orchestrators (Docker/k8s/uptime monitors) never get 401/429 on probes.
  // Exposes only non-sensitive operational data.
  app.use("/", require("./routes/health")(client));

  // Global API Rate Limiter
  const rateLimit = require("express-rate-limit");

  // Compute Retry-After seconds from the limiter context and emit a uniform
  // JSON payload along with the standard RateLimit-* / Retry-After headers.
  const buildRateLimitHandler = (windowMs) => (req, res /*, next, options */) => {
    const resetTime = req.rateLimit && req.rateLimit.resetTime;
    let retryAfter;
    if (resetTime instanceof Date) {
      retryAfter = Math.max(1, Math.ceil((resetTime.getTime() - Date.now()) / 1000));
    } else {
      retryAfter = Math.ceil(windowMs / 1000);
    }
    // Ensure Retry-After header is always present (express-rate-limit sets it
    // when standardHeaders is true, but we re-assert for safety).
    res.setHeader("Retry-After", String(retryAfter));
    res.status(429).json({
      error: t(req.lang, "dashboard.manager.too_many_requests", {
        retryAfter,
      }),
      retryAfter,
    });
  };

  const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 500, // Limit each IP to 500 requests per windowMs
    standardHeaders: true,
    legacyHeaders: false,
    handler: buildRateLimitHandler(15 * 60 * 1000),
  });

  // Stricter limiter for sensitive admin/write routes
  const adminWriteLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 60,
    standardHeaders: true,
    legacyHeaders: false,
    handler: buildRateLimitHandler(15 * 60 * 1000),
  });

  // Tight limiter for destructive endpoints (mass-edit/reset/delete)
  const destructiveLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
    handler: buildRateLimitHandler(15 * 60 * 1000),
  });

  app.use("/api", apiLimiter);
  app.use("/api/bot/control", adminWriteLimiter);
  app.use("/api/bot/owners", adminWriteLimiter);
  app.use("/api/system", adminWriteLimiter);
  // Destructive scopes: economy reset/edit, level edit, badwords/shop/levels deletes
  app.use("/api/guilds/:guildId/economy/:userId", destructiveLimiter);
  app.use("/api/guilds/:guildId/levels/:userId", destructiveLimiter);
  app.use("/api/guilds/:guildId/badwords", destructiveLimiter);
  app.use("/api/guilds/:guildId/economy/shop", destructiveLimiter);
  app.use("/api/guilds/:guildId/levels/roles", destructiveLimiter);
  app.use("/api/system/speedphrases", destructiveLimiter);

  const dashboardDistPath = path.join(__dirname, "../../dashboard-client/dist");
  if (fs.existsSync(dashboardDistPath)) {
    app.use(express.static(dashboardDistPath));
  }

  app.get("/", (req, res) => {
    if (fs.existsSync(dashboardDistPath)) {
      res.sendFile(path.join(dashboardDistPath, "index.html"));
    } else {
      res.redirect(process.env.DASHBOARD_URL || "http://localhost:5173");
    }
  });

  const requireAuth = (req, res, next) => {
    const token = req.cookies.token;
    if (!token) {
      return res
        .status(401)
        .json({ error: t(req.lang, "dashboard.manager.not_authenticated") });
    }

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      req.user = decoded;
      next();
    } catch (error) {
      return res
        .status(401)
        .json({ error: t(req.lang, "dashboard.manager.session_invalid") });
    }
  };

  const requireGuildAdmin = async (req, res, next) => {
    const { guildId } = req.params;

    // Bypass all checks for owners and speedphrase users
    const owners = process.env.OWNER_ID
      ? process.env.OWNER_ID.split(",").map((id) => id.trim())
      : [];
    const isBotOwner = client.db.db
      .prepare("SELECT * FROM bot_owners WHERE userId = ?")
      .get(req.user.id);

    if (req.user.isSpeedPhrase || owners.includes(req.user.id) || isBotOwner) {
      const guild = client.guilds.cache.get(guildId);
      if (!guild)
        return res
          .status(404)
          .json({ error: "Le bot n'est pas sur ce serveur" });
      req.guild = guild;
      return next();
    }

    // For other users, check if they are Server Administrator
    const guild = client.guilds.cache.get(guildId);
    if (!guild)
      return res.status(404).json({ error: "Le bot n'est pas sur ce serveur" });

    try {
      const member = await guild.members.fetch(req.user.id);
      if (
        member.permissions.has(PermissionsBitField.Flags.Administrator) ||
        member.id === guild.ownerId
      ) {
        req.guild = guild;
        next();
      } else {
        return res.status(403).json({
          error: t(req.lang, "dashboard.manager.must_be_admin"),
        });
      }
    } catch (error) {
      return res
        .status(403)
        .json({ error: t(req.lang, "dashboard.manager.must_be_member_admin") });
    }
  };

  const requireGlobalOwner = (req, res, next) => {
    const owners = process.env.OWNER_ID
      ? process.env.OWNER_ID.split(",").map((id) => id.trim())
      : [];
    const isPrimaryOwner = owners.includes(req.user.id);

    const isSecondaryOwner = client.db.db
      .prepare("SELECT * FROM bot_owners WHERE userId = ?")
      .get(req.user.id);

    if (!isPrimaryOwner && !isSecondaryOwner && !req.user.isSpeedPhrase) {
      return res
        .status(403)
        .json({ error: t(req.lang, "dashboard.manager.owner_only") });
    }
    next();
  };

  // --- RECENT ERRORS RING BUFFER ---
  // Bounded FIFO buffer (max 100) holding recent 5xx errors from dashboard
  // routes. Consumed by owner-only GET /api/system/errors for debugging.
  const recentErrors = [];
  const MAX_RECENT_ERRORS = 100;

  function pushRecentError(req, err) {
    try {
      const entry = {
        reqId: req && req.reqId,
        timestamp: new Date().toISOString(),
        method: req && req.method,
        path: req && (req.originalUrl || req.url),
        userId: (req && req.user && req.user.id) || null,
        error: {
          name: (err && err.name) || "Error",
          message: (err && err.message) || String(err),
          stack: (err && err.stack) || null,
        },
      };
      recentErrors.push(entry);
      if (recentErrors.length > MAX_RECENT_ERRORS) {
        recentErrors.splice(0, recentErrors.length - MAX_RECENT_ERRORS);
      }
    } catch (_e) {
      // Never let error-capture itself break the response cycle.
    }
  }

  // --- BOT CONTROLS & LOGS INTERCEPTION ---
  const logBuffer = [];
  const MAX_LOGS = 100;

  const originalLog = console.log;
  const originalInfo = console.info;
  const originalError = console.error;
  const originalWarn = console.warn;

  function addToBuffer(type, args) {
    const msg = args
      .map((arg) => {
        if (typeof arg === "object") {
          try {
            return JSON.stringify(arg);
          } catch (e) {
            return "[Object]";
          }
        }
        return arg;
      })
      .join("");
    const logEntry = `[${new Date().toISOString().split("T")[1].split(".")[0]}] [${type}] ${msg}`;
    logBuffer.push(logEntry);
    if (logBuffer.length > MAX_LOGS) logBuffer.shift();
  }

  console.log = (...args) => {
    addToBuffer("INFO", args);
    originalLog(...args);
  };
  console.info = (...args) => {
    addToBuffer("INFO", args);
    originalInfo(...args);
  };
  console.error = (...args) => {
    addToBuffer("ERROR", args);
    originalError(...args);
  };
  console.warn = (...args) => {
    addToBuffer("WARN", args);
    originalWarn(...args);
  };

  // --- FACTORY OBJECTS ---
  const middlewares = { requireAuth, requireGuildAdmin, requireGlobalOwner };
  const helpers = {
    logDashboardAction,
    logAccess,
    DEFAULT_MODULES,
    logBuffer,
    recentErrors,
    pushRecentError,
    MAX_RECENT_ERRORS,
  };

  // --- MOUNT ROUTERS ---
  app.use("/api/auth", require("./routes/auth")(client, middlewares, helpers));
  app.use("/api/user", require("./routes/user")(client, middlewares, helpers));
  app.use(
    "/api/guilds",
    require("./routes/guilds")(client, middlewares, helpers),
  );
  app.use(
    "/api/guilds",
    require("./routes/economy")(client, middlewares, helpers),
  );
  app.use(
    "/api/guilds",
    require("./routes/casino")(client, middlewares, helpers),
  );
  app.use(
    "/api/guilds",
    require("./routes/levels")(client, middlewares, helpers),
  );
  app.use(
    "/api/guilds",
    require("./routes/tickets")(client, middlewares, helpers),
  );
  app.use(
    "/api/guilds",
    require("./routes/antiraid")(client, middlewares, helpers),
  );
  app.use(
    "/api/system",
    require("./routes/system")(client, middlewares, helpers),
  );
  app.use("/api", require("./routes/misc")(client, middlewares, helpers));
  app.use("/api", require("./routes/bot")(client, middlewares, helpers));

  app.use((req, res) => {
    if (req.path.startsWith("/api")) {
      return res
        .status(404)
        .json({ error: t(req.lang, "dashboard.manager.api_not_found") });
    }

    if (fs.existsSync(dashboardDistPath)) {
      res.sendFile(path.join(dashboardDistPath, "index.html"));
    } else {
      res.status(404).json({
        error:
          "Fichiers du dashboard introuvables. Veuillez compiler le dashboard-client.",
      });
    }
  });

  // Global error handler (Express recognises 4-arg signature). Captures any
  // error bubbled from route handlers; records 5xx in the recentErrors ring
  // buffer and returns a sanitised JSON payload (no stack to non-owners).
  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    const status =
      typeof err.status === "number" && err.status >= 400 && err.status < 600
        ? err.status
        : 500;

    if (status >= 500) {
      pushRecentError(req, err);
      Logger.error(
        `[DASHBOARD ERROR] reqId=${req.reqId} ${req.method} ${req.originalUrl || req.url}`,
        err,
      );
    }

    if (res.headersSent) {
      return next(err);
    }

    res.status(status).json({
      error:
        status >= 500
          ? "Erreur interne du serveur"
          : err.message || t(req.lang, "dashboard.manager.invalid_request"),
      reqId: req.reqId,
    });
  });

  const server = app
    .listen(port, "0.0.0.0", () => {
      Logger.info(`[DASHBOARD] API démarrée sur le port ${port}`);
    })
    .on("error", (err) => {
      if (err.code === "EADDRINUSE") {
        Logger.error(
          `[DASHBOARD] Le port ${port} est déjà utilisé. Impossible de démarrer.`,
        );
      } else {
        Logger.error(`[DASHBOARD] Erreur lors du démarrage: ${err.message}`);
      }
    });

  return server;
}

module.exports = { initDashboard };
