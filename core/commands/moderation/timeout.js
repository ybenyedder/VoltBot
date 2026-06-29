const { PermissionsBitField } = require("discord.js");
const permissions = require("../../utils/permissions");
const ms = require("ms");

const fmtDuration = (mss) => {
  let s = Math.floor(mss / 1000);
  const d = Math.floor(s / 86400);
  s -= d * 86400;
  const h = Math.floor(s / 3600);
  s -= h * 3600;
  const m = Math.floor(s / 60);
  s -= m * 60;
  const parts = [];
  if (d) parts.push(`${d} j`);
  if (h) parts.push(`${h} h`);
  if (m) parts.push(`${m} min`);
  if (!parts.length) parts.push(`${s} s`);
  return parts.join(" ");
};

module.exports = {
  name: "timeout",
  description: "Exclut temporairement (timeout) un membre du serveur.",
  category: "moderation",
  usage: "+timeout @user [durée: 10m, 1h...] [raison]",
  userPerms: [PermissionsBitField.Flags.ModerateMembers],
  botPerms: [PermissionsBitField.Flags.ModerateMembers],
  async execute(client, message, args) {
    const target =
      message.mentions.members.first() ||
      message.guild.members.cache.get(args[0]);
    if (!target)
      return message
        .reply({
          embeds: [
            client.embedBuilder.error(
              client,
              message.t("commands.timeout.target_not_found"),
            ),
          ],
        })
        .catch(() => {});

    const hierarchyError = permissions.checkHierarchy(
      message,
      target,
      client,
      "timeout",
    );
    if (hierarchyError)
      return message
        .reply({ embeds: [client.embedBuilder.error(client, hierarchyError)] })
        .catch(() => {});

    if (!target.moderatable) {
      try {
        await message.guild.members.fetch({ user: target.id, force: true });
      } catch (_) {}
      const refreshed = message.guild.members.cache.get(target.id) || target;
      if (!refreshed.moderatable) {
        const reason2 = require("../../utils/permissions").diagnoseModeratable(
          message.guild,
          refreshed,
          message.lang,
        );
        return message
          .reply({
            embeds: [
              client.embedBuilder.error(client, message.t("commands.timeout.timeout_impossible", { reason: reason2 })),
            ],
          })
          .catch(() => {});
      }
    }

    const time = args[1];
    if (!time)
      return message
        .reply({
          embeds: [
            client.embedBuilder.error(
              client,
              message.t("commands.timeout.duration_missing"),
            ),
          ],
        })
        .catch(() => {});

    const duration = ms(time);
    if (!duration || duration < 10000 || duration > 2419200000) {
      return message
        .reply({
          embeds: [
            client.embedBuilder.error(
              client,
              message.t("commands.timeout.duration_out_of_range"),
            ),
          ],
        })
        .catch(() => {});
    }

    const reason = args.slice(2).join(" ") || message.t("commands.timeout.no_reason");
    const ts = Math.floor(Date.now() / 1000);
    const until = Math.floor((Date.now() + duration) / 1000);

    await target.timeout(
      duration,
      `Timeout par ${message.author.tag} | Raison : ${reason}`,
    );

    const embed = client.embedBuilder
      .success(client, "​")
      .setDescription(null)
      .setAuthor({
        name: message.t("commands.timeout.embed_author"),
        iconURL: target.user.displayAvatarURL({ size: 256 }),
      })
      .setThumbnail(target.user.displayAvatarURL({ size: 256 }))
      .addFields(
        { name: message.t("commands.timeout.field_target"), value: `<@${target.id}>`, inline: true },
        { name: message.t("commands.timeout.field_moderator"), value: `<@${message.author.id}>`, inline: true },
        { name: message.t("commands.timeout.field_duration"), value: fmtDuration(duration), inline: true },
        { name: message.t("commands.timeout.field_end"), value: `<t:${until}:R>`, inline: true },
        { name: message.t("commands.timeout.field_date"), value: `<t:${ts}:R>`, inline: true },
        { name: message.t("commands.timeout.field_reason"), value: reason, inline: false },
      );
    await message.reply({ embeds: [embed] }).catch(() => {});

    const guildSettings = client.db.getGuild(message.guild.id);
    if (guildSettings.modLogsChannel) {
      const logChannel = message.guild.channels.cache.get(
        guildSettings.modLogsChannel,
      );
      if (logChannel) {
        logChannel
          .send({
            embeds: [
              client.embedBuilder.modLog(
                client,
                "Timeout",
                target.user,
                message.author,
                reason,
                [{ name: message.t("commands.timeout.field_duration"), value: fmtDuration(duration), inline: true }],
                message.lang,
              ),
            ],
          })
          .catch(() => {});
      }
    }
  },
};
