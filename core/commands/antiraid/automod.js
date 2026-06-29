const { PermissionFlagsBits } = require("discord.js");

module.exports = {
  name: "automod",
  description: "Configure le mode automatique de modération",
  category: "antiraid",
  usage: "automod",
  userPerms: [PermissionFlagsBits.Administrator],
  botPerms: [PermissionFlagsBits.KickMembers, PermissionFlagsBits.BanMembers],
  async execute(client, message, args) {
    const guildSettings = client.db.getGuild(message.guild.id);
    const automod = guildSettings.automod || { enabled: false, action: "kick" };
    const p = client.config.prefix;

    if (!args[0]) {
      const embed = client.embedBuilder
        .base(client, "Automod")
        .setDescription(null)
        .addFields(
          {
            name: message.t("commands.automod.field_status"),
            value: automod.enabled
              ? message.t("commands.automod.status_enabled")
              : message.t("commands.automod.status_disabled"),
            inline: true,
          },
          {
            name: message.t("commands.automod.field_action"),
            value: `\`${automod.action || "kick"}\``,
            inline: true,
          },
          {
            name: message.t("commands.automod.field_description"),
            value: message.t("commands.automod.desc_text"),
            inline: false,
          },
          {
            name: message.t("commands.automod.field_commands"),
            value: `\`${p}automod enable\` \`${p}automod disable\` \`${p}automod action <kick|ban>\``,
            inline: false,
          },
        );
      return message.reply({ embeds: [embed] }).catch(() => {});
    }

    if (args[0] === "enable") {
      if (automod.enabled) {
        return message
          .reply({
            embeds: [
              client.embedBuilder.warning(
                client,
                message.t("commands.automod.already_enabled"),
              ),
            ],
          })
          .catch(() => {});
      }
      client.db.updateGuild(message.guild.id, {
        automod: { ...automod, enabled: true },
      });
      return message
        .reply({
          embeds: [
            client.embedBuilder.success(
              client,
              message.t("commands.automod.enabled"),
            ),
          ],
        })
        .catch(() => {});
    }

    if (args[0] === "disable") {
      if (!automod.enabled) {
        return message
          .reply({
            embeds: [
              client.embedBuilder.warning(
                client,
                message.t("commands.automod.already_disabled"),
              ),
            ],
          })
          .catch(() => {});
      }
      client.db.updateGuild(message.guild.id, {
        automod: { ...automod, enabled: false },
      });
      return message
        .reply({
          embeds: [
            client.embedBuilder.warning(
              client,
              message.t("commands.automod.disabled"),
            ),
          ],
        })
        .catch(() => {});
    }

    if (args[0] === "action" && args[1]) {
      const action = args[1].toLowerCase();
      if (action === "kick" || action === "ban") {
        client.db.updateGuild(message.guild.id, {
          automod: { ...automod, action },
        });
        return message
          .reply({
            embeds: [
              client.embedBuilder.success(
                client,
                message.t("commands.automod.action_set", { action }),
              ),
            ],
          })
          .catch(() => {});
      }
      return message
        .reply({
          embeds: [
            client.embedBuilder.error(
              client,
              message.t("commands.automod.unknown_sanction"),
            ),
          ],
        })
        .catch(() => {});
    }

    message
      .reply({
        embeds: [
          client.embedBuilder.error(
            client,
            message.t("commands.automod.usage", { p }),
          ),
        ],
      })
      .catch(() => {});
  },
};
