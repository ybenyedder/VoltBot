const { PermissionsBitField } = require("discord.js");
const permissions = require("../../utils/permissions");
const replyUtils = require("../../utils/replyUtils");

module.exports = {
  name: "ban",
  aliases: ["b", "punaise", "bannir"],
  description: "Bannit un membre du serveur.",
  category: "moderation",
  usage: "+ban @user [raison]",
  userPerms: [PermissionsBitField.Flags.BanMembers],
  botPerms: [PermissionsBitField.Flags.BanMembers],
  async execute(client, message, args) {
    if (!permissions.isModerator(message, client)) {
      return replyUtils.sendEphemeralReply(message, {
        embeds: [
          client.embedBuilder.error(
            client,
            message.t("commands.ban.permission_denied"),
          ),
        ],
      });
    }

    const targetId = args[0]?.replace(/[<@!>]/g, "");
    if (!targetId) {
      return replyUtils.sendEphemeralReply(message, {
        embeds: [
          client.embedBuilder.error(
            client,
            message.t("commands.ban.missing_target"),
          ),
        ],
      });
    }
    if (!/^\d{17,19}$/.test(targetId)) {
      return replyUtils.sendEphemeralReply(message, {
        embeds: [
          client.embedBuilder.error(
            client,
            message.t("commands.ban.invalid_id"),
          ),
        ],
      });
    }

    const member =
      message.mentions.members.first() ||
      message.guild.members.cache.get(targetId);
    const reason =
      args.slice(1).join(" ") || message.t("commands.ban.no_reason");
    const ts = Math.floor(Date.now() / 1000);

    let bannedUser = null;
    let banType = "Member";

    if (member) {
      const hierarchyError = permissions.checkHierarchy(
        message,
        member,
        client,
        "bannir",
      );
      if (hierarchyError) {
        return replyUtils.sendEphemeralReply(message, {
          embeds: [client.embedBuilder.error(client, hierarchyError)],
        });
      }

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
          return replyUtils.sendEphemeralReply(message, {
            embeds: [
              client.embedBuilder.error(
                client,
                message.t("commands.ban.ban_impossible", { reason: reason2 }),
              ),
            ],
          });
        }
      }

      const sanctionUtils = require("../../utils/sanctionUtils");
      await sanctionUtils.sendSanctionDm(
        client,
        member,
        message.guild,
        "banni(e)",
        reason,
      );
      await member.ban({
        reason: message.t("commands.ban.audit_reason", {
          mod: message.author.tag,
          reason,
        }),
      });

      const embed = client.embedBuilder
        .success(client, "​")
        .setDescription(null)
        .setAuthor({
          name: message.t("commands.ban.embed_title"),
          iconURL: member.user.displayAvatarURL({ size: 256 }),
        })
        .setThumbnail(member.user.displayAvatarURL({ size: 256 }))
        .addFields(
          {
            name: message.t("commands.ban.field_target"),
            value: `<@${member.id}>`,
            inline: true,
          },
          {
            name: message.t("commands.ban.field_moderator"),
            value: `<@${message.author.id}>`,
            inline: true,
          },
          {
            name: message.t("commands.ban.field_date"),
            value: `<t:${ts}:R>`,
            inline: true,
          },
          {
            name: message.t("commands.ban.field_reason"),
            value: reason,
            inline: false,
          },
        );
      await message.reply({ embeds: [embed] }).catch(() => {});
      bannedUser = member.user;
    } else {
      try {
        await message.guild.bans.create(targetId, {
          reason: message.t("commands.ban.audit_reason_id", {
            mod: message.author.tag,
            reason,
          }),
        });
        const embed = client.embedBuilder
          .success(client, "​")
          .setDescription(null)
          .setAuthor({ name: message.t("commands.ban.embed_title_id") })
          .addFields(
            {
              name: message.t("commands.ban.field_target"),
              value: `<@${targetId}>`,
              inline: true,
            },
            {
              name: message.t("commands.ban.field_moderator"),
              value: `<@${message.author.id}>`,
              inline: true,
            },
            {
              name: message.t("commands.ban.field_date"),
              value: `<t:${ts}:R>`,
              inline: true,
            },
            {
              name: message.t("commands.ban.field_reason"),
              value: reason,
              inline: false,
            },
          );
        await message.reply({ embeds: [embed] }).catch(() => {});
        bannedUser = { id: targetId, tag: `ID: ${targetId}` };
        banType = "ID";
      } catch (e) {
        return replyUtils.sendEphemeralReply(message, {
          embeds: [
            client.embedBuilder.error(
              client,
              message.t("commands.ban.ban_impossible_id"),
            ),
          ],
        });
      }
    }

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
                message.t("commands.ban.modlog_action", { type: banType }),
                bannedUser,
                message.author,
                reason,
                [],
                message.lang,
              ),
            ],
          })
          .catch(() => {});
      }
    }
  },
};
