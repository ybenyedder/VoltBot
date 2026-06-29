const { PermissionFlagsBits } = require("discord.js");
const permissions = require("../../utils/permissions");

module.exports = {
  name: "antilink",
  description: "Configure la protection contre les liens.",
  category: "antiraid",
  usage:
    "+antilink <on/off/max> / ignore <on/off> / sanction <on/off> / type <invites/all>",
  userPerms: [PermissionFlagsBits.Administrator],
  botPerms: [PermissionFlagsBits.ManageMessages],
  async execute(client, message, args) {
    if (!permissions.isModerator(message, client))
      return message
        .reply({
          embeds: [
            client.embedBuilder.error(client, message.t("commands.antilink.no_perm")),
          ],
        })
        .catch(() => {});

    let config = client.db.getAntiraidConfig(message.guild.id);

    if (args[0] === "ignore") {
      const state = args[1];
      if (!["on", "off"].includes(state))
        return message
          .reply({
            embeds: [
              client.embedBuilder.error(
                client,
                message.t("commands.antilink.usage_ignore", { prefix: client.config.prefix }),
              ),
            ],
          })
          .catch(() => {});

      let ignored;
      try {
        const rawIgnored = config.antiLinkIgnoredChannels || "[]";
        ignored = JSON.parse(rawIgnored === "" ? "[]" : rawIgnored);
        if (!Array.isArray(ignored)) ignored = [];
      } catch (e) {
        ignored = [];
      }

      if (state === "on") {
        if (!ignored.includes(message.channel.id))
          ignored.push(message.channel.id);
      } else {
        ignored = ignored.filter((id) => id !== message.channel.id);
      }

      client.db.updateAntiraidConfig(message.guild.id, {
        antiLinkIgnoredChannels: JSON.stringify(ignored),
      });
      return message
        .reply({
          embeds: [
            client.embedBuilder.success(
              client,
              state === "on"
                ? message.t("commands.antilink.channel_ignored")
                : message.t("commands.antilink.channel_watched"),
            ),
          ],
        })
        .catch(() => {});
    }

    if (args[0] === "sanction") {
      const state = args[1];
      if (!["on", "off"].includes(state))
        return message
          .reply({
            embeds: [
              client.embedBuilder.error(
                client,
                message.t("commands.antilink.usage_sanction", { prefix: client.config.prefix }),
              ),
            ],
          })
          .catch(() => {});

      client.db.updateAntiraidConfig(message.guild.id, {
        antiLinkSanction: state === "on" ? 1 : 0,
      });
      return message
        .reply({
          embeds: [
            client.embedBuilder.success(
              client,
              state === "on"
                ? message.t("commands.antilink.autosanction_on")
                : message.t("commands.antilink.autosanction_off"),
            ),
          ],
        })
        .catch(() => {});
    }

    if (args[0] === "punish") {
      const sanction = args[1]?.toLowerCase();
      const valid = ["warn", "mute", "kick", "ban", "strip", "delete", "none"];
      if (!sanction || !valid.includes(sanction)) {
        return message
          .reply({
            embeds: [
              client.embedBuilder.error(
                client,
                message.t("commands.antilink.unknown_sanction"),
              ),
            ],
          })
          .catch(() => {});
      }
      client.db.updateAntiraidConfig(message.guild.id, {
        antiLinkPunishment: sanction,
      });
      return message
        .reply({
          embeds: [
            client.embedBuilder.success(
              client,
              message.t("commands.antilink.sanction_set", { sanction }),
            ),
          ],
        })
        .catch(() => {});
    }

    if (args[0] === "type") {
      const type = args[1];
      if (!["invites", "all"].includes(type))
        return message
          .reply({
            embeds: [
              client.embedBuilder.error(
                client,
                message.t("commands.antilink.usage_type", { prefix: client.config.prefix }),
              ),
            ],
          })
          .catch(() => {});

      client.db.updateAntiraidConfig(message.guild.id, { antiLinkType: type });
      return message
        .reply({
          embeds: [
            client.embedBuilder.success(
              client,
              type === "invites"
                ? message.t("commands.antilink.filter_invites")
                : message.t("commands.antilink.filter_all"),
            ),
          ],
        })
        .catch(() => {});
    }

    const state = args[0];
    if (!["on", "off", "max"].includes(state)) {
      return message
        .reply({
          embeds: [
            client.embedBuilder.error(
              client,
              message.t("commands.antilink.usage_main", { prefix: client.config.prefix }),
            ),
          ],
        })
        .catch(() => {});
    }

    const newState = state === "off" ? 0 : state === "max" ? 2 : 1;

    if (config.antiLink === newState && (state === "on" || state === "off")) {
      return message
        .reply({
          embeds: [
            client.embedBuilder.warning(
              client,
              newState
                ? message.t("commands.antilink.already_enabled")
                : message.t("commands.antilink.already_disabled"),
            ),
          ],
        })
        .catch(() => {});
    }

    client.db.updateAntiraidConfig(message.guild.id, { antiLink: newState });
    config = client.db.getAntiraidConfig(message.guild.id);

    const statusLabel = {
      0: message.t("commands.antilink.status_disabled"),
      1: message.t("commands.antilink.status_enabled"),
      2: message.t("commands.antilink.status_maximum"),
    }[newState];
    const helper = newState
      ? client.embedBuilder.success
      : client.embedBuilder.warning;
    const embed = helper(client, "")
      .setAuthor({
        name: "AntiLink",
        iconURL: client?.user?.displayAvatarURL?.({ size: 64 }),
      })
      .setDescription(null)
      .addFields(
        { name: message.t("commands.antilink.field_status"), value: statusLabel, inline: true },
        {
          name: message.t("commands.antilink.field_action"),
          value: `\`${config.antiLinkPunishment || "delete"}\``,
          inline: true,
        },
        {
          name: message.t("commands.antilink.field_type"),
          value: `\`${config.antiLinkType === "invites" ? "invites" : "all"}\``,
          inline: true,
        },
        {
          name: message.t("commands.antilink.field_description"),
          value: message.t("commands.antilink.desc_value"),
          inline: false,
        },
      );

    message.reply({ embeds: [embed] }).catch(() => {});
  },
};
