const { PermissionFlagsBits } = require("discord.js");

module.exports = {
  name: "antigif",
  description:
    "Active/désactive la protection Anti-GIF (bloque l'envoi de GIFs)",
  category: "antiraid",
  usage: "antigif",
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
              message.t("commands.antigif.admin_required"),
            ),
          ],
        })
        .catch(() => {});

    let config = client.db.getAntiraidConfig(message.guild.id);
    const arg = args[0]?.toLowerCase();
    const {
      invalidateGuildCache,
    } = require("../../events/handlers/automodHandler");

    if (arg === "punish") {
      const sanction = args[1]?.toLowerCase();
      const valid = ["warn", "mute", "kick", "ban", "strip", "delete", "none"];
      if (!sanction || !valid.includes(sanction)) {
        return message
          .reply({
            embeds: [
              client.embedBuilder.error(
                client,
                message.t("commands.antigif.unknown_sanction"),
              ),
            ],
          })
          .catch(() => {});
      }
      client.db.updateAntiraidConfig(message.guild.id, {
        antiGifPunishment: sanction,
      });
      invalidateGuildCache(message.guild.id);
      return message
        .reply({
          embeds: [
            client.embedBuilder.success(
              client,
              message.t("commands.antigif.sanction_set", { sanction }),
            ),
          ],
        })
        .catch(() => {});
    }

    let newState;
    if (arg === "on") newState = 1;
    else if (arg === "off") newState = 0;
    else if (arg === "max") newState = 2;
    else newState = config.antiGif === 0 ? 1 : 0;

    if (config.antiGif === newState && (arg === "on" || arg === "off")) {
      return message
        .reply({
          embeds: [
            client.embedBuilder.warning(
              client,
              newState ? message.t("commands.antigif.already_enabled") : message.t("commands.antigif.already_disabled"),
            ),
          ],
        })
        .catch(() => {});
    }

    client.db.updateAntiraidConfig(message.guild.id, { antiGif: newState });
    invalidateGuildCache(message.guild.id);
    config = client.db.getAntiraidConfig(message.guild.id);

    const statusLabel = {
      0: message.t("commands.antigif.status_disabled"),
      1: message.t("commands.antigif.status_enabled"),
      2: message.t("commands.antigif.status_max"),
    }[newState];
    const helper = newState
      ? client.embedBuilder.success
      : client.embedBuilder.warning;
    const embed = helper(client, "")
      .setAuthor({
        name: "AntiGif",
        iconURL: client?.user?.displayAvatarURL?.({ size: 64 }),
      })
      .setDescription(null)
      .addFields(
        { name: message.t("commands.antigif.field_status"), value: statusLabel, inline: true },
        {
          name: message.t("commands.antigif.field_action"),
          value: `\`${config.antiGifPunishment || "delete"}\``,
          inline: true,
        },
        {
          name: message.t("commands.antigif.field_description"),
          value: message.t("commands.antigif.desc_text"),
          inline: false,
        },
      );

    message.reply({ embeds: [embed] }).catch(() => {});
  },
};
