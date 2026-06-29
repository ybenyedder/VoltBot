const { PermissionFlagsBits } = require("discord.js");

module.exports = {
  name: "antiemote",
  description: "Active/désactive la protection",
  category: "antiraid",
  usage: "antiemote",
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
              message.t("commands.antiemote.admin_required"),
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
                message.t("commands.antiemote.unknown_sanction"),
              ),
            ],
          })
          .catch(() => {});
      }
      client.db.updateAntiraidConfig(message.guild.id, {
        antiEmotePunishment: sanction,
      });
      return message
        .reply({
          embeds: [
            client.embedBuilder.success(
              client,
              message.t("commands.antiemote.sanction_set", { sanction }),
            ),
          ],
        })
        .catch(() => {});
    }

    let newState;
    if (arg === "on") newState = 1;
    else if (arg === "off") newState = 0;
    else if (arg === "max") newState = 2;
    else newState = config.antiEmote === 0 ? 1 : 0;

    if (config.antiEmote === newState && (arg === "on" || arg === "off")) {
      return message
        .reply({
          embeds: [
            client.embedBuilder.warning(
              client,
              newState ? message.t("commands.antiemote.already_enabled") : message.t("commands.antiemote.already_disabled"),
            ),
          ],
        })
        .catch(() => {});
    }

    client.db.updateAntiraidConfig(message.guild.id, { antiEmote: newState });
    config = client.db.getAntiraidConfig(message.guild.id);

    const statusLabel = {
      0: message.t("commands.antiemote.status_disabled"),
      1: message.t("commands.antiemote.status_enabled"),
      2: message.t("commands.antiemote.status_max"),
    }[newState];
    const helper = newState
      ? client.embedBuilder.success
      : client.embedBuilder.warning;
    const embed = helper(client, "")
      .setAuthor({
        name: "AntiEmote",
        iconURL: client?.user?.displayAvatarURL?.({ size: 64 }),
      })
      .setDescription(null)
      .addFields(
        { name: message.t("commands.antiemote.field_status"), value: statusLabel, inline: true },
        {
          name: message.t("commands.antiemote.field_action"),
          value: `\`${config.antiEmotePunishment || "strip"}\``,
          inline: true,
        },
        {
          name: message.t("commands.antiemote.field_description"),
          value: message.t("commands.antiemote.desc_text"),
          inline: false,
        },
      );

    message.reply({ embeds: [embed] }).catch(() => {});
  },
};
