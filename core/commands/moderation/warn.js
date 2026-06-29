const { PermissionsBitField } = require("discord.js");
const permissions = require("../../utils/permissions");

module.exports = {
  name: "warn",
  aliases: ["avertir", "w"],
  description: "Avertit un membre du serveur.",
  category: "moderation",
  usage: "+warn @user [raison]",
  userPerms: [PermissionsBitField.Flags.ManageMessages],
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
              message.t("commands.warn.target_not_found"),
            ),
          ],
        })
        .catch(() => {});

    const hierarchyError = permissions.checkHierarchy(
      message,
      target,
      client,
      "avertir",
    );
    if (hierarchyError)
      return message
        .reply({ embeds: [client.embedBuilder.error(client, hierarchyError)] })
        .catch(() => {});

    const reason = args.slice(1).join(" ") || message.t("commands.warn.no_reason");
    const ts = Math.floor(Date.now() / 1000);

    client.db.addWarn(target.id, message.guild.id, message.author.id, reason);

    const sanctionUtils = require("../../utils/sanctionUtils");
    await sanctionUtils.sendSanctionDm(
      client,
      target,
      message.guild,
      "averti(e)",
      reason,
    );

    const embed = client.embedBuilder
      .success(client, "​")
      .setDescription(null)
      .setAuthor({
        name: message.t("commands.warn.title"),
        iconURL: target.user.displayAvatarURL({ size: 256 }),
      })
      .setThumbnail(target.user.displayAvatarURL({ size: 256 }))
      .addFields(
        { name: message.t("commands.warn.field_target"), value: `<@${target.id}>`, inline: true },
        { name: message.t("commands.warn.field_moderator"), value: `<@${message.author.id}>`, inline: true },
        { name: message.t("commands.warn.field_date"), value: `<t:${ts}:R>`, inline: true },
        { name: message.t("commands.warn.field_reason"), value: reason, inline: false },
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
                "Warn",
                target.user,
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
