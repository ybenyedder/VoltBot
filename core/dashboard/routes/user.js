const express = require("express");
const Logger = require("../../utils/logger.js");
const { t } = require("../../utils/i18n");

const guildCache = new Map(); // userId -> { guilds: [], timestamp: number }
const GUILD_CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const GUILD_CACHE_MAX = 5000; // hard cap to prevent unbounded growth

// Evict expired entries; if still over the cap, drop the oldest. Cheap O(n)
// pass run only when a new entry would push us over a threshold.
function pruneGuildCache(now) {
  for (const [uid, entry] of guildCache) {
    if (now - entry.timestamp > GUILD_CACHE_TTL) guildCache.delete(uid);
  }
  if (guildCache.size <= GUILD_CACHE_MAX) return;
  // Sort by timestamp asc and drop the oldest until back under cap.
  const entries = [...guildCache.entries()].sort(
    (a, b) => a[1].timestamp - b[1].timestamp,
  );
  const toRemove = guildCache.size - GUILD_CACHE_MAX;
  for (let i = 0; i < toRemove; i++) guildCache.delete(entries[i][0]);
}

module.exports = function (client, middlewares, helpers) {
  const router = express.Router();
  const { requireAuth } = middlewares;

  router.get("/guilds", requireAuth, async (req, res) => {
    if (req.user.isSpeedPhrase) {
      const adminGuilds = client.guilds.cache.map((guild) => ({
        id: guild.id,
        name: guild.name,
        icon: guild.icon
          ? `https://cdn.discordapp.com/icons/${guild.id}/${guild.icon}.png`
          : null,
        owner: true,
        botInstalled: true,
      }));
      return res.json(adminGuilds);
    }

    const accessToken = req.cookies.discord_access_token;
    const userId = req.user.id;

    if (!accessToken)
      return res.status(401).json({ error: "Token Discord manquant" });

    const cachedData = guildCache.get(userId);
    if (cachedData && Date.now() - cachedData.timestamp < GUILD_CACHE_TTL) {
      return res.json(cachedData.guilds);
    }

    try {
      const response = await fetch("https://discord.com/api/users/@me/guilds", {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      const userGuilds = await response.json();

      if (!Array.isArray(userGuilds)) {
        Logger.error(
          `[DASHBOARD GUILDS ERROR] reqId=${req.reqId} Discord API error:`,
          JSON.stringify(userGuilds),
        );

        if (response.status === 401) {
          res.clearCookie("token");
          res.clearCookie("discord_access_token");
        }

        if (cachedData) {
          Logger.warn(
            `[DASHBOARD CACHE] Erreur API, service du cache expiré pour ${userId}`,
          );
          return res.json(cachedData.guilds);
        }

        const safeStatus =
          response.status >= 400 && response.status < 600
            ? response.status
            : 502;
        const body = { error: "Erreur API Discord. Reconnecte-toi." };
        if (safeStatus >= 500) body.reqId = req.reqId;
        return res.status(safeStatus).json(body);
      }

      const ADMIN_FLAGS = 0x8 | 0x20;

      const filteredGuilds = userGuilds
        .filter(
          (guild) => (BigInt(guild.permissions) & BigInt(ADMIN_FLAGS)) !== 0n,
        )
        .map((guild) => ({
          id: guild.id,
          name: guild.name,
          icon: guild.icon
            ? `https://cdn.discordapp.com/icons/${guild.id}/${guild.icon}.png`
            : null,
          owner: guild.owner,
          botInstalled: client.guilds.cache.has(guild.id),
        }));

      const nowTs = Date.now();
      // Prune lazily when the cache grows; cheap and bounds memory.
      if (guildCache.size >= GUILD_CACHE_MAX) pruneGuildCache(nowTs);
      guildCache.set(userId, {
        guilds: filteredGuilds,
        timestamp: nowTs,
      });

      res.json(filteredGuilds);
    } catch (error) {
      Logger.error(`[DASHBOARD GUILDS ERROR] reqId=${req.reqId}`, error);

      if (cachedData) {
        return res.json(cachedData.guilds);
      }

      res.status(500).json({
        error: t(req.lang, "dashboard.user.guilds_fetch_error"),
        reqId: req.reqId,
      });
    }
  });

  return router;
};
