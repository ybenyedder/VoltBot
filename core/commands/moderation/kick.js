const { PermissionsBitField } = require("discord.js");
const permissions = require("../../utils/permissions");
const replyUtils = require("../../utils/replyUtils");

module.exports = {
  name: "kick",
  aliases: ["k", "expulser", "eject"],
  description: "Expulse un membre du serveur.",
  category: "moderation",
  usage: "+kick @user [raison]",
  userPerms: [PermissionsBitField.Flags.KickMembers],
  botPerms: [PermissionsBitField.Flags.KickMembers],
  async execute(client, message, args) {
    if (!permissions.isModerator(message, client))
      return replyUtils.sendEphemeralReply(message, {
        embeds: [client.embedBuilder.error(client, message.t("commands.kick.permission_denied"))],
      });

    const target =
      message.mentions.members.first() ||
      message.guild.members.cache.get(args[0]);
    if (!target)
      return message
        .reply({
          embeds: [
            client.embedBuilder.error(
              client,
              message.t("commands.kick.target_not_found"),
            ),
          ],
        })
        .catch(() => {});

    const hierarchyError = permissions.checkHierarchy(
      message,
      target,
      client,
      "expulser",
    );
    if (hierarchyError)
      return message
        .reply({ embeds: [client.embedBuilder.error(client, hierarchyError)] })
        .catch(() => {});

    if (!target.kickable) {
      try {
        await message.guild.members.fetch({ user: target.id, force: true });
      } catch (_) {}
      const refreshed = message.guild.members.cache.get(target.id) || target;
      if (!refreshed.kickable) {
        const reason = require("../../utils/permissions").diagnoseKickable(
          message.guild,
          refreshed,
          message.lang,
        );
        return message
          .reply({
            embeds: [
              client.embedBuilder.error(client, message.t("commands.kick.kick_impossible", { reason })),
            ],
          })
          .catch(() => {});
      }
    }

    const reason = args.slice(1).join(" ") || message.t("commands.kick.no_reason");
    const ts = Math.floor(Date.now() / 1000);

    const sanctionUtils = require("../../utils/sanctionUtils");
    await sanctionUtils.sendSanctionDm(
      client,
      target,
      message.guild,
      message.t("commands.kick.action"),
      reason,
    );
    await target.kick(message.t("commands.kick.audit_reason", { mod: message.author.tag, reason }));

    const embed = client.embedBuilder
      .success(client, "​")
      .setDescription(null)
      .setAuthor({
        name: message.t("commands.kick.title"),
        iconURL: target.user.displayAvatarURL({ size: 256 }),
      })
      .setThumbnail(target.user.displayAvatarURL({ size: 256 }))
      .addFields(
        { name: message.t("commands.kick.field_target"), value: `<@${target.id}>`, inline: true },
        { name: message.t("commands.kick.field_moderator"), value: `<@${message.author.id}>`, inline: true },
        { name: message.t("commands.kick.field_date"), value: `<t:${ts}:R>`, inline: true },
        { name: message.t("commands.kick.field_reason"), value: reason, inline: false },
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
                "Kick",
                target.user,
                message.author,
                reason,
                message.lang,
              ),
            ],
          })
          .catch(() => {});
      }
    }
  },
};
