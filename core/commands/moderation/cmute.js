const { PermissionFlagsBits } = require("discord.js");

module.exports = {
  name: "cmute",
  description: "Mute un utilisateur en vocal uniquement",
  category: "moderation",
  usage: "cmute",
  userPerms: [PermissionFlagsBits.MuteMembers],
  botPerms: [PermissionFlagsBits.MuteMembers],
  async execute(client, message, args) {
    if (!args[0]) {
      return message
        .reply({
          embeds: [
            client.embedBuilder.error(
              client,
              message.t("commands.cmute.missing_target"),
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
              message.t("commands.cmute.target_not_found"),
            ),
          ],
        })
        .catch(() => {});

    if (!member.voice.channel) {
      return message
        .reply({
          embeds: [client.embedBuilder.error(client, message.t("commands.cmute.not_in_voice"))],
        })
        .catch(() => {});
    }

    if (member.permissions.has(PermissionFlagsBits.Administrator)) {
      return message
        .reply({
          embeds: [
            client.embedBuilder.error(
              client,
              message.t("commands.cmute.cannot_admin"),
            ),
          ],
        })
        .catch(() => {});
    }

    const reason = args.slice(1).join(" ") || message.t("commands.cmute.no_reason");
    const ts = Math.floor(Date.now() / 1000);

    try {
      await member.voice.setMute(true);

      const embed = client.embedBuilder
        .success(client, "​")
        .setDescription(null)
        .setAuthor({
          name: message.t("commands.cmute.title"),
          iconURL: member.user.displayAvatarURL({ size: 256 }),
        })
        .addFields(
          { name: message.t("commands.cmute.field_target"), value: `<@${member.id}>`, inline: true },
          {
            name: message.t("commands.cmute.field_moderator"),
            value: `<@${message.author.id}>`,
            inline: true,
          },
          {
            name: message.t("commands.cmute.field_channel"),
            value: `<#${member.voice.channel.id}>`,
            inline: true,
          },
          { name: message.t("commands.cmute.field_date"), value: `<t:${ts}:R>`, inline: true },
          { name: message.t("commands.cmute.field_reason"), value: reason, inline: false },
        );

      await message.reply({ embeds: [embed] }).catch(() => {});

      const logChannelId = client.db.getGuild(message.guild.id).modLogsChannel;
      const logChannel = logChannelId
        ? message.guild.channels.cache.get(logChannelId)
        : null;
      if (logChannel) {
        logChannel
          .send({
            embeds: [
              client.embedBuilder.modLog(
                client,
                message.t("commands.cmute.modlog_action"),
                member.user,
                message.author,
                reason,
                [],
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
              message.t("commands.cmute.failed"),
            ),
          ],
        })
        .catch(() => {});
    }
  },
};
