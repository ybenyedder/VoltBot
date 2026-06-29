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
    "/:guildId/antiraid/whitelist",
    requireAuth,
    requireGuildAdmin,
    (req, res) => {
      const { guildId } = req.params;
      try {
        const list = client.db.getAntiraidWhitelist(guildId);
        res.json(
          list.map((l) => ({
            ...l,
            bypasses: l.bypasses ? JSON.parse(l.bypasses) : [],
          })),
        );
      } catch (error) {
        Logger.error(
          `[DASHBOARD ANTIRAID WHITELIST GET] reqId=${req.reqId}`,
          error,
        );
        res.status(500).json({
          error: t(req.lang, "dashboard.antiraid.whitelist_fetch_error"),
          reqId: req.reqId,
        });
      }
    },
  );

  router.post(
    "/:guildId/antiraid/whitelist",
    requireAuth,
    requireGuildAdmin,
    (req, res) => {
      const { guildId } = req.params;
      const { userId, bypasses } = req.body;
      if (
        typeof userId !== "string" ||
        !/^\d{17,20}$/.test(userId.trim()) ||
        !Array.isArray(bypasses)
      ) {
        return res.status(400).json({
          error: t(req.lang, "dashboard.antiraid.invalid_data"),
        });
      }
      // Cap bypasses entries so the JSON.stringify in
      // setAntiraidWhitelistUser can't be coaxed into storing nested
      // objects / arbitrary types.
      const safeBypasses = bypasses
        .filter((b) => typeof b === "string")
        .slice(0, 32)
        .map((b) => b.substring(0, 50));
      try {
        client.db.setAntiraidWhitelistUser(guildId, userId.trim(), safeBypasses);
        invalidateGuildCache(guildId);
        if (client.invalidateGuildConfig)
          client.invalidateGuildConfig(guildId);
        logDashboardAction(
          guildId,
          req.user.id,
          req.user.username,
          "ANTIRAID_WHITELIST_SET",
          { userId: userId.trim(), bypasses: safeBypasses },
        );
        res.json({ success: true });
      } catch (error) {
        Logger.error(
          `[DASHBOARD ANTIRAID WHITELIST SET] reqId=${req.reqId}`,
          error,
        );
        res.status(500).json({
          error: t(req.lang, "dashboard.antiraid.whitelist_update_error"),
          reqId: req.reqId,
        });
      }
    },
  );

  router.delete(
    "/:guildId/antiraid/whitelist/:userId",
    requireAuth,
    requireGuildAdmin,
    (req, res) => {
      const { guildId, userId } = req.params;
      if (
        !userId ||
        typeof userId !== "string" ||
        !/^\d{17,20}$/.test(userId)
      ) {
        return res
          .status(400)
          .json({ error: "Identifiant utilisateur invalide" });
      }
      try {
        client.db.removeAntiraidWhitelistUser(guildId, userId);
        invalidateGuildCache(guildId);
        if (client.invalidateGuildConfig)
          client.invalidateGuildConfig(guildId);
        logDashboardAction(
          guildId,
          req.user.id,
          req.user.username,
          "ANTIRAID_WHITELIST_REMOVE",
          { userId },
        );
        res.json({ success: true });
      } catch (error) {
        Logger.error(
          `[DASHBOARD ANTIRAID WHITELIST DELETE] reqId=${req.reqId}`,
          error,
        );
        res.status(500).json({
          error: "Erreur lors de la suppression de la whitelist antiraid",
          reqId: req.reqId,
        });
      }
    },
  );

  return router;
};
