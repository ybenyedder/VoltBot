const { PermissionFlagsBits } = require("discord.js");
const permissions = require("../../utils/permissions");

module.exports = {
  name: "drops",
  aliases: ["toggledrops", "drop"],
  description: "Active ou désactive les coffres (drops) aléatoires.",
  category: "config",
  usage: "+drops <on|off|status>",
  userPerms: [PermissionFlagsBits.Administrator],
  async execute(client, message, args) {
    if (!permissions.isAdmin(message, client)) {
      return message
        .reply({
          embeds: [
            client.embedBuilder.error(
              client,
              message.t("commands.drops.admin_only"),
            ),
          ],
        })
        .catch(() => {});
    }

    const guildSettings = client.db.getGuild(message.guild.id);
    const current = guildSettings.dropsEnabled !== 0;
    const action = (args[0] || "").toLowerCase();

    let next;
    if (["on", "enable", "activer", "true", "1"].includes(action)) next = 1;
    else if (["off", "disable", "desactiver", "désactiver", "false", "0"].includes(action)) next = 0;
    else if (["toggle", "switch"].includes(action)) next = current ? 0 : 1;
    else if (["status", "etat", "état", ""].includes(action)) {
      const embed = client.embedBuilder
        .base(client, message.t("commands.drops.status_title"), null)
        .addFields(
          { name: message.t("commands.drops.field_state"), value: current ? message.t("commands.drops.enabled") : message.t("commands.drops.disabled"), inline: true },
          {
            name: message.t("commands.drops.field_subcommands"),
            value: "`+drops on` · `+drops off` · `+drops toggle`",
            inline: false,
          },
        );
      return message.reply({ embeds: [embed] }).catch(() => {});
    } else {
      return message
        .reply({
          embeds: [
            client.embedBuilder.error(
              client,
              message.t("commands.drops.usage"),
            ),
          ],
        })
        .catch(() => {});
    }

    client.db.updateGuild(message.guild.id, { dropsEnabled: next });
    const embed = client.embedBuilder
      .success(client, next ? message.t("commands.drops.drops_enabled") : message.t("commands.drops.drops_disabled"))
      .addFields(
        { name: message.t("commands.drops.field_before"), value: current ? message.t("commands.drops.enabled") : message.t("commands.drops.disabled"), inline: true },
        { name: message.t("commands.drops.field_after"), value: next ? message.t("commands.drops.enabled_bold") : message.t("commands.drops.disabled_bold"), inline: true },
        { name: message.t("commands.drops.field_moderator"), value: `${message.author}`, inline: true },
      );
    return message.reply({ embeds: [embed] }).catch(() => {});
  },
};
