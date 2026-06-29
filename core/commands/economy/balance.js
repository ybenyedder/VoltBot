module.exports = {
  name: "balance",
  aliases: ["bal", "money", "coins", "bank", "argent", "cash"],
  description: "Affiche le solde (argent) d'un membre.",
  category: "economy",
  usage: "+balance [@user]",
  async execute(client, message, args) {
    const target =
      message.mentions.members.first() ||
      message.guild.members.cache.get(args[0]) ||
      message.member;
    if (target.user.bot)
      return message
        .reply({
          embeds: [
            client.embedBuilder.error(client, message.t("commands.balance.bots_no_money")),
          ],
        })
        .catch(() => {});

    const fmt = new Intl.NumberFormat("fr-FR");
    const userData = client.db.getUser(target.id, message.guild.id);
    const poche = userData.coins || 0;
    const banque = userData.bank || 0;
    const total = poche + banque;

    const embed = client.embedBuilder
      .base(client, null, null)
      .setAuthor({
        name: message.t("commands.balance.author", { user: target.user.username }),
        iconURL: target.user.displayAvatarURL({ size: 64 }),
      })
      .setThumbnail(target.user.displayAvatarURL({ size: 256 }))
      .addFields(
        {
          name: message.t("commands.balance.field_pocket"),
          value: `\`\`\`prolog\n${fmt.format(poche)}\n\`\`\``,
          inline: true,
        },
        {
          name: message.t("commands.balance.field_bank"),
          value: `\`\`\`prolog\n${fmt.format(banque)}\n\`\`\``,
          inline: true,
        },
        {
          name: message.t("commands.balance.field_total"),
          value: `\`\`\`prolog\n${fmt.format(total)}\n\`\`\``,
          inline: true,
        },
      );

    await message.reply({ embeds: [embed] }).catch(() => {});
  },
};
