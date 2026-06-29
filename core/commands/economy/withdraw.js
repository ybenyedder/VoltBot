module.exports = {
  name: "withdraw",
  aliases: ["with", "retirer"],
  description: "Retire ton argent de la banque.",
  category: "economy",
  usage: "+withdraw [montant/all]",
  async execute(client, message, args) {
    if (!args[0])
      return message
        .reply({
          embeds: [
            client.embedBuilder.error(
              client,
              message.t("commands.withdraw.amount_required"),
            ),
          ],
        })
        .catch(() => {});

    const fmt = new Intl.NumberFormat("fr-FR");
    const userData = client.db.getUser(message.author.id, message.guild.id);
    const amount =
      args[0].toLowerCase() === "all" ? userData.bank : parseInt(args[0]);

    if (isNaN(amount) || amount <= 0)
      return message
        .reply({
          embeds: [client.embedBuilder.error(client, message.t("commands.withdraw.invalid_amount"))],
        })
        .catch(() => {});

    // Atomic bank -> coins: prevents lost updates between bank debit and
    // coins credit when concurrent commands hit the same user row.
    if (!client.db.withdrawCoins(message.author.id, message.guild.id, amount)) {
      return message
        .reply({
          embeds: [
            client.embedBuilder.error(client, message.t("commands.withdraw.insufficient_bank")),
          ],
        })
        .catch(() => {});
    }

    const updated = client.db.getUser(message.author.id, message.guild.id);
    const embed = client.embedBuilder
      .success(client, "")
      .setDescription(null)
      .addFields(
        { name: message.t("commands.withdraw.field_action"), value: `\`${message.t("commands.withdraw.action_withdraw")}\``, inline: true },
        {
          name: message.t("commands.withdraw.field_amount"),
          value: `\`\`\`prolog\n${fmt.format(amount)}\n\`\`\``,
          inline: true,
        },
        {
          name: message.t("commands.withdraw.field_pocket"),
          value: `\`\`\`prolog\n${fmt.format(updated.coins || 0)}\n\`\`\``,
          inline: true,
        },
        {
          name: message.t("commands.withdraw.field_bank"),
          value: `\`\`\`prolog\n${fmt.format(updated.bank || 0)}\n\`\`\``,
          inline: true,
        },
      );
    await message.reply({ embeds: [embed] }).catch(() => {});
  },
};
