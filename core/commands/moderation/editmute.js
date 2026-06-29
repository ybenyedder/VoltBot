const { PermissionFlagsBits } = require("discord.js");

const fmtDuration = (mss, message) => {
  let s = Math.floor(mss / 1000);
  const d = Math.floor(s / 86400);
  s -= d * 86400;
  const h = Math.floor(s / 3600);
  s -= h * 3600;
  const m = Math.floor(s / 60);
  s -= m * 60;
  const parts = [];
  if (d) parts.push(message.t("commands.editmute.unit_days", { d }));
  if (h) parts.push(message.t("commands.editmute.unit_hours", { h }));
  if (m) parts.push(message.t("commands.editmute.unit_minutes", { m }));
  if (!parts.length) parts.push(message.t("commands.editmute.unit_seconds", { s }));
  return parts.join(" ");
};

module.exports = {
  name: "editmute",
  description: "Modifie la durée d'un mute",
  category: "moderation",
  usage: "editmute",
  userPerms: [PermissionFlagsBits.ModerateMembers],
  botPerms: [PermissionFlagsBits.ModerateMembers],
  async execute(client, message, args) {
    if (!args[0] || !args[1]) {
      return message
        .reply({
          embeds: [
            client.embedBuilder.error(
              client,
              message.t("commands.editmute.missing_args"),
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
              message.t("commands.editmute.target_not_found"),
            ),
          ],
        })
        .catch(() => {});

    const duration = args[1];
    const timeMatch = duration.match(/^(\d+)([smhd])$/);
    if (!timeMatch) {
      return message
        .reply({
          embeds: [
            client.embedBuilder.error(
              client,
              message.t("commands.editmute.invalid_duration"),
            ),
          ],
        })
        .catch(() => {});
    }

    const [, amount, unit] = timeMatch;
    const multipliers = { s: 1000, m: 60000, h: 3600000, d: 86400000 };
    const durationMs = parseInt(amount) * multipliers[unit];

    try {
      await member.timeout(durationMs);

      const until = Math.floor((Date.now() + durationMs) / 1000);
      const embed = client.embedBuilder
        .success(client, "​")
        .setDescription(null)
        .setAuthor({
          name: message.t("commands.editmute.embed_title"),
          iconURL: member.user.displayAvatarURL({ size: 256 }),
        })
        .addFields(
          { name: message.t("commands.editmute.field_target"), value: `<@${member.id}>`, inline: true },
          {
            name: message.t("commands.editmute.field_moderator"),
            value: `<@${message.author.id}>`,
            inline: true,
          },
          { name: message.t("commands.editmute.field_duration"), value: fmtDuration(durationMs, message), inline: true },
          { name: message.t("commands.editmute.field_end"), value: `<t:${until}:R>`, inline: true },
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
                "EditMute",
                member.user,
                message.author,
                message.t("commands.editmute.log_new_duration", { duration: fmtDuration(durationMs, message) }),
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
              message.t("commands.editmute.failed"),
            ),
          ],
        })
        .catch(() => {});
    }
  },
};
