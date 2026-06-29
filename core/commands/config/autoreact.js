const { PermissionFlagsBits, ChannelType } = require("discord.js");

const CUSTOM_EMOJI_RE = /^<a?:\w+:\d+>$/;
const UNICODE_EMOJI_RE = /\p{Extended_Pictographic}/u;

const isValidEmoji = (s) => CUSTOM_EMOJI_RE.test(s) || UNICODE_EMOJI_RE.test(s);

module.exports = {
  name: "autoreact",
  aliases: ["autoreactions", "autoreaction"],
  description:
    "Ajoute des réactions automatiques aux messages d'un salon (suggestions, art, etc.).",
  category: "config",
  usage:
    "+autoreact <add|remove|list|clear> [#salon] [emoji1 emoji2 ...]",
  userPerms: [PermissionFlagsBits.Administrator],
  botPerms: [PermissionFlagsBits.AddReactions],
  async execute(client, message, args) {
    const action = (args[0] || "").toLowerCase();

    if (action === "list") {
      const rows = client.db.db
        .prepare(
          "SELECT channelId, emojis FROM autoreact_channels WHERE guildId = ?",
        )
        .all(message.guild.id);

      const embed = client.embedBuilder
        .base(client, message.t("commands.autoreact.title"), null)
        .addFields({
          name: message.t("commands.autoreact.field_total"),
          value: `**${rows.length}**`,
          inline: true,
        });

      if (rows.length) {
        const list = rows
          .map((r) => {
            const emojis = JSON.parse(r.emojis).join(" ");
            return `<#${r.channelId}> — ${emojis}`;
          })
          .join("\n")
          .slice(0, 1024);
        embed.addFields({ name: message.t("commands.autoreact.field_channels"), value: list, inline: false });
      } else {
        embed.setDescription(message.t("commands.autoreact.none_configured"));
      }
      return message.reply({ embeds: [embed] }).catch(() => {});
    }

    if (action === "clear") {
      const channel = message.mentions.channels.first();
      if (!channel) {
        return message
          .reply({
            embeds: [
              client.embedBuilder.error(client, message.t("commands.autoreact.mention_channel_clear")),
            ],
          })
          .catch(() => {});
      }
      const res = client.db.db
        .prepare(
          "DELETE FROM autoreact_channels WHERE guildId = ? AND channelId = ?",
        )
        .run(message.guild.id, channel.id);
      return message
        .reply({
          embeds: [
            client.embedBuilder
              .success(
                client,
                res.changes
                  ? message.t("commands.autoreact.reactions_removed")
                  : message.t("commands.autoreact.channel_not_configured"),
              )
              .addFields({
                name: message.t("commands.autoreact.field_channel"),
                value: `${channel}`,
                inline: true,
              }),
          ],
        })
        .catch(() => {});
    }

    if (action === "add" || action === "remove") {
      const channel =
        message.mentions.channels.first() ||
        (args[1] && /^\d{17,20}$/.test(args[1])
          ? message.guild.channels.cache.get(args[1])
          : null);
      if (!channel || channel.type !== ChannelType.GuildText) {
        return message
          .reply({
            embeds: [
              client.embedBuilder.error(
                client,
                message.t("commands.autoreact.mention_valid_text_channel"),
              ),
            ],
          })
          .catch(() => {});
      }

      const emojis = args
        .slice(2)
        .filter((a) => !a.startsWith("<#") && !/^\d{17,20}$/.test(a))
        .filter(isValidEmoji);

      if (emojis.length === 0) {
        return message
          .reply({
            embeds: [
              client.embedBuilder.error(
                client,
                message.t("commands.autoreact.give_valid_emoji"),
              ),
            ],
          })
          .catch(() => {});
      }
      if (emojis.length > 5) {
        return message
          .reply({
            embeds: [
              client.embedBuilder.error(client, message.t("commands.autoreact.max_emojis")),
            ],
          })
          .catch(() => {});
      }

      const existing = client.db.db
        .prepare(
          "SELECT emojis FROM autoreact_channels WHERE guildId = ? AND channelId = ?",
        )
        .get(message.guild.id, channel.id);
      const current = existing ? JSON.parse(existing.emojis) : [];

      let next;
      if (action === "add") {
        next = [...new Set([...current, ...emojis])].slice(0, 5);
      } else {
        next = current.filter((e) => !emojis.includes(e));
      }

      if (next.length === 0) {
        client.db.db
          .prepare(
            "DELETE FROM autoreact_channels WHERE guildId = ? AND channelId = ?",
          )
          .run(message.guild.id, channel.id);
      } else {
        client.db.db
          .prepare(
            `INSERT INTO autoreact_channels (guildId, channelId, emojis, createdBy)
             VALUES (?, ?, ?, ?)
             ON CONFLICT(guildId, channelId) DO UPDATE SET emojis = excluded.emojis`,
          )
          .run(
            message.guild.id,
            channel.id,
            JSON.stringify(next),
            message.author.id,
          );
      }

      return message
        .reply({
          embeds: [
            client.embedBuilder
              .success(
                client,
                action === "add"
                  ? message.t("commands.autoreact.reactions_updated")
                  : message.t("commands.autoreact.emojis_removed"),
              )
              .addFields(
                { name: message.t("commands.autoreact.field_channel"), value: `${channel}`, inline: true },
                {
                  name: message.t("commands.autoreact.field_emojis"),
                  value: next.length ? next.join(" ") : message.t("commands.autoreact.value_none"),
                  inline: false,
                },
              ),
          ],
        })
        .catch(() => {});
    }

    const helpEmbed = client.embedBuilder
      .base(client, message.t("commands.autoreact.title"), null)
      .addFields(
        {
          name: message.t("commands.autoreact.field_subcommands"),
          value: [
            "`+autoreact add <#salon> <emoji1> [emoji2…]`",
            "`+autoreact remove <#salon> <emoji>`",
            "`+autoreact clear <#salon>`",
            "`+autoreact list`",
          ].join("\n"),
        },
        { name: message.t("commands.autoreact.field_limit"), value: message.t("commands.autoreact.limit_value"), inline: true },
      );
    return message.reply({ embeds: [helpEmbed] }).catch(() => {});
  },
};
