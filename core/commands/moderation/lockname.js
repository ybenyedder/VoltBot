const { PermissionFlagsBits } = require("discord.js");

module.exports = {
  name: "lockname",
  aliases: ["locknick", "pseudo-lock", "verrouiller-pseudo"],
  description: "Verrouille le changement de pseudo",
  category: "moderation",
  usage: "lockname",
  userPerms: [PermissionFlagsBits.ManageNicknames],
  async execute(client, message, args) {
    if (!args[0]) {
      const lockedNames =
        client.db.getGuild(message.guild.id, "lockedNames") || [];

      const fmtNum = new Intl.NumberFormat("fr-FR").format(lockedNames.length);
      const embed = client.embedBuilder
        .base(client, message.t("commands.lockname.list_title"), null)
        .addFields({
          name: message.t("commands.lockname.field_total"),
          value: fmtNum,
          inline: true,
        });
      lockedNames.slice(0, 24).forEach((lock) => {
        const ts = Math.floor(new Date(lock.date).getTime() / 1000);
        embed.addFields({
          name: lock.username,
          value: `<@${lock.userId || ""}> • \`${lock.nickname}\`\n<@${lock.moderator}> • <t:${ts}:R>`,
          inline: true,
        });
      });

      return message.reply({ embeds: [embed] }).catch(() => {});
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
              message.t("commands.lockname.target_not_found"),
            ),
          ],
        })
        .catch(() => {});

    const nickname = args.slice(1).join("");
    if (!nickname)
      return message
        .reply({
          embeds: [client.embedBuilder.error(client, message.t("commands.lockname.nickname_missing"))],
        })
        .catch(() => {});

    const lockedNames =
      client.db.getGuild(message.guild.id, "lockedNames") || [];

    if (lockedNames.find((l) => l.userId === member.id)) {
      return message
        .reply({
          embeds: [
            client.embedBuilder.error(client, message.t("commands.lockname.already_locked")),
          ],
        })
        .catch(() => {});
    }

    lockedNames.push({
      userId: member.id,
      username: member.user.tag,
      nickname: nickname,
      moderator: message.author.id,
      date: new Date().toISOString(),
    });

    client.db.updateGuild(message.guild.id, { lockedNames });

    try {
      await member.setNickname(nickname);
    } catch (error) {
      return message
        .reply({
          embeds: [
            client.embedBuilder.error(
              client,
              message.t("commands.lockname.change_refused"),
            ),
          ],
        })
        .catch(() => {});
    }

    const ts = Math.floor(Date.now() / 1000);
    const embed = client.embedBuilder
      .success(client, "​")
      .setDescription(null)
      .setAuthor({
        name: message.t("commands.lockname.locked_title"),
        iconURL: member.user.displayAvatarURL({ size: 256 }),
      })
      .addFields(
        { name: message.t("commands.lockname.field_target"), value: `<@${member.id}>`, inline: true },
        { name: message.t("commands.lockname.field_moderator"), value: `<@${message.author.id}>`, inline: true },
        { name: message.t("commands.lockname.field_nickname"), value: `\`${nickname}\``, inline: true },
        { name: message.t("commands.lockname.field_date"), value: `<t:${ts}:R>`, inline: true },
      );

    await message.reply({ embeds: [embed] }).catch(() => {});
  },
};
