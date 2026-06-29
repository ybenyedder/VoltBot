const { PermissionFlagsBits } = require("discord.js");

module.exports = {
  name: "antibot",
  description: "Active/désactive la protection",
  category: "antiraid",
  usage: "antibot",
  userPerms: [PermissionFlagsBits.Administrator],
  botPerms: [PermissionFlagsBits.ManageMessages],
  async execute(client, message, args) {
    const permissions = require("../../utils/permissions");
    if (!permissions.isAdmin(message, client))
      return message
        .reply({
          embeds: [
            client.embedBuilder.error(
              client,
              message.t("commands.antibot.admin_required"),
            ),
          ],
        })
        .catch(() => {});

    let config = client.db.getAntiraidConfig(message.guild.id);
    const arg = args[0]?.toLowerCase();

    if (arg === "punish") {
      const sanction = args[1]?.toLowerCase();
      const valid = ["warn", "mute", "kick", "ban", "strip", "none"];
      if (!sanction || !valid.includes(sanction)) {
        return message
          .reply({
            embeds: [
              client.embedBuilder.error(
                client,
                message.t("commands.antibot.unknown_sanction"),
              ),
            ],
          })
          .catch(() => {});
      }
      client.db.updateAntiraidConfig(message.guild.id, {
        antiBotPunishment: sanction,
      });
      return message
        .reply({
          embeds: [
            client.embedBuilder.success(
              client,
              message.t("commands.antibot.sanction_set", { sanction }),
            ),
          ],
        })
        .catch(() => {});
    }

    let newState;
    if (arg === "on") newState = 1;
    else if (arg === "off") newState = 0;
    else if (arg === "max") newState = 2;
    else newState = config.antiBot === 0 ? 1 : 0;

    if (config.antiBot === newState && (arg === "on" || arg === "off")) {
      return message
        .reply({
          embeds: [
            client.embedBuilder.warning(
              client,
              newState
                ? message.t("commands.antibot.already_enabled")
                : message.t("commands.antibot.already_disabled"),
            ),
          ],
        })
        .catch(() => {});
    }

    client.db.updateAntiraidConfig(message.guild.id, { antiBot: newState });
    config = client.db.getAntiraidConfig(message.guild.id);

    const statusLabel = {
      0: message.t("commands.antibot.status_disabled"),
      1: message.t("commands.antibot.status_enabled"),
      2: message.t("commands.antibot.status_max"),
    }[newState];
    const helper = newState
      ? client.embedBuilder.success
      : client.embedBuilder.warning;
    const embed = helper(client, "")
      .setAuthor({
        name: "AntiBot",
        iconURL: client?.user?.displayAvatarURL?.({ size: 64 }),
      })
      .setDescription(null)
      .addFields(
        { name: message.t("commands.antibot.field_status"), value: statusLabel, inline: true },
        {
          name: message.t("commands.antibot.field_action"),
          value: `\`${config.antiBotPunishment || "kick"}\``,
          inline: true,
        },
        {
          name: message.t("commands.antibot.field_description"),
          value: message.t("commands.antibot.module_description"),
          inline: false,
        },
      );

    message.reply({ embeds: [embed] }).catch(() => {});
  },
};
