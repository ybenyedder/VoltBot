const { PermissionFlagsBits } = require("discord.js");
const permissions = require("../../utils/permissions");

module.exports = {
  name: "antirank",
  description: "Empêche l'attribution de rôles non autorisée.",
  category: "antiraid",
  usage: "+antirank <on/off/max> / type <danger/all>",
  userPerms: [PermissionFlagsBits.Administrator],
  botPerms: [PermissionFlagsBits.ManageRoles],
  async execute(client, message, args) {
    if (!permissions.isModerator(message, client))
      return message
        .reply({
          embeds: [
            client.embedBuilder.error(client, message.t("commands.antirank.no_perm")),
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
                message.t("commands.antirank.unknown_sanction"),
              ),
            ],
          })
          .catch(() => {});
      }
      client.db.updateAntiraidConfig(message.guild.id, {
        antiRankPunishment: sanction,
      });
      return message
        .reply({
          embeds: [
            client.embedBuilder.success(
              client,
              message.t("commands.antirank.sanction_set", { sanction }),
            ),
          ],
        })
        .catch(() => {});
    }

    if (arg === "type") {
      const type = args[1]?.toLowerCase();
      if (!["danger", "all"].includes(type))
        return message
          .reply({
            embeds: [
              client.embedBuilder.error(
                client,
                message.t("commands.antirank.usage_type", { prefix: client.config.prefix }),
              ),
            ],
          })
          .catch(() => {});

      client.db.updateAntiraidConfig(message.guild.id, { antiRankType: type });
      return message
        .reply({
          embeds: [
            client.embedBuilder.success(
              client,
              type === "danger"
                ? message.t("commands.antirank.target_danger")
                : message.t("commands.antirank.target_all"),
            ),
          ],
        })
        .catch(() => {});
    }

    let newState;
    if (arg === "on") newState = 1;
    else if (arg === "off") newState = 0;
    else if (arg === "max") newState = 2;
    else newState = config.antiRank === 0 ? 1 : 0;

    if (config.antiRank === newState && (arg === "on" || arg === "off")) {
      return message
        .reply({
          embeds: [
            client.embedBuilder.warning(
              client,
              newState
                ? message.t("commands.antirank.already_enabled")
                : message.t("commands.antirank.already_disabled"),
            ),
          ],
        })
        .catch(() => {});
    }

    client.db.updateAntiraidConfig(message.guild.id, { antiRank: newState });
    config = client.db.getAntiraidConfig(message.guild.id);

    const statusLabel = {
      0: message.t("commands.antirank.status_disabled"),
      1: message.t("commands.antirank.status_enabled"),
      2: message.t("commands.antirank.status_maximum"),
    }[newState];
    const helper = newState
      ? client.embedBuilder.success
      : client.embedBuilder.warning;
    const embed = helper(client, "")
      .setAuthor({
        name: "AntiRank",
        iconURL: client?.user?.displayAvatarURL?.({ size: 64 }),
      })
      .setDescription(null)
      .addFields(
        { name: message.t("commands.antirank.field_status"), value: statusLabel, inline: true },
        {
          name: message.t("commands.antirank.field_action"),
          value: `\`${config.antiRankPunishment || "strip"}\``,
          inline: true,
        },
        {
          name: message.t("commands.antirank.field_target"),
          value:
            config.antiRankType === "danger"
              ? message.t("commands.antirank.target_value_sensitive")
              : message.t("commands.antirank.target_value_all"),
          inline: true,
        },
        {
          name: message.t("commands.antirank.field_description"),
          value: message.t("commands.antirank.desc_value"),
          inline: false,
        },
      );

    message.reply({ embeds: [embed] }).catch(() => {});
  },
};
