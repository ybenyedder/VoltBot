const express = require("express");
const Logger = require("../../utils/logger.js");
const { t } = require("../../utils/i18n");

module.exports = function (client, middlewares, helpers) {
  const router = express.Router();
  const { requireAuth, requireGuildAdmin, requireGlobalOwner } = middlewares;
  const { logDashboardAction } = helpers;

  router.get(
    "/:guildId/levels",
    requireAuth,
    requireGuildAdmin,
    async (req, res) => {
      try {
        const users = client.db.db
          .prepare(
            "SELECT userId, xp, level FROM users WHERE guildId = ? AND xp > 0 ORDER BY xp DESC LIMIT 100",
          )
          .all(req.params.guildId);
        const levelRoles = client.db.db
          .prepare(
            "SELECT * FROM level_roles WHERE guildId = ? ORDER BY level ASC",
          )
          .all(req.params.guildId);

        const guild = client.guilds.cache.get(req.params.guildId);
        if (!guild)
          return res
            .status(404)
            .json({ error: t(req.lang, "dashboard.levels.guild_not_found") });

        const levelsData = [];
        for (const u of users) {
          try {
            const member = await guild.members
              .fetch(u.userId)
              .catch(() => null);
            if (member) {
              levelsData.push({
                id: member.user.id,
                username: member.user.username,
                avatar: member.user.displayAvatarURL({ dynamic: true }),
                xp: u.xp,
                level: u.level,
              });
            }
          } catch (e) {}
        }

        res.json({ users: levelsData, roles: levelRoles });
      } catch (error) {
        Logger.error(`[DASHBOARD LEVELS FETCH ERROR] reqId=${req.reqId}`, error);
        res.status(500).json({
          error: t(req.lang, "dashboard.levels.fetch_error"),
          reqId: req.reqId,
        });
      }
    },
  );

  // Level-role rewards mutate global progression mechanics — the matching
  // bot commands (`+addlevelrole` / `+dellevelrole`) gate on `OWNER_ID` env
  // owners only, so the dashboard mirrors that with `requireGlobalOwner`
  // (primary + secondary bot owners + speedphrase).
  router.post(
    "/:guildId/levels/roles",
    requireAuth,
    requireGuildAdmin,
    requireGlobalOwner,
    (req, res) => {
      const { id, level, roleId } = req.body;
      if (!level || !roleId || isNaN(level))
        return res
          .status(400)
          .json({ error: t(req.lang, "dashboard.levels.invalid_level_role") });

      try {
        if (id) {
          const check = client.db.db
            .prepare(
              "SELECT id FROM level_roles WHERE guildId = ? AND level = ? AND id != ?",
            )
            .get(req.params.guildId, level, id);
          if (check)
            return res.status(400).json({
              error: t(req.lang, "dashboard.levels.level_already_rewarded", {
                level,
              }),
            });

          client.db.db
            .prepare(
              "UPDATE level_roles SET level = ?, roleId = ? WHERE id = ? AND guildId = ?",
            )
            .run(level, roleId, id, req.params.guildId);
        } else {
          const check = client.db.db
            .prepare(
              "SELECT id FROM level_roles WHERE guildId = ? AND level = ?",
            )
            .get(req.params.guildId, level);
          if (check)
            return res.status(400).json({
              error: t(req.lang, "dashboard.levels.level_already_rewarded", {
                level,
              }),
            });

          client.db.db
            .prepare(
              "INSERT INTO level_roles (guildId, level, roleId) VALUES (?, ?, ?)",
            )
            .run(req.params.guildId, level, roleId);
        }
        logDashboardAction(
          req.params.guildId,
          req.user.id,
          req.user.username,
          id ? "LEVEL_ROLE_UPDATE" : "LEVEL_ROLE_ADD",
          { id: id || null, level, roleId },
        );
        res.json({ success: true });
      } catch (error) {
        Logger.error(
          `[DASHBOARD LEVEL ROLES POST ERROR] reqId=${req.reqId}`,
          error,
        );
        res.status(500).json({
          error: t(req.lang, "dashboard.levels.save_level_role_error"),
          reqId: req.reqId,
        });
      }
    },
  );

  router.delete(
    "/:guildId/levels/roles/:id",
    requireAuth,
    requireGuildAdmin,
    requireGlobalOwner,
    (req, res) => {
      try {
        client.db.db
          .prepare("DELETE FROM level_roles WHERE id = ? AND guildId = ?")
          .run(req.params.id, req.params.guildId);
        logDashboardAction(
          req.params.guildId,
          req.user.id,
          req.user.username,
          "LEVEL_ROLE_DELETE",
          { id: req.params.id },
        );
        res.json({ success: true });
      } catch (error) {
        Logger.error(
          `[DASHBOARD LEVEL ROLE DELETE ERROR] reqId=${req.reqId}`,
          error,
        );
        res.status(500).json({
          error: "Erreur lors de la suppression",
          reqId: req.reqId,
        });
      }
    },
  );

  router.post(
    "/:guildId/levels/:userId",
    requireAuth,
    requireGuildAdmin,
    (req, res) => {
      // Snowflake guard: a missing check let arbitrary strings reach the DB
      // (matched parity with `economy/:userId` which already validates this).
      if (!/^\d{17,20}$/.test(req.params.userId || "")) {
        return res.status(400).json({ error: "ID utilisateur invalide" });
      }
      const { action, amount } = req.body;
      if (!["add", "remove", "set"].includes(action))
        return res.status(400).json({ error: "Action invalide" });

      const parsedAmount = parseInt(amount);
      if (isNaN(parsedAmount) || parsedAmount < 0)
        return res.status(400).json({ error: "Montant invalide" });

      try {
        const guildId = req.params.guildId;
        const userId = req.params.userId;

        const user = client.db.getUser(userId, guildId);
        let newXp = user.xp;

        if (action === "add") newXp += parsedAmount;
        else if (action === "remove") newXp = Math.max(0, newXp - parsedAmount);
        else if (action === "set") newXp = parsedAmount;

        const newLevel = Math.floor(Math.sqrt(newXp / 100));

        client.db.db
          .prepare(
            "UPDATE users SET xp = ?, level = ? WHERE userId = ? AND guildId = ?",
          )
          .run(newXp, newLevel, userId, guildId);

        logDashboardAction(
          guildId,
          req.user.id,
          req.user.username,
          "UPDATE_USER_XP",
          { userId, action, amount: parsedAmount, newXp, newLevel },
        );
        res.json({ success: true, newXp, newLevel });
      } catch (error) {
        Logger.error(
          `[DASHBOARD LEVELS USER UPDATE ERROR] reqId=${req.reqId}`,
          error,
        );
        res
          .status(500)
          .json({
            error: t(req.lang, "dashboard.levels.xp_update_error"),
            reqId: req.reqId,
          });
      }
    },
  );

  return router;
};
