const { PermissionFlagsBits } = require("discord.js");

module.exports = {
  name: "antinewaccount",
  description: "Active/désactive la protection Anti-New Account",
  category: "antiraid",
  usage: "antinewaccount",
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
              message.t("commands.antinewaccount.admin_required"),
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
                message.t("commands.antinewaccount.unknown_sanction"),
              ),
            ],
          })
          .catch(() => {});
      }
      client.db.updateAntiraidConfig(message.guild.id, {
        antiNewAccountPunishment: sanction,
      });
      return message
        .reply({
          embeds: [
            client.embedBuilder.success(
              client,
              message.t("commands.antinewaccount.sanction_set", { sanction }),
            ),
          ],
        })
        .catch(() => {});
    }

    let newState;
    if (arg === "on") newState = 1;
    else if (arg === "off") newState = 0;
    else if (arg === "max") newState = 2;
    else newState = config.antiNewAccount === 0 ? 1 : 0;

    if (config.antiNewAccount === newState && (arg === "on" || arg === "off")) {
      return message
        .reply({
          embeds: [
            client.embedBuilder.warning(
              client,
              newState
                ? message.t("commands.antinewaccount.already_enabled")
                : message.t("commands.antinewaccount.already_disabled"),
            ),
          ],
        })
        .catch(() => {});
    }

    client.db.updateAntiraidConfig(message.guild.id, {
      antiNewAccount: newState,
    });
    config = client.db.getAntiraidConfig(message.guild.id);

    const statusLabel = {
      0: message.t("commands.antinewaccount.status_disabled"),
      1: message.t("commands.antinewaccount.status_enabled"),
      2: message.t("commands.antinewaccount.status_maximum"),
    }[newState];
    const helper = newState
      ? client.embedBuilder.success
      : client.embedBuilder.warning;
    const embed = helper(client, "")
      .setAuthor({
        name: "AntiNewAccount",
        iconURL: client?.user?.displayAvatarURL?.({ size: 64 }),
      })
      .setDescription(null)
      .addFields(
        { name: message.t("commands.antinewaccount.field_status"), value: statusLabel, inline: true },
        {
          name: message.t("commands.antinewaccount.field_action"),
          value: `\`${config.antiNewAccountPunishment || "kick"}\``,
          inline: true,
        },
        {
          name: message.t("commands.antinewaccount.field_threshold"),
          value: `\`${newState === 2 ? message.t("commands.antinewaccount.threshold_30") : message.t("commands.antinewaccount.threshold_7")}\``,
          inline: true,
        },
        {
          name: message.t("commands.antinewaccount.field_description"),
          value: message.t("commands.antinewaccount.desc_value"),
          inline: false,
        },
      );

    message.reply({ embeds: [embed] }).catch(() => {});
  },
};
