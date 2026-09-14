const express = require("express");
const Logger = require("../../utils/logger.js");

module.exports = function (client, middlewares, helpers) {
  const router = express.Router();
  const { requireAuth } = middlewares;

  router.get("/identify", (req, res) => {
    res.json({
      botName: client.user?.username || "Bot",
      botId: client.user?.id || null,
      accessId: process.env.BOT_ACCESS_ID || null,
    });
  });

  // Authentification requise : cette route expose des données sensibles
  // (utilisateur connecté, bot_settings). requireAuth vérifie le JWT et
  // renseigne req.user, donc authenticated_user est toujours défini ici.
  router.get("/status", requireAuth, (req, res) => {
    const botSettings = client.db.getBotSettings() || {};

    res.json({
      status: "online",
      authenticated_user: req.user,
      bot_settings: botSettings,
      stats: {
        guilds: client.guilds.cache.size,
        users: client.users.cache.size,
        commands: client.commands.size,
        uptime: client.uptime,
      },
    });
  });

  router.get("/commands", (req, res) => {
    try {
      const commands = Array.from(client.commands.values()).map((cmd) => ({
        name: cmd.name,
        description: cmd.description || "Aucune description fournie.",
        category: cmd.category || "Inconnue",
        aliases: cmd.aliases || [],
        usage: cmd.usage || "",
        userPermissions: cmd.userPermissions || [],
        botPermissions: cmd.botPermissions || [],
      }));
      res.json(commands);
    } catch (error) {
      Logger.error(`[DASHBOARD COMMANDS ERROR] reqId=${req.reqId}`, error);
      res.status(500).json({
        error: "Impossible de charger la documentation des commandes",
        reqId: req.reqId,
      });
    }
  });

  return router;
};
