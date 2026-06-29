module.exports = {
  name: "msgcount",
  aliases: ["messages", "msgs"],
  description:
    "Affiche le nombre total de messages envoyés par un membre (estimé via l'XP).",
  category: "stats",
  usage: "+msgcount [@user]",
  async execute(client, message, args) {
    const target =
      message.mentions.members.first() ||
      message.guild.members.cache.get(args[0]) ||
      message.member;

    if (target.user.bot) {
      return message
        .reply({
          embeds: [
            client.embedBuilder.error(
              client,
              message.t("commands.msgcount.target_not_followed"),
            ),
          ],
        })
        .catch(() => {});
    }

    const nf = new Intl.NumberFormat("fr-FR");
    const userData = client.db.getUser(target.id, message.guild.id);
    const estimatedMessages = Math.floor(userData.xp / 15);

    const embed = client.embedBuilder
      .base(
        client,
        message.t("commands.msgcount.embed_title", {
          user: target.user.username,
        }),
      )
      .setThumbnail(target.user.displayAvatarURL({ dynamic: true, size: 256 }))
      .addFields(
        {
          name: message.t("commands.msgcount.field_messages"),
          value: `\`${nf.format(estimatedMessages)}\``,
          inline: true,
        },
        {
          name: message.t("commands.msgcount.field_estimation"),
          value: `\`${nf.format(userData.xp)} XP\``,
          inline: true,
        },
      );

    await message.reply({ embeds: [embed] }).catch(() => {});
  },
};
