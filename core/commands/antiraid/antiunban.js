const { PermissionFlagsBits } = require("discord.js");

module.exports = {
  name: "antiunban",
  description: "Active/désactive la protection Anti-Unban",
  category: "antiraid",
  usage: "antiunban",
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
              message.t("commands.antiunban.admin_required"),
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
                message.t("commands.antiunban.unknown_sanction"),
              ),
            ],
          })
          .catch(() => {});
      }
      client.db.updateAntiraidConfig(message.guild.id, {
        antiUnbanPunishment: sanction,
      });
      return message
        .reply({
          embeds: [
            client.embedBuilder.success(
              client,
              message.t("commands.antiunban.sanction_set", { sanction }),
            ),
          ],
        })
        .catch(() => {});
    }

    let newState;
    if (arg === "on") newState = 1;
    else if (arg === "off") newState = 0;
    else if (arg === "max") newState = 2;
    else newState = config.antiUnban === 0 ? 1 : 0;

    if (config.antiUnban === newState && (arg === "on" || arg === "off")) {
      return message
        .reply({
          embeds: [
            client.embedBuilder.warning(
              client,
              newState
                ? message.t("commands.antiunban.already_enabled")
                : message.t("commands.antiunban.already_disabled"),
            ),
          ],
        })
        .catch(() => {});
    }

    client.db.updateAntiraidConfig(message.guild.id, { antiUnban: newState });
    config = client.db.getAntiraidConfig(message.guild.id);

    const statusLabel = {
      0: message.t("commands.antiunban.status_disabled"),
      1: message.t("commands.antiunban.status_enabled"),
      2: message.t("commands.antiunban.status_max"),
    }[newState];
    const helper = newState
      ? client.embedBuilder.success
      : client.embedBuilder.warning;
    const embed = helper(client, "")
      .setAuthor({
        name: "AntiUnban",
        iconURL: client?.user?.displayAvatarURL?.({ size: 64 }),
      })
      .setDescription(null)
      .addFields(
        {
          name: message.t("commands.antiunban.field_status"),
          value: statusLabel,
          inline: true,
        },
        {
          name: message.t("commands.antiunban.field_action"),
          value: `\`${config.antiUnbanPunishment || "ban"}\``,
          inline: true,
        },
        {
          name: message.t("commands.antiunban.field_description"),
          value: message.t("commands.antiunban.desc_text"),
          inline: false,
        },
      );

    message.reply({ embeds: [embed] }).catch(() => {});
  },
};
