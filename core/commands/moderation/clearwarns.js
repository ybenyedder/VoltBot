const { PermissionsBitField } = require("discord.js");
const permissions = require("../../utils/permissions");
const replyUtils = require("../../utils/replyUtils");
const sanctionUtils = require("../../utils/sanctionUtils");

const fmtNum = (n) => new Intl.NumberFormat("fr-FR").format(n);

module.exports = {
  name: "clearwarns",
  description: "Supprime tous les avertissements d'un membre.",
  category: "moderation",
  usage: "+clearwarns @user",
  userPerms: [PermissionsBitField.Flags.ManageMessages],
  async execute(client, message, args) {
    if (!permissions.isModerator(message, client))
      return replyUtils.sendEphemeralReply(message, {
        embeds: [client.embedBuilder.error(client, message.t("commands.clearwarns.no_permission"))],
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
              message.t("commands.clearwarns.target_not_found"),
            ),
          ],
        })
        .catch(() => {});

    const warns = client.db.getWarns(target.id, message.guild.id);
    if (!warns || warns.length === 0) {
      return message
        .reply({
          embeds: [
            client.embedBuilder.error(
              client,
              message.t("commands.clearwarns.no_warns"),
            ),
          ],
        })
        .catch(() => {});
    }

    client.db.clearWarns(target.id, message.guild.id);
    await sanctionUtils.sendSanctionLiftDm(
      client,
      target,
      message.guild,
      message.t("commands.clearwarns.action"),
      message.t("commands.clearwarns.lift_reason", { count: fmtNum(warns.length) }),
    );
    const ts = Math.floor(Date.now() / 1000);

    const embed = client.embedBuilder
      .success(client, "​")
      .setDescription(null)
      .setAuthor({
        name: message.t("commands.clearwarns.title"),
        iconURL: target.user.displayAvatarURL({ size: 256 }),
      })
      .addFields(
        { name: message.t("commands.clearwarns.field_target"), value: `<@${target.id}>`, inline: true },
        { name: message.t("commands.clearwarns.field_moderator"), value: `<@${message.author.id}>`, inline: true },
        { name: message.t("commands.clearwarns.field_cleared"), value: fmtNum(warns.length), inline: true },
        { name: message.t("commands.clearwarns.field_date"), value: `<t:${ts}:R>`, inline: true },
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
                message.t("commands.clearwarns.modlog_action"),
                target.user,
                message.author,
                message.t("commands.clearwarns.modlog_reason"),
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
