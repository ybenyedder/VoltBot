module.exports = {
  name: "deposit",
  aliases: ["dep", "put"],
  description: "Dépose ton argent en banque pour le protéger des vols.",
  category: "economy",
  usage: "+deposit [montant/all]",
  async execute(client, message, args) {
    if (!args[0])
      return message
        .reply({
          embeds: [
            client.embedBuilder.error(
              client,
              message.t("commands.deposit.amount_required"),
            ),
          ],
        })
        .catch(() => {});

    const fmt = new Intl.NumberFormat("fr-FR");
    const userData = client.db.getUser(message.author.id, message.guild.id);
    const amount =
      args[0].toLowerCase() === "all" ? userData.coins : parseInt(args[0]);

    if (isNaN(amount) || amount <= 0)
      return message
        .reply({
          embeds: [
            client.embedBuilder.error(
              client,
              message.t("commands.deposit.invalid_amount"),
            ),
          ],
        })
        .catch(() => {});

    // Atomic coins -> bank: prevents lost updates if the user runs +deposit
    // concurrently with +pay/+withdraw/etc.
    if (!client.db.depositCoins(message.author.id, message.guild.id, amount)) {
      return message
        .reply({
          embeds: [
            client.embedBuilder.error(
              client,
              message.t("commands.deposit.insufficient_pocket"),
            ),
          ],
        })
        .catch(() => {});
    }

    const updated = client.db.getUser(message.author.id, message.guild.id);
    const embed = client.embedBuilder
      .success(client, "")
      .setDescription(null)
      .addFields(
        {
          name: message.t("commands.deposit.field_action"),
          value: `\`${message.t("commands.deposit.action_deposit")}\``,
          inline: true,
        },
        {
          name: message.t("commands.deposit.field_amount"),
          value: `\`\`\`prolog\n${fmt.format(amount)}\n\`\`\``,
          inline: true,
        },
        {
          name: message.t("commands.deposit.field_pocket"),
          value: `\`\`\`prolog\n${fmt.format(updated.coins || 0)}\n\`\`\``,
          inline: true,
        },
        {
          name: message.t("commands.deposit.field_bank"),
          value: `\`\`\`prolog\n${fmt.format(updated.bank || 0)}\n\`\`\``,
          inline: true,
        },
      );
    await message.reply({ embeds: [embed] }).catch(() => {});
  },
};
