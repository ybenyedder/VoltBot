const { PermissionsBitField } = require("discord.js");

module.exports = {
  name: "addmoney",
  aliases: ["addcash", "givemoney", "add-money", "am"],
  description: "Ajoute de l'argent au portefeuille d'un membre (Admin).",
  category: "economy",
  usage: "+addmoney @user [montant]",
  userPerms: [PermissionsBitField.Flags.Administrator],
  async execute(client, message, args) {
    if (
      !message.member.permissions.has("Administrator") &&
      !client.db.isBotOwner(message.author.id)
    ) {
      return message
        .reply({
          embeds: [
            client.embedBuilder.error(client, message.t("commands.addmoney.admin_only")),
          ],
        })
        .catch(() => {});
    }

    const target =
      message.mentions.members.first() ||
      message.guild.members.cache.get(args[0]);
    if (!target)
      return message
        .reply({
          embeds: [
            client.embedBuilder.error(
              client,
              message.t("commands.addmoney.target_not_found"),
            ),
          ],
        })
        .catch(() => {});
    if (target.user.bot)
      return message
        .reply({
          embeds: [
            client.embedBuilder.error(client, message.t("commands.addmoney.bots_no_money")),
          ],
        })
        .catch(() => {});

    const amount = parseInt(args[1]);
    if (isNaN(amount) || amount <= 0)
      return message
        .reply({
          embeds: [client.embedBuilder.error(client, message.t("commands.addmoney.invalid_amount"))],
        })
        .catch(() => {});

    const fmt = new Intl.NumberFormat("fr-FR");

    client.db.addCoins(target.id, message.guild.id, amount);

    const embed = client.embedBuilder
      .success(client, "")
      .setDescription(null)
      .setThumbnail(target.user.displayAvatarURL({ size: 256 }))
      .addFields(
        { name: message.t("commands.addmoney.field_target"), value: `${target}`, inline: true },
        { name: message.t("commands.addmoney.field_action"), value: `\`${message.t("commands.addmoney.action_credit")}\``, inline: true },
        {
          name: message.t("commands.addmoney.field_value"),
          value: `\`\`\`prolog\n+${fmt.format(amount)}\n\`\`\``,
          inline: true,
        },
        { name: message.t("commands.addmoney.field_author"), value: `${message.author}`, inline: false },
      );
    await message.reply({ embeds: [embed] }).catch(() => {});
  },
};
