const express = require("express");
const Logger = require("../../utils/logger.js");
const { t } = require("../../utils/i18n");

module.exports = function (client, middlewares, helpers) {
  const router = express.Router();
  const { requireAuth, requireGuildAdmin } = middlewares;
  const { logDashboardAction } = helpers;

  router.get(
    "/:guildId/tickets",
    requireAuth,
    requireGuildAdmin,
    (req, res) => {
      try {
        const config = client.db.db
          .prepare("SELECT * FROM tickets_config WHERE guildId = ?")
          .get(req.params.guildId) || {
          categoryId: null,
          roleId: null,
          logsChannelId: null,
        };
        const options = client.db.db
          .prepare("SELECT * FROM ticket_options WHERE guildId = ?")
          .all(req.params.guildId);
        res.json({ config, options });
      } catch (error) {
        Logger.error(
          `[DASHBOARD TICKETS GET ERROR] reqId=${req.reqId}`,
          error,
        );
        res.status(500).json({ error: "Erreur tickets", reqId: req.reqId });
      }
    },
  );

  router.patch(
    "/:guildId/tickets",
    requireAuth,
    requireGuildAdmin,
    (req, res) => {
      const { categoryId, roleId, logsChannelId } = req.body;
      const isOptionalString = (v) =>
        v === undefined || v === null || typeof v === "string";
      if (
        !isOptionalString(categoryId) ||
        !isOptionalString(roleId) ||
        !isOptionalString(logsChannelId)
      ) {
        return res
          .status(400)
          .json({ error: "Champs de configuration invalides" });
      }
      try {
        client.db.db
          .prepare(
            `
                INSERT INTO tickets_config (guildId, categoryId, roleId, logsChannelId)
                VALUES (?, ?, ?, ?)
                ON CONFLICT(guildId) DO UPDATE SET
                categoryId = excluded.categoryId,
                roleId = excluded.roleId,
                logsChannelId = excluded.logsChannelId
            `,
          )
          .run(
            req.params.guildId,
            categoryId || null,
            roleId || null,
            logsChannelId || null,
          );
        logDashboardAction(
          req.params.guildId,
          req.user.id,
          req.user.username,
          "UPDATE_TICKETS_CONFIG",
          { categoryId, roleId, logsChannelId },
        );
        res.json({ success: true });
      } catch (error) {
        Logger.error(`[DASHBOARD TICKETS UPDATE] reqId=${req.reqId}`, error);
        res.status(500).json({
          error: t(req.lang, "dashboard.tickets.update_error"),
          reqId: req.reqId,
        });
      }
    },
  );

  router.post(
    "/:guildId/tickets/options",
    requireAuth,
    requireGuildAdmin,
    (req, res) => {
      const { id, title, emoji, roleId, description } = req.body;
      if (typeof title !== "string" || !title.trim()) {
        return res
          .status(400)
          .json({ error: "Le titre de l'option est requis" });
      }
      // Tight type validation on optional string columns to keep typed values
      // (and reject objects / arrays / numbers that could surface as `[object
      // Object]` or break downstream consumers).
      const isOptionalString = (v) =>
        v === undefined || v === null || typeof v === "string";
      if (
        !isOptionalString(emoji) ||
        !isOptionalString(roleId) ||
        !isOptionalString(description)
      ) {
        return res
          .status(400)
          .json({ error: "Champs d'option de ticket invalides" });
      }
      const safeTitle = title.trim().substring(0, 100);
      const safeEmoji = emoji ? String(emoji).substring(0, 100) : null;
      const safeRoleId =
        typeof roleId === "string" && /^\d{17,20}$/.test(roleId.trim())
          ? roleId.trim()
          : null;
      const safeDescription = description
        ? String(description).substring(0, 400)
        : null;
      try {
        if (id) {
          const numericId = parseInt(id, 10);
          if (isNaN(numericId)) {
            return res.status(400).json({ error: "Identifiant invalide" });
          }
          client.db.db
            .prepare(
              `
                    UPDATE ticket_options SET title = ?, emoji = ?, roleId = ?, description = ?
                    WHERE id = ? AND guildId = ?
                `,
            )
            .run(
              safeTitle,
              safeEmoji,
              safeRoleId,
              safeDescription,
              numericId,
              req.params.guildId,
            );
        } else {
          client.db.db
            .prepare(
              `
                    INSERT INTO ticket_options (guildId, title, emoji, roleId, description)
                    VALUES (?, ?, ?, ?, ?)
                `,
            )
            .run(
              req.params.guildId,
              safeTitle,
              safeEmoji,
              safeRoleId,
              safeDescription,
            );
        }
        logDashboardAction(
          req.params.guildId,
          req.user.id,
          req.user.username,
          id ? "TICKET_OPTION_UPDATE" : "TICKET_OPTION_ADD",
          {
            id: id || null,
            title: safeTitle,
            emoji: safeEmoji,
            roleId: safeRoleId,
            description: safeDescription,
          },
        );
        res.json({ success: true });
      } catch (error) {
        Logger.error(`[DASHBOARD TICKETS OPTIONS] reqId=${req.reqId}`, error);
        res.status(500).json({
          error: "Erreur lors de la sauvegarde de l'option de ticket",
          reqId: req.reqId,
        });
      }
    },
  );

  router.delete(
    "/:guildId/tickets/options/:id",
    requireAuth,
    requireGuildAdmin,
    (req, res) => {
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) {
        return res.status(400).json({ error: "Identifiant d'option invalide" });
      }
      try {
        client.db.db
          .prepare("DELETE FROM ticket_options WHERE id = ? AND guildId = ?")
          .run(id, req.params.guildId);
        logDashboardAction(
          req.params.guildId,
          req.user.id,
          req.user.username,
          "TICKET_OPTION_DELETE",
          { id },
        );
        res.json({ success: true });
      } catch (error) {
        Logger.error(
          `[DASHBOARD TICKETS DELETE OPTION] reqId=${req.reqId}`,
          error,
        );
        res.status(500).json({
          error: "Erreur lors de la suppression de l'option",
          reqId: req.reqId,
        });
      }
    },
  );

  router.post(
    "/:guildId/tickets/deploy",
    requireAuth,
    requireGuildAdmin,
    async (req, res) => {
      const { channelId } = req.body;
      const guild = req.guild;
      const channel = guild.channels.cache.get(channelId);

      if (!channel) return res.status(404).json({ error: "Salon introuvable" });

      try {
        const panelTitle = "Support & Tickets";
        const panelDesc = t(req.lang, "dashboard.tickets.panel_description");

        const embed = client.embedBuilder
          .base(client, panelTitle, panelDesc)
          .setThumbnail(guild.iconURL({ dynamic: true }));

        const optionsRow = client.db.db
          .prepare("SELECT * FROM ticket_options WHERE guildId = ?")
          .all(guild.id);

        const parseEmoji = (emojiString) => {
          if (!emojiString) return null;
          const customEmojiMatch = emojiString.match(
            /^(?:<a?:)?(\w+):(\d+)>?$/,
          );
          if (customEmojiMatch)
            return {
              name: customEmojiMatch[1],
              id: customEmojiMatch[2],
              animated: emojiString.includes("<a:"),
            };
          return emojiString;
        };

        const selectOptions =
          optionsRow.length > 0
            ? optionsRow.map((opt) => ({
                label: opt.title,
                description: opt.description || "Créer un ticket",
                emoji: parseEmoji(opt.emoji) || "",
                value: `ticket_opt_${opt.id}`,
              }))
            : [
                {
                  label: "Contacter le staff",
                  description: "Ouvrir un ticket classique",
                  emoji: "",
                  value: "ticket_opt_default",
                },
              ];

        const {
          ActionRowBuilder,
          StringSelectMenuBuilder,
        } = require("discord.js");
        const selectMenu = new StringSelectMenuBuilder()
          .setCustomId("ticket_select")
          .setPlaceholder("Fais un choix de ticket")
          .addOptions(selectOptions);

        await channel.send({
          embeds: [embed],
          components: [new ActionRowBuilder().addComponents(selectMenu)],
        });
        logDashboardAction(
          guild.id,
          req.user.id,
          req.user.username,
          "TICKETS_DEPLOY",
          { channelId },
        );
        res.json({ success: true });
      } catch (error) {
        Logger.error(
          `[DASHBOARD TICKET DEPLOY ERROR] reqId=${req.reqId}`,
          error,
        );
        res.status(500).json({
          error: t(req.lang, "dashboard.tickets.deploy_error"),
          reqId: req.reqId,
        });
      }
    },
  );

  return router;
};
