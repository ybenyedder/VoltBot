const { PermissionFlagsBits } = require("discord.js");

module.exports = {
  name: "baninfo",
  description: "Affiche des informations sur un bannissement",
  category: "moderation",
  usage: "baninfo",
  userPerms: [PermissionFlagsBits.BanMembers],
  async execute(client, message, args) {
    if (!args[0]) {
      return message
        .reply({
          embeds: [
            client.embedBuilder.error(
              client,
              message.t("commands.baninfo.missing_target"),
            ),
          ],
        })
        .catch(() => {});
    }

    const userId = args[0].replace(/[<@!>]/g, "");
    if (!/^\d{17,19}$/.test(userId)) {
      return message
        .reply({
          embeds: [
            client.embedBuilder.error(
              client,
              message.t("commands.baninfo.invalid_id"),
            ),
          ],
        })
        .catch(() => {});
    }

    try {
      const ban = await message.guild.bans.fetch(userId);
      const ts = ban.createdTimestamp
        ? Math.floor(ban.createdTimestamp / 1000)
        : null;
      const embed = client.embedBuilder
        .base(
          client,
          message.t("commands.baninfo.title", { tag: ban.user.tag }),
          null,
        )
        .setThumbnail(ban.user.displayAvatarURL({ size: 256 }))
        .addFields(
          {
            name: message.t("commands.baninfo.field_target"),
            value: `<@${ban.user.id}>`,
            inline: true,
          },
          {
            name: message.t("commands.baninfo.field_id"),
            value: `\`${ban.user.id}\``,
            inline: true,
          },
          {
            name: message.t("commands.baninfo.field_date"),
            value: ts ? `<t:${ts}:f>` : message.t("commands.baninfo.unknown"),
            inline: true,
          },
          {
            name: message.t("commands.baninfo.field_reason"),
            value: ban.reason || message.t("commands.baninfo.no_reason"),
            inline: false,
          },
        );

      await message.reply({ embeds: [embed] }).catch(() => {});
    } catch (error) {
      await message
        .reply({
          embeds: [
            client.embedBuilder.error(
              client,
              message.t("commands.baninfo.not_banned"),
            ),
          ],
        })
        .catch(() => {});
    }
  },
};
