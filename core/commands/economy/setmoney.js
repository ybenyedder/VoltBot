const { PermissionFlagsBits } = require("discord.js");

module.exports = {
  name: "setmoney",
  aliases: ["setbalance", "set-money", "sm"],
  description: "Définit le solde d'un utilisateur.",
  category: "economy",
  usage: "+setmoney @user [montant]",
  userPerms: [PermissionFlagsBits.Administrator],
  async execute(client, message, args) {
    const target =
      message.mentions.members.first() ||
      message.guild.members.cache.get(args[0]);
    if (!target)
      return message
        .reply({
          embeds: [
            client.embedBuilder.error(
              client,
              message.t("commands.setmoney.target_not_found"),
            ),
          ],
        })
        .catch(() => {});
    if (target.user.bot)
      return message
        .reply({
          embeds: [
            client.embedBuilder.error(
              client,
              message.t("commands.setmoney.bots_no_money"),
            ),
          ],
        })
        .catch(() => {});

    const amount = parseInt(args[1]);
    if (isNaN(amount) || amount < 0)
      return message
        .reply({
          embeds: [
            client.embedBuilder.error(
              client,
              message.t("commands.setmoney.invalid_amount"),
            ),
          ],
        })
        .catch(() => {});

    const fmt = new Intl.NumberFormat("fr-FR");

    client.db.setGlobalCoins(target.id, message.guild.id, amount);

    const embed = client.embedBuilder
      .success(client, "")
      .setDescription(null)
      .setThumbnail(target.user.displayAvatarURL({ size: 256 }))
      .addFields(
        {
          name: message.t("commands.setmoney.field_target"),
          value: `${target}`,
          inline: true,
        },
        {
          name: message.t("commands.setmoney.field_action"),
          value: `\`${message.t("commands.setmoney.action_set")}\``,
          inline: true,
        },
        {
          name: message.t("commands.setmoney.field_value"),
          value: `\`\`\`prolog\n${fmt.format(amount)}\n\`\`\``,
          inline: true,
        },
        {
          name: message.t("commands.setmoney.field_author"),
          value: `${message.author}`,
          inline: false,
        },
      )
      .setFooter({ text: message.t("commands.setmoney.footer_bank_reset") });
    await message.reply({ embeds: [embed] }).catch(() => {});
  },
};
