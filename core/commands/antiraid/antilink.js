const { PermissionFlagsBits } = require("discord.js");
const permissions = require("../../utils/permissions");
const {
  invalidateGuildCache,
} = require("../../events/handlers/automodHandler");

const CHANNEL_RE = /^(?:<#)?(\d{17,21})>?$/;

const parseChannelArgs = (message, tokens) => {
  const ids = [];
  for (const token of tokens) {
    const match = token.match(CHANNEL_RE);
    if (!match) continue;
    const id = match[1];
    if (message.guild.channels.cache.has(id) && !ids.includes(id)) {
      ids.push(id);
    }
  }
  return ids;
};

const readList = (config, key) => {
  try {
    const raw = config[key] ?? "[]";
    const json = Array.isArray(raw) ? JSON.stringify(raw) : raw;
    const parsed = JSON.parse(json === "" ? "[]" : json);
    return Array.isArray(parsed)
      ? parsed.filter((v) => typeof v === "string")
      : [];
  } catch (e) {
    return [];
  }
};

const mentionList = (ids) =>
  ids.length ? ids.map((id) => `<#${id}>`).join(" ") : "—";

const saveList = (message, key, value) => {
  message.client.db.updateAntiraidConfig(message.guild.id, {
    [key]: JSON.stringify(value),
  });
  invalidateGuildCache(message.guild.id);
};

module.exports = {
  name: "antilink",
  description: "Configure la protection contre les liens.",
  category: "antiraid",
  usage:
    "+antilink <on/off/max> / ignore <on/off/list/clear> [#salons] / only <#salons/off> / sanction <on/off> / type <invites/all>",
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
    const sub = args[0]?.toLowerCase();

    if (sub === "ignore") {
      const state = args[1]?.toLowerCase();
      const tokens = args.slice(2);

      if (!state || state === "list") {
        return sendStatusList(client, message, config);
      }

      if (
        state === "clear" ||
        (state === "off" && tokens[0]?.toLowerCase() === "all")
      ) {
        saveList(message, "antiLinkIgnoredChannels", []);
        return message
          .reply({
            embeds: [
              client.embedBuilder.success(
                client,
                message.t("commands.antilink.ignored_cleared"),
              ),
            ],
          })
          .catch(() => {});
      }

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

      const targets = parseChannelArgs(message, tokens);
      if (targets.length === 0) targets.push(message.channel.id);

      const ignored = readList(config, "antiLinkIgnoredChannels");
      const next =
        state === "on"
          ? Array.from(new Set([...ignored, ...targets]))
          : ignored.filter((id) => !targets.includes(id));

      saveList(message, "antiLinkIgnoredChannels", next);

      const key =
        state === "on"
          ? "commands.antilink.ignored_added"
          : "commands.antilink.ignored_removed";
      return message
        .reply({
          embeds: [
            client.embedBuilder.success(
              client,
              message.t(key, { channels: mentionList(targets) }),
            ),
          ],
        })
        .catch(() => {});
    }

    if (sub === "only") {
      const tokens = args.slice(1);
      const first = tokens[0]?.toLowerCase();

      if (first === "list") {
        return sendStatusList(client, message, config);
      }

      if (first === "off" || first === "all") {
        saveList(message, "antiLinkOnlyChannels", []);
        return message
          .reply({
            embeds: [
              client.embedBuilder.success(
                client,
                message.t("commands.antilink.only_off"),
              ),
            ],
          })
          .catch(() => {});
      }

      const targets = parseChannelArgs(message, tokens);
      if (targets.length === 0) {
        return message
          .reply({
            embeds: [
              client.embedBuilder.error(
                client,
                message.t("commands.antilink.usage_only", { prefix: client.config.prefix }),
              ),
            ],
          })
          .catch(() => {});
      }

      saveList(message, "antiLinkOnlyChannels", targets);
      return message
        .reply({
          embeds: [
            client.embedBuilder.success(
              client,
              message.t("commands.antilink.only_set", {
                channels: mentionList(targets),
              }),
            ),
          ],
        })
        .catch(() => {});
    }

    if (sub === "list") {
      return sendStatusList(client, message, config);
    }

    if (sub === "sanction") {
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
      invalidateGuildCache(message.guild.id);
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

    if (sub === "punish") {
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
      invalidateGuildCache(message.guild.id);
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

    if (sub === "type") {
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
      invalidateGuildCache(message.guild.id);
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

    const state = sub;
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
    invalidateGuildCache(message.guild.id);
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

async function sendStatusList(client, message, config) {
  const ignored = readList(config, "antiLinkIgnoredChannels");
  const only = readList(config, "antiLinkOnlyChannels");

  const modeLabel = only.length
    ? message.t("commands.antilink.list_mode_only")
    : message.t("commands.antilink.list_mode_all");

  const embed = client.embedBuilder
    .success(client, modeLabel)
    .setAuthor({
      name: "AntiLink",
      iconURL: client?.user?.displayAvatarURL?.({ size: 64 }),
    })
    .addFields(
      {
        name: message.t("commands.antilink.list_only"),
        value: mentionList(only),
        inline: false,
      },
      {
        name: message.t("commands.antilink.list_ignored"),
        value: mentionList(ignored),
        inline: false,
      },
    );

  return message.reply({ embeds: [embed] }).catch(() => {});
}
