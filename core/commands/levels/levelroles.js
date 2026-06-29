const nfFr = new Intl.NumberFormat("fr-FR");

module.exports = {
  name: "levelroles",
  description: "Affiche les rôles donnés en récompense de niveau.",
  category: "levels",
  usage: "levelroles",
  async execute(client, message, args) {
    const roles = client.db.db
      .prepare("SELECT * FROM level_roles WHERE guildId = ?")
      .all(message.guild.id);

    if (!roles || roles.length === 0) {
      return message
        .reply({
          embeds: [
            client.embedBuilder.info(
              client,
              message.t("commands.levelroles.none"),
            ),
          ],
        })
        .catch(() => {});
    }

    const sorted = roles.sort((a, b) => a.level - b.level);

    const embed = client.embedBuilder
      .premium(
        client,
        message.t("commands.levelroles.title"),
        message.t("commands.levelroles.tiers", {
          count: nfFr.format(sorted.length),
        }),
      )
      .setThumbnail(message.guild.iconURL({ dynamic: true }));

    for (const r of sorted) {
      embed.addFields(
        {
          name: message.t("commands.levelroles.field_level"),
          value: `\`${nfFr.format(r.level)}\``,
          inline: true,
        },
        {
          name: message.t("commands.levelroles.field_role"),
          value: `<@&${r.roleId}>`,
          inline: true,
        },
        { name: "​", value: "​", inline: true },
      );
    }

    await message.reply({ embeds: [embed] }).catch(() => {});
  },
};
