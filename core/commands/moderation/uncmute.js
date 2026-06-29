const { PermissionFlagsBits } = require("discord.js");
const sanctionUtils = require("../../utils/sanctionUtils");

module.exports = {
  name: "uncmute",
  description: "Unmute un utilisateur en vocal uniquement",
  category: "moderation",
  usage: "uncmute",
  userPerms: [PermissionFlagsBits.MuteMembers],
  botPerms: [PermissionFlagsBits.MuteMembers],
  async execute(client, message, args) {
    if (!args[0]) {
      return message
        .reply({
          embeds: [
            client.embedBuilder.error(
              client,
              message.t("commands.uncmute.missing_target"),
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
              message.t("commands.uncmute.target_not_found"),
            ),
          ],
        })
        .catch(() => {});

    const reason = args.slice(1).join(" ") || message.t("commands.uncmute.no_reason");
    const ts = Math.floor(Date.now() / 1000);

    try {
      await member.voice.setMute(false);
      await sanctionUtils.sendSanctionLiftDm(
        client,
        member,
        message.guild,
        "mute vocal",
        reason,
      );

      const embed = client.embedBuilder
        .success(client, "​")
        .setDescription(null)
        .setAuthor({
          name: message.t("commands.uncmute.unmute_voice_title"),
          iconURL: member.user.displayAvatarURL({ size: 256 }),
        })
        .addFields(
          { name: message.t("commands.uncmute.field_target"), value: `<@${member.id}>`, inline: true },
          {
            name: message.t("commands.uncmute.field_moderator"),
            value: `<@${message.author.id}>`,
            inline: true,
          },
          { name: message.t("commands.uncmute.field_date"), value: `<t:${ts}:R>`, inline: true },
          { name: message.t("commands.uncmute.field_reason"), value: reason, inline: false },
        );

      await message.reply({ embeds: [embed] }).catch(() => {});

      const guildSettings = client.db.getGuild(message.guild.id);
      if (guildSettings.modLogsChannel) {
        const logChannel = message.guild.channels.cache.get(
          guildSettings.modLogsChannel,
        );
        if (logChannel)
          logChannel
            .send({
              embeds: [
                client.embedBuilder.modLog(
                  client,
                  message.t("commands.uncmute.modlog_action"),
                  member.user,
                  message.author,
                  reason,
                  message.lang,
                ),
              ],
            })
            .catch(() => {});
      }
    } catch (error) {
      await message
        .reply({
          embeds: [
            client.embedBuilder.error(
              client,
              message.t("commands.uncmute.unmute_voice_failed"),
            ),
          ],
        })
        .catch(() => {});
    }
  },
};
