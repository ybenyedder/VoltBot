module.exports = {
  name: "activity",
  description: "Affiche l'activité globale du serveur.",
  category: "stats",
  usage: "activity",
  async execute(client, message, args) {
    const nf = new Intl.NumberFormat("fr-FR");
    const totalXp =
      client.db.db
        .prepare("SELECT SUM(xp) as total FROM users WHERE guildId = ?")
        .get(message.guild.id).total || 0;
    const estimatedGlobalMessages = Math.floor(totalXp / 15);
    const activeUsersCount =
      client.db.db
        .prepare(
          "SELECT COUNT(*) as count FROM users WHERE guildId = ? AND xp > 0",
        )
        .get(message.guild.id).count || 0;

    const embed = client.embedBuilder
      .base(client, message.t("commands.activity.title", { guild: message.guild.name }))
      .setThumbnail(message.guild.iconURL({ dynamic: true, size: 256 }))
      .addFields(
        {
          name: message.t("commands.activity.field_active"),
          value: `\`${nf.format(activeUsersCount)}\``,
          inline: true,
        },
        {
          name: message.t("commands.activity.field_messages"),
          value: `\`${nf.format(estimatedGlobalMessages)}\``,
          inline: true,
        },
        {
          name: message.t("commands.activity.field_total_xp"),
          value: `\`${nf.format(totalXp)}\``,
          inline: true,
        },
      );

    await message.reply({ embeds: [embed] }).catch(() => {});
  },
};
