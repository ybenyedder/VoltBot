const express = require("express");
const Logger = require("../../utils/logger.js");
const { t } = require("../../utils/i18n");
const {
  invalidateGuildCache,
} = require("../../events/handlers/automodHandler");

module.exports = function (client, middlewares, helpers) {
  const router = express.Router();
  const { requireAuth, requireGuildAdmin } = middlewares;
  const { logDashboardAction } = helpers;

  router.get(
    "/:guildId/casino/settings",
    requireAuth,
    requireGuildAdmin,
    (req, res) => {
      try {
        const config = client.db.getGuild(req.params.guildId);
        let casinoConfig = JSON.parse(
          config.casinoConfig || '{"rewards":[],"settings":{}}',
        );
        if (Array.isArray(casinoConfig)) {
          casinoConfig = { rewards: casinoConfig, settings: {} };
        }
        res.json({ casinoConfig });
      } catch (error) {
        Logger.error(
          `[DASHBOARD CASINO SETTINGS GET ERROR] reqId=${req.reqId}`,
          error,
        );
        res.status(500).json({
          error: t(req.lang, "dashboard.casino.settings_fetch_error"),
          reqId: req.reqId,
        });
      }
    },
  );

  router.patch(
    "/:guildId/casino/settings",
    requireAuth,
    requireGuildAdmin,
    (req, res) => {
      const { casinoConfig } = req.body;
      if (!casinoConfig)
        return res
          .status(400)
          .json({ error: t(req.lang, "dashboard.casino.missing_data") });

      try {
        client.db.updateGuild(req.params.guildId, {
          casinoConfig: JSON.stringify(casinoConfig),
        });
        client.guildSettingsCache.delete(req.params.guildId);
        invalidateGuildCache(req.params.guildId);
        logDashboardAction(
          req.params.guildId,
          req.user.id,
          req.user.username,
          "UPDATE_CASINO_CONFIG",
          { casinoConfig },
        );
        res.json({ success: true });
      } catch (error) {
        Logger.error(
          `[DASHBOARD CASINO SETTINGS PATCH ERROR] reqId=${req.reqId}`,
          error,
        );
        res.status(500).json({
          error: "Erreur sauvegarde config casino",
          reqId: req.reqId,
        });
      }
    },
  );

  router.post(
    "/:guildId/casino/deploy",
    requireAuth,
    requireGuildAdmin,
    async (req, res) => {
      const { channelId } = req.body;
      // Reject non-snowflake input before issuing a guild.channels.fetch (which
      // would throw on arbitrary strings and return a generic 500).
      if (typeof channelId !== "string" || !/^\d{17,20}$/.test(channelId)) {
        return res.status(400).json({ error: "ID de salon invalide" });
      }

      try {
        const guild = await client.guilds.fetch(req.params.guildId);
        const channel = await guild.channels.fetch(channelId);
        if (!channel || !channel.isTextBased())
          return res.status(400).json({ error: "Salon invalide" });

        const shibuyaCommand = client.commands.get("shibuya");
        if (!shibuyaCommand)
          return res.status(500).json({
            error: "Commande shibuya introuvable",
            reqId: req.reqId,
          });

        const {
          getMainEmbed,
          getRow,
          getCasinoSettings,
        } = require("../../events/interactionHandlers/casinoHandlers");
        const { casinoConfig } = getCasinoSettings(client, guild.id);
        const s = casinoConfig.settings || {};

        const tr = (key, vars) => t(req.lang, key, vars);
        await channel.send({
          embeds: [getMainEmbed(guild, s, tr)],
          components: [getRow(s, tr)],
        });
        logDashboardAction(
          req.params.guildId,
          req.user.id,
          req.user.username,
          "CASINO_DEPLOY",
          { channelId },
        );
        res.json({ success: true });
      } catch (error) {
        Logger.error(`[CASINO DEPLOY ERROR] reqId=${req.reqId}`, error);
        res.status(500).json({
          error: t(req.lang, "dashboard.casino.deploy_error"),
          reqId: req.reqId,
        });
      }
    },
  );

  router.get(
    "/:guildId/casino/user/:userId",
    requireAuth,
    requireGuildAdmin,
    async (req, res) => {
      try {
        const user = client.db.getUser(req.params.userId, req.params.guildId);
        const inventory = client.db.getInventory(
          req.params.userId,
          req.params.guildId,
        );
        res.json({ user, inventory });
      } catch (error) {
        Logger.error(
          `[DASHBOARD CASINO USER GET ERROR] reqId=${req.reqId}`,
          error,
        );
        res.status(500).json({
          error: t(req.lang, "dashboard.casino.user_fetch_error"),
          reqId: req.reqId,
        });
      }
    },
  );

  router.patch(
    "/:guildId/casino/user/:userId/equip",
    requireAuth,
    requireGuildAdmin,
    (req, res) => {
      const { type, itemName } = req.body;
      if (!["color", "badge", "role", "success"].includes(type))
        return res.status(400).json({ error: "Type invalide" });
      if (
        itemName !== undefined &&
        itemName !== null &&
        typeof itemName !== "string"
      ) {
        return res.status(400).json({ error: "Nom d'article invalide" });
      }
      if (!/^\d{17,20}$/.test(req.params.userId)) {
        return res.status(400).json({ error: "ID utilisateur invalide" });
      }

      try {
        client.db.equipItem(
          req.params.userId,
          req.params.guildId,
          type,
          itemName,
        );
        logDashboardAction(
          req.params.guildId,
          req.user.id,
          req.user.username,
          "CASINO_USER_EQUIP",
          { userId: req.params.userId, type, itemName },
        );
        res.json({ success: true });
      } catch (error) {
        Logger.error(`[CASINO EQUIP ERROR] reqId=${req.reqId}`, error);
        res.status(500).json({
          error: t(req.lang, "dashboard.casino.equip_error"),
          reqId: req.reqId,
        });
      }
    },
  );

  return router;
};
