const { PermissionFlagsBits } = require("discord.js");

module.exports = {
  name: "anticreateinvite",
  description: "Active/désactive la protection anti-création d'invitations",
  category: "antiraid",
  usage: "anticreateinvite",
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
              message.t("commands.anticreateinvite.admin_required"),
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
                message.t("commands.anticreateinvite.unknown_sanction"),
              ),
            ],
          })
          .catch(() => {});
      }
      client.db.updateAntiraidConfig(message.guild.id, {
        antiCreateInvitePunishment: sanction,
      });
      return message
        .reply({
          embeds: [
            client.embedBuilder.success(
              client,
              message.t("commands.anticreateinvite.sanction_set", { sanction }),
            ),
          ],
        })
        .catch(() => {});
    }

    let newState;
    if (arg === "on") newState = 1;
    else if (arg === "off") newState = 0;
    else if (arg === "max") newState = 2;
    else newState = config.antiCreateInvite === 0 ? 1 : 0;

    if (
      config.antiCreateInvite === newState &&
      (arg === "on" || arg === "off")
    ) {
      return message
        .reply({
          embeds: [
            client.embedBuilder.warning(
              client,
              newState ? message.t("commands.anticreateinvite.already_enabled") : message.t("commands.anticreateinvite.already_disabled"),
            ),
          ],
        })
        .catch(() => {});
    }

    client.db.updateAntiraidConfig(message.guild.id, {
      antiCreateInvite: newState,
    });
    config = client.db.getAntiraidConfig(message.guild.id);

    const statusLabel = {
      0: message.t("commands.anticreateinvite.status_disabled"),
      1: message.t("commands.anticreateinvite.status_enabled"),
      2: message.t("commands.anticreateinvite.status_max"),
    }[newState];
    const helper = newState
      ? client.embedBuilder.success
      : client.embedBuilder.warning;
    const embed = helper(client, "")
      .setAuthor({
        name: "AntiCreateInvite",
        iconURL: client?.user?.displayAvatarURL?.({ size: 64 }),
      })
      .setDescription(null)
      .addFields(
        { name: message.t("commands.anticreateinvite.field_status"), value: statusLabel, inline: true },
        {
          name: message.t("commands.anticreateinvite.field_action"),
          value: `\`${config.antiCreateInvitePunishment || "mute"}\``,
          inline: true,
        },
        {
          name: message.t("commands.anticreateinvite.field_description"),
          value: message.t("commands.anticreateinvite.desc_text"),
          inline: false,
        },
      );

    message.reply({ embeds: [embed] }).catch(() => {});
  },
};
