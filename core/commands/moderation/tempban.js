const { EmbedBuilder, PermissionFlagsBits } = require("discord.js");
const Logger = require("../../utils/logger");
const permissions = require("../../utils/permissions");
const sanctionUtils = require("../../utils/sanctionUtils");

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
  name: "tempban",
  description: "Banni temporairement un utilisateur",
  category: "moderation",
  usage: "+tempban @utilisateur <durée: 1m, 1h, 1d> [raison]",
  userPerms: [PermissionFlagsBits.BanMembers],
  botPerms: [PermissionFlagsBits.BanMembers],
  async execute(client, message, args) {
    if (!args[0] || !args[1]) {
      return message
        .reply({
          embeds: [
            client.embedBuilder.error(
              client,
              message.t("commands.tempban.args_missing"),
            ),
          ],
        })
        .catch(() => {});
    }

    const member =
      message.mentions.members.first() ||
      message.guild.members.cache.get(args[0]);
    if (!member)
      return message
        .reply({
          embeds: [
            client.embedBuilder.error(
              client,
              message.t("commands.tempban.target_not_found"),
            ),
          ],
        })
        .catch(() => {});

    const hierarchyError = permissions.checkHierarchy(
      message,
      member,
      client,
      "bannir temporairement",
    );
    if (hierarchyError)
      return message
        .reply({ embeds: [client.embedBuilder.error(client, hierarchyError)] })
        .catch(() => {});

    if (!member.bannable) {
      try {
        await message.guild.members.fetch({ user: member.id, force: true });
      } catch (_) {}
      const refreshed = message.guild.members.cache.get(member.id) || member;
      if (!refreshed.bannable) {
        const reason2 = require("../../utils/permissions").diagnoseBannable(
          message.guild,
          refreshed,
          message.lang,
        );
        return message
          .reply({
            embeds: [
              client.embedBuilder.error(client, message.t("commands.tempban.ban_impossible", { reason: reason2 })),
            ],
          })
          .catch(() => {});
      }
    }

    const duration = args[1];
    const timeMatch = duration.match(/^(\d+)([smhd])$/);
    if (!timeMatch) {
      return message
        .reply({
          embeds: [
            client.embedBuilder.error(
              client,
              message.t("commands.tempban.invalid_duration"),
            ),
          ],
        })
        .catch(() => {});
    }

    const [, amount, unit] = timeMatch;
    const multipliers = { s: 1000, m: 60000, h: 3600000, d: 86400000 };
    const durationMs = parseInt(amount) * multipliers[unit];

    const reason = args.slice(2).join(" ") || message.t("commands.tempban.no_reason");
    const guildId = message.guild.id;
    const memberId = member.id;
    const memberTag = member.user.tag;

    try {
      await sanctionUtils.sendSanctionDm(
        client,
        member,
        message.guild,
        message.t("commands.tempban.dm_action"),
        reason,
      );

      await message.guild.members.ban(member, {
        reason: `[TEMPBAN ${duration}] par ${message.author.tag} | ${reason}`,
      });

      const ts = Math.floor(Date.now() / 1000);
      const unbanAt = Math.floor((Date.now() + durationMs) / 1000);
      const embed = client.embedBuilder
        .success(client, "​")
        .setDescription(null)
        .setAuthor({
          name: message.t("commands.tempban.embed_author"),
          iconURL: member.user.displayAvatarURL({ size: 256 }),
        })
        .setThumbnail(member.user.displayAvatarURL({ size: 256 }))
        .addFields(
          { name: message.t("commands.tempban.field_target"), value: `<@${memberId}>`, inline: true },
          {
            name: message.t("commands.tempban.field_moderator"),
            value: `<@${message.author.id}>`,
            inline: true,
          },
          { name: message.t("commands.tempban.field_duration"), value: fmtDuration(durationMs), inline: true },
          { name: message.t("commands.tempban.field_end"), value: `<t:${unbanAt}:R>`, inline: true },
          { name: message.t("commands.tempban.field_date"), value: `<t:${ts}:R>`, inline: true },
          { name: message.t("commands.tempban.field_reason"), value: reason, inline: false },
        );

      await message.reply({ embeds: [embed] }).catch(() => {});

      // Log via la config du serveur
      const guildSettings = client.db.getGuild(guildId);
      const logChannelId =
        guildSettings.modLogsChannel || guildSettings.raidLogsChannel;
      if (logChannelId) {
        const logChannel = message.guild.channels.cache.get(logChannelId);
        if (logChannel) logChannel.send({ embeds: [embed] }).catch(() => {});
      }

      // Programmer l'unban automatique - capture guild and client reference
      const guild = message.guild;
      setTimeout(async () => {
        try {
          await guild.bans.remove(memberId, message.t("commands.tempban.audit_reason_auto_unban"));
          const user =
            (await client.users.fetch(memberId).catch(() => null)) ||
            member.user;
          await sanctionUtils.sendSanctionLiftDm(
            client,
            user,
            guild,
            message.t("commands.tempban.lift_action"),
            message.t("commands.tempban.lift_reason"),
          );
          Logger.info(
            `[TEMPBAN] ${memberTag} débanni automatiquement (${guildId})`,
          );

          if (logChannelId) {
            const logChannel = guild.channels.cache.get(logChannelId);
            if (logChannel) {
              const unbanEmbed = new EmbedBuilder()
                .setColor("#57F287")
                .setAuthor({ name: message.t("commands.tempban.auto_unban_title") })
                .addFields(
                  {
                    name: message.t("commands.tempban.field_target"),
                    value: `<@${memberId}>`,
                    inline: true,
                  },
                  {
                    name: message.t("commands.tempban.field_reason"),
                    value: message.t("commands.tempban.auto_unban_reason"),
                    inline: true,
                  },
                )
                .setTimestamp();
              logChannel.send({ embeds: [unbanEmbed] }).catch(() => {});
            }
          }
        } catch (error) {
          Logger.error(
            `[TEMPBAN] Erreur lors de l'unban automatique de ${memberTag}:`,
            error,
          );
        }
      }, durationMs);
    } catch (error) {
      message
        .reply({
          embeds: [
            client.embedBuilder.error(
              client,
              message.t("commands.tempban.failed"),
            ),
          ],
        })
        .catch(() => {});
    }
  },
};
