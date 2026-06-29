const express = require("express");

/**
 * Operational probes for orchestration (Docker / k8s / systemd / uptime monitors).
 *
 * IMPORTANT: This router MUST be mounted BEFORE auth middleware and before any
 * rate-limiters that would block probes. It exposes only non-sensitive
 * operational data (uptime, ready state, counts) — no tokens, IDs, or names.
 *
 *   GET /health   — liveness  (always 200 while the process is alive)
 *   GET /ready    — readiness (200 if Discord client is ready, else 503)
 *   GET /metrics  — Prometheus-style plaintext metrics
 */
module.exports = function (client) {
  const router = express.Router();

  // --- LIVENESS ---
  router.get("/health", (req, res) => {
    res.status(200).json({
      status: "ok",
      uptime: process.uptime(),
    });
  });

  // --- READINESS ---
  router.get("/ready", (req, res) => {
    const ready =
      client &&
      typeof client.isReady === "function" &&
      client.isReady();

    if (ready) {
      return res.status(200).json({ status: "ready" });
    }
    return res.status(503).json({ status: "starting" });
  });

  // --- METRICS (Prometheus text exposition format 0.0.4) ---
  router.get("/metrics", (req, res) => {
    let guildCount = 0;
    let userCount = 0;
    let commandCount = 0;

    try {
      if (client && client.guilds && client.guilds.cache) {
        guildCount = client.guilds.cache.size;
        userCount = client.guilds.cache.reduce(
          (acc, g) => acc + (g.memberCount || 0),
          0,
        );
      }
      if (client && client.commands && typeof client.commands.size === "number") {
        commandCount = client.commands.size;
      }
    } catch (_) {
      // metrics must never throw — degrade silently
    }

    const mem = process.memoryUsage().rss;
    const uptime = process.uptime();

    const lines = [
      "# HELP bot_guilds Number of guilds the bot is currently in.",
      "# TYPE bot_guilds gauge",
      `bot_guilds ${guildCount}`,
      "# HELP bot_users Approximate total member count across all guilds.",
      "# TYPE bot_users gauge",
      `bot_users ${userCount}`,
      "# HELP bot_uptime_seconds Process uptime in seconds.",
      "# TYPE bot_uptime_seconds counter",
      `bot_uptime_seconds ${uptime}`,
      "# HELP bot_memory_bytes Resident set size memory usage in bytes.",
      "# TYPE bot_memory_bytes gauge",
      `bot_memory_bytes ${mem}`,
      "# HELP bot_commands_loaded Number of loaded prefix commands.",
      "# TYPE bot_commands_loaded gauge",
      `bot_commands_loaded ${commandCount}`,
      "",
    ];

    res.setHeader("Content-Type", "text/plain; version=0.0.4; charset=utf-8");
    res.status(200).send(lines.join("\n"));
  });

  return router;
};
