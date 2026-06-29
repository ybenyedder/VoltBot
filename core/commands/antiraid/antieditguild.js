const { PermissionFlagsBits } = require("discord.js");

module.exports = {
  name: "antieditguild",
  description: "Active/désactive la protection anti-modification du serveur",
  category: "antiraid",
  usage: "antieditguild",
  userPerms: [PermissionFlagsBits.Administrator],
  botPerms: [PermissionFlagsBits.ManageGuild],
  async execute(client, message, args) {
    const permissions = require("../../utils/permissions");
    if (!permissions.isAdmin(message, client))
      return message
        .reply({
          embeds: [
            client.embedBuilder.error(
              client,
              message.t("commands.antieditguild.admin_required"),
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
                message.t("commands.antieditguild.unknown_sanction"),
              ),
            ],
          })
          .catch(() => {});
      }
      client.db.updateAntiraidConfig(message.guild.id, {
        antiEditGuildPunishment: sanction,
      });
      return message
        .reply({
          embeds: [
            client.embedBuilder.success(
              client,
              message.t("commands.antieditguild.sanction_set", { sanction }),
            ),
          ],
        })
        .catch(() => {});
    }

    let newState;
    if (arg === "on") newState = 1;
    else if (arg === "off") newState = 0;
    else if (arg === "max") newState = 2;
    else newState = config.antiEditGuild === 0 ? 1 : 0;

    if (config.antiEditGuild === newState && (arg === "on" || arg === "off")) {
      return message
        .reply({
          embeds: [
            client.embedBuilder.warning(
              client,
              newState ? message.t("commands.antieditguild.already_enabled") : message.t("commands.antieditguild.already_disabled"),
            ),
          ],
        })
        .catch(() => {});
    }

    client.db.updateAntiraidConfig(message.guild.id, {
      antiEditGuild: newState,
    });
    config = client.db.getAntiraidConfig(message.guild.id);

    const statusLabel = {
      0: message.t("commands.antieditguild.status_disabled"),
      1: message.t("commands.antieditguild.status_enabled"),
      2: message.t("commands.antieditguild.status_max"),
    }[newState];
    const helper = newState
      ? client.embedBuilder.success
      : client.embedBuilder.warning;
    const embed = helper(client, "")
      .setAuthor({
        name: "AntiEditGuild",
        iconURL: client?.user?.displayAvatarURL?.({ size: 64 }),
      })
      .setDescription(null)
      .addFields(
        { name: message.t("commands.antieditguild.field_status"), value: statusLabel, inline: true },
        {
          name: message.t("commands.antieditguild.field_action"),
          value: `\`${config.antiEditGuildPunishment || "ban"}\``,
          inline: true,
        },
        {
          name: message.t("commands.antieditguild.field_description"),
          value: message.t("commands.antieditguild.desc_text"),
          inline: false,
        },
      );

    message.reply({ embeds: [embed] }).catch(() => {});
  },
};
