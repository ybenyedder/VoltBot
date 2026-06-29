const { PermissionsBitField } = require("discord.js");
const Logger = require("../../utils/logger");
const permissions = require("../../utils/permissions");

module.exports = {
  name: "ticketsetup",
  description:
    "Configure le système de tickets (Catégorie, Salon de logs, Rôle Staff).",
  category: "tickets",
  usage: "+ticketsetup <category_id> <logs_channel_id> [@role1 @role2 ...]",
  userPerms: [PermissionsBitField.Flags.Administrator],
  async execute(client, message, args) {
    if (args.length < 2) {
      const helpEmbed = client.embedBuilder
        .base(client, message.t("commands.ticketsetup.help_title"))
        .setDescription(message.t("commands.ticketsetup.usage"));
      return message.reply({ embeds: [helpEmbed] }).catch(() => {});
    }

    const categoryId = args[0];
    const logsChannelId = args[1];

    // Plusieurs rôles staff possibles : on accepte mentions (<@&id>) ou IDs bruts.
    // Stockés en CSV dans tickets_config.roleId — l'ouverture de ticket split sur ","
    // et ping/donne accès à chaque rôle.
    const roleIds = [];
    for (const raw of args.slice(2)) {
      const id = raw.replace(/[<@&>]/g, "").trim();
      if (!id) continue;
      const role = message.guild.roles.cache.get(id);
      if (!role) {
        return message
          .reply({
            embeds: [
              client.embedBuilder.error(
                client,
                message.t("commands.ticketsetup.role_not_found", { role: raw }),
              ),
            ],
          })
          .catch(() => {});
      }
      if (!roleIds.includes(id)) roleIds.push(id);
    }
    const roleId = roleIds.length ? roleIds.join(",") : null;

    const category = message.guild.channels.cache.get(categoryId);
    const logsChannel = message.guild.channels.cache.get(logsChannelId);

    if (!category || category.type !== 4) {
      return message
        .reply({
          embeds: [
            client.embedBuilder.error(
              client,
              message.t("commands.ticketsetup.category_not_found"),
            ),
          ],
        })
        .catch(() => {});
    }
    if (!logsChannel) {
      return message
        .reply({
          embeds: [
            client.embedBuilder.error(
              client,
              message.t("commands.ticketsetup.channel_not_found"),
            ),
          ],
        })
        .catch(() => {});
    }

    try {
      client.db.db
        .prepare(
          "INSERT INTO tickets_config (guildId, categoryId, roleId, logsChannelId) VALUES (?, ?, ?, ?) " +
            "ON CONFLICT(guildId) DO UPDATE SET categoryId = excluded.categoryId, roleId = excluded.roleId, logsChannelId = excluded.logsChannelId",
        )
        .run(message.guild.id, categoryId, roleId, logsChannelId);

      const successEmbed = client.embedBuilder
        .success(client, message.t("commands.ticketsetup.config_saved"))
        .addFields(
          {
            name: message.t("commands.ticketsetup.field_category"),
            value: `<#${categoryId}>`,
            inline: true,
          },
          {
            name: message.t("commands.ticketsetup.field_log_channel"),
            value: `<#${logsChannelId}>`,
            inline: true,
          },
          {
            name: message.t("commands.ticketsetup.field_staff_role"),
            value: roleIds.length
              ? roleIds.map((id) => `<@&${id}>`).join(" ")
              : message.t("commands.ticketsetup.not_defined"),
            inline: true,
          },
          {
            name: message.t("commands.ticketsetup.field_moderator"),
            value: `${message.author}`,
            inline: true,
          },
        );

      message.reply({ embeds: [successEmbed] }).catch(() => {});
    } catch (err) {
      Logger.error("[TICKETSETUP] Erreur:", err);
      message
        .reply({
          embeds: [
            client.embedBuilder.error(
              client,
              message.t("commands.ticketsetup.db_error"),
            ),
          ],
        })
        .catch(() => {});
    }
  },
};
