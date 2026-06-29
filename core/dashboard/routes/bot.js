const express = require("express");
const fs = require("fs");
const path = require("path");
const { ActivityType } = require("discord.js");
const Logger = require("../../utils/logger.js");
const { t } = require("../../utils/i18n");

// Mappe le label texte (persisté en DB) vers l'enum Discord.
const ACTIVITY_TYPE_MAP = {
  Playing: ActivityType.Playing,
  Listening: ActivityType.Listening,
  Watching: ActivityType.Watching,
  Competing: ActivityType.Competing,
  Custom: ActivityType.Custom,
};
const VALID_ACTIVITY_TYPES = Object.keys(ACTIVITY_TYPE_MAP);

let isActionInProgress = false;

module.exports = function (client, middlewares, helpers) {
  const router = express.Router();
  const { requireAuth, requireGlobalOwner } = middlewares;
  const { logBuffer, logDashboardAction } = helpers;

  router.patch("/bot/settings", requireAuth, (req, res) => {
    const isPrimaryOwner =
      process.env.OWNER_ID &&
      process.env.OWNER_ID.split(",")
        .map((id) => id.trim())
        .includes(req.user.id);
    if (!isPrimaryOwner)
      return res
        .status(403)
        .json({ error: t(req.lang, "dashboard.bot.owner_only") });

    const { presenceStatus, customStatus, themeColor } = req.body;
    const validStatuses = ["online", "idle", "dnd", "invisible"];
    if (
      presenceStatus !== undefined &&
      !validStatuses.includes(presenceStatus)
    ) {
      return res
        .status(400)
        .json({ error: t(req.lang, "dashboard.bot.invalid_presence_status") });
    }
    if (customStatus !== undefined && typeof customStatus !== "string") {
      return res
        .status(400)
        .json({ error: t(req.lang, "dashboard.bot.invalid_custom_status") });
    }
    if (themeColor !== undefined && typeof themeColor !== "string") {
      return res
        .status(400)
        .json({ error: t(req.lang, "dashboard.bot.invalid_theme_color") });
    }

    const updates = {};
    if (presenceStatus) updates.presenceStatus = presenceStatus;
    if (customStatus !== undefined) updates.customStatus = customStatus;
    if (themeColor) updates.themeColor = themeColor;

    try {
      client.db.updateBotSettings(updates);
      // Re-apply full presence atomically from canonical DB state to keep
      // status + activity coherent (setStatus alone wipes the activity).
      if (client.user && (presenceStatus || customStatus !== undefined)) {
        const fresh = client.db.getBotSettings() || {};
        const effectiveStatus = fresh.presenceStatus || "online";
        const effectiveText = fresh.customStatus || "";
        client.user.setPresence({
          status: effectiveStatus,
          activities: effectiveText ? [{ name: effectiveText, type: 4 }] : [],
        });
      }
      logDashboardAction(
        null,
        req.user.id,
        req.user.username,
        "UPDATE_BOT_SETTINGS",
        updates,
      );
      res.json({ success: true, settings: updates });
    } catch (error) {
      Logger.error(`[DASHBOARD BOT SETTINGS ERROR] reqId=${req.reqId}`, error);
      res.status(500).json({
        error: t(req.lang, "dashboard.bot.update_settings_error"),
        reqId: req.reqId,
      });
    }
  });

  router.get("/bot/owners", requireAuth, requireGlobalOwner, (req, res) => {
    try {
      const owners = client.db.db.prepare("SELECT * FROM bot_owners").all();
      const populatedOwners = [];
      for (const row of owners) {
        const u = client.users.cache.get(row.userId);
        populatedOwners.push({
          userId: row.userId,
          addedAt: row.addedAt,
          username: u ? u.username : "Inconnu",
          avatar: u ? u.displayAvatarURL({ dynamic: true }) : null,
        });
      }
      res.json(populatedOwners);
    } catch (error) {
      Logger.error(`[DASHBOARD GET OWNERS ERROR] reqId=${req.reqId}`, error);
      res.status(500).json({
        error: t(req.lang, "dashboard.bot.fetch_owners_error"),
        reqId: req.reqId,
      });
    }
  });

  router.post(
    "/bot/owners",
    requireAuth,
    requireGlobalOwner,
    async (req, res) => {
      const { userId } = req.body;
      if (typeof userId !== "string" || !/^\d{17,20}$/.test(userId.trim())) {
        return res
          .status(400)
          .json({ error: "ID Discord invalide." });
      }
      const cleanId = userId.trim();

      try {
        const u = await client.users.fetch(cleanId).catch(() => null);
        if (!u)
          return res.status(404).json({ error: "Utilisateur introuvable" });

        const existing = client.db.db
          .prepare("SELECT userId FROM bot_owners WHERE userId = ?")
          .get(cleanId);
        if (existing)
          return res
            .status(409)
            .json({ error: t(req.lang, "dashboard.bot.already_owner") });

        client.db.db
          .prepare("INSERT INTO bot_owners (userId, addedAt) VALUES (?, ?)")
          .run(cleanId, Date.now());
        logDashboardAction(
          null,
          req.user.id,
          req.user.username,
          "BOT_OWNER_ADD",
          { userId: cleanId, username: u.username },
        );
        res.json({
          success: true,
          username: u.username,
          avatar: u.displayAvatarURL({ dynamic: true }),
        });
      } catch (error) {
        Logger.error(`[DASHBOARD ADD OWNER ERROR] reqId=${req.reqId}`, error);
        res.status(500).json({
          error: t(req.lang, "dashboard.bot.add_owner_error"),
          reqId: req.reqId,
        });
      }
    },
  );

  router.delete(
    "/bot/owners/:userId",
    requireAuth,
    requireGlobalOwner,
    (req, res) => {
      const { userId } = req.params;
      if (!/^\d{17,20}$/.test(userId)) {
        return res.status(400).json({ error: "ID utilisateur invalide" });
      }
      try {
        client.db.db
          .prepare("DELETE FROM bot_owners WHERE userId = ?")
          .run(userId);
        logDashboardAction(
          null,
          req.user.id,
          req.user.username,
          "BOT_OWNER_REMOVE",
          { userId },
        );
        res.json({ success: true });
      } catch (error) {
        Logger.error(
          `[DASHBOARD DELETE OWNER ERROR] reqId=${req.reqId}`,
          error,
        );
        res.status(500).json({
          error: t(req.lang, "dashboard.bot.remove_owner_error"),
          reqId: req.reqId,
        });
      }
    },
  );

  router.get("/bot/logs", requireAuth, requireGlobalOwner, (req, res) => {
    res.json({ logs: logBuffer || [] });
  });

  router.get("/bot/logs/full", requireAuth, requireGlobalOwner, (req, res) => {
    const logFile = path.join(__dirname, "../../../log.txt");
    if (!fs.existsSync(logFile))
      return res.json({ logs: "Fichier de logs introuvable." });

    try {
      const content = fs.readFileSync(logFile, "utf8");
      const lines = content.split("\n").slice(-500).join("\n");
      res.json({ logs: lines });
    } catch (error) {
      Logger.error(`[DASHBOARD BOT LOGS ERROR] reqId=${req.reqId}`, error);
      res.status(500).json({
        error: "Erreur lors de la lecture des logs",
        reqId: req.reqId,
      });
    }
  });

  router.get(
    "/bot/security-logs",
    requireAuth,
    requireGlobalOwner,
    (req, res) => {
      try {
        const logs = client.db.db
          .prepare(
            "SELECT * FROM dashboard_access_logs ORDER BY timestamp DESC LIMIT 100",
          )
          .all();
        res.json(logs);
      } catch (error) {
        Logger.error(
          `[DASHBOARD SECURITY LOGS ERROR] reqId=${req.reqId}`,
          error,
        );
        res.status(500).json({
          error: t(req.lang, "dashboard.bot.fetch_security_logs_error"),
          reqId: req.reqId,
        });
      }
    },
  );

  router.post(
    "/bot/control",
    requireAuth,
    requireGlobalOwner,
    async (req, res) => {
      const { action } = req.body;
      const validActions = ["STOP", "START", "RESTART"];
      if (typeof action !== "string" || !validActions.includes(action)) {
        return res
          .status(400)
          .json({ error: "Action invalide. Utilisez STOP, START ou RESTART." });
      }

      if (isActionInProgress) {
        return res
          .status(429)
          .json({ error: t(req.lang, "dashboard.bot.action_in_progress") });
      }

      try {
        isActionInProgress = true;

        logDashboardAction(
          null,
          req.user.id,
          req.user.username,
          `BOT_${action}`,
          { action },
        );

        if (action === "STOP") {
          if (!client.user) {
            isActionInProgress = false;
            return res.json({
              success: true,
              status: "offline",
              message: t(req.lang, "dashboard.bot.already_stopped"),
            });
          }
          Logger.warn(`[DASHBOARD] Bot stopping by ${req.user.username}`);
          await client.destroy();
          isActionInProgress = false;
          return res.json({ success: true, status: "offline" });
        }

        if (action === "START") {
          if (client.user) {
            isActionInProgress = false;
            return res.json({
              success: true,
              status: "online",
              message: t(req.lang, "dashboard.bot.already_online"),
            });
          }
          if (!process.env.DISCORD_TOKEN) {
            isActionInProgress = false;
            return res.status(500).json({
              error: t(req.lang, "dashboard.bot.missing_token_server"),
            });
          }

          Logger.info(`[DASHBOARD] Bot starting by ${req.user.username}`);
          await client.login(process.env.DISCORD_TOKEN);
          isActionInProgress = false;
          return res.json({ success: true, status: "online" });
        }

        if (action === "RESTART") {
          Logger.info(`[DASHBOARD] Bot restarting by ${req.user.username}`);

          if (client.user) {
            await client.destroy();
            await new Promise((r) => setTimeout(r, 2000));
          }

          if (!process.env.DISCORD_TOKEN) {
            isActionInProgress = false;
            return res.status(500).json({
              error: t(req.lang, "dashboard.bot.missing_token_restart"),
            });
          }

          await client.login(process.env.DISCORD_TOKEN);
          isActionInProgress = false;
          return res.json({ success: true, status: "online" });
        }
      } catch (error) {
        isActionInProgress = false;
        Logger.error(`[DASHBOARD CONTROL ERROR] reqId=${req.reqId}`, error);
        res.status(500).json({
          error: t(req.lang, "dashboard.bot.control_action_error"),
          reqId: req.reqId,
        });
      }
    },
  );

  router.patch(
    "/bot/presence",
    requireAuth,
    requireGlobalOwner,
    async (req, res) => {
      const { status, activityName, activityType } = req.body;
      const validStatuses = ["online", "idle", "dnd", "invisible"];
      if (status !== undefined && !validStatuses.includes(status)) {
        return res.status(400).json({ error: "Statut invalide" });
      }
      if (activityName !== undefined && typeof activityName !== "string") {
        return res
          .status(400)
          .json({ error: t(req.lang, "dashboard.bot.invalid_activity_name") });
      }
      // Validation du type d'activité contre l'enum autorisé (label texte).
      if (
        activityType !== undefined &&
        !VALID_ACTIVITY_TYPES.includes(activityType)
      ) {
        return res
          .status(400)
          .json({ error: t(req.lang, "dashboard.bot.invalid_activity_type") });
      }
      try {
        if (!client.user)
          return res.status(400).json({ error: "Bot hors ligne" });

        // Détermine le type effectif : la requête prime, sinon la DB, sinon Custom.
        const fresh = client.db.getBotSettings() || {};
        const effectiveActivityLabel =
          activityType !== undefined
            ? activityType
            : VALID_ACTIVITY_TYPES.includes(fresh.activityType)
              ? fresh.activityType
              : "Custom";
        const effectiveActivityEnum =
          ACTIVITY_TYPE_MAP[effectiveActivityLabel] ?? ActivityType.Custom;

        const presenceOptions = {};
        if (status) presenceOptions.status = status;
        if (activityName !== undefined) {
          if (activityName === "") {
            presenceOptions.activities = [];
          } else {
            presenceOptions.activities = [
              {
                name: activityName,
                type: effectiveActivityEnum,
              },
            ];
          }
        } else if (activityType !== undefined) {
          // Type changé sans nouveau nom : réappliquer avec le nom courant.
          const currentName = fresh.customStatus || "";
          if (currentName !== "") {
            presenceOptions.activities = [
              { name: currentName, type: effectiveActivityEnum },
            ];
          }
        }
        client.user.setPresence(presenceOptions);
        // Persistance dans bot_settings pour que le refresh 10 min de
        // clientReady ne reverte pas cette présence.
        const persisted = {};
        if (status) persisted.presenceStatus = status;
        if (activityName !== undefined) persisted.customStatus = activityName;
        if (activityType !== undefined) persisted.activityType = activityType;
        if (Object.keys(persisted).length > 0) {
          try {
            client.db.updateBotSettings(persisted);
          } catch (e) {
            Logger.error("[BOT PRESENCE PERSIST ERROR]", e);
          }
        }
        logDashboardAction(
          null,
          req.user.id,
          req.user.username,
          "UPDATE_BOT_PRESENCE",
          { status, activityName, activityType },
        );
        res.json({ success: true, presenceOptions });
      } catch (error) {
        Logger.error(`[BOT PRESENCE ERROR] reqId=${req.reqId}`, error);
        res.status(500).json({
          error: t(req.lang, "dashboard.bot.update_presence_error"),
          reqId: req.reqId,
        });
      }
    },
  );

  router.patch(
    "/bot/profile",
    requireAuth,
    requireGlobalOwner,
    async (req, res) => {
      const { username, avatar } = req.body;
      if (username !== undefined && typeof username !== "string") {
        return res.status(400).json({ error: "Nom d'utilisateur invalide" });
      }
      if (avatar !== undefined && typeof avatar !== "string") {
        return res.status(400).json({ error: "Avatar invalide" });
      }
      try {
        if (!client.user)
          return res.status(400).json({ error: "Bot hors ligne" });

        const updates = {};
        if (username && username.trim() !== "")
          updates.username = username.trim();
        if (avatar) updates.avatar = avatar;

        if (Object.keys(updates).length > 0) {
          await client.user.edit(updates);
          logDashboardAction(
            null,
            req.user.id,
            req.user.username,
            "UPDATE_BOT_PROFILE",
            {
              username: updates.username || null,
              avatarChanged: !!updates.avatar,
            },
          );
          res.json({ success: true, updates });
        } else {
          res.status(400).json({ error: "Aucune modification fournie" });
        }
      } catch (error) {
        Logger.error(`[BOT PROFILE ERROR] reqId=${req.reqId}`, error);
        res.status(500).json({
          error: t(req.lang, "dashboard.bot.update_profile_error"),
          reqId: req.reqId,
        });
      }
    },
  );

  return router;
};
