const { PermissionsBitField } = require("discord.js");

module.exports = {
  name: "removemoney",
  aliases: ["rm", "take-money", "submoney"],
  description: "Retire de l'argent du portefeuille d'un membre (Admin).",
  category: "economy",
  usage: "+removemoney @user [montant]",
  userPerms: [PermissionsBitField.Flags.Administrator],
  async execute(client, message, args) {
    if (
      !message.member.permissions.has("Administrator") &&
      !client.db.isBotOwner(message.author.id)
    ) {
      return message
        .reply({
          embeds: [
            client.embedBuilder.error(
              client,
              message.t("commands.removemoney.admin_only"),
            ),
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
              message.t("commands.removemoney.target_not_found"),
            ),
          ],
        })
        .catch(() => {});

    const amount = parseInt(args[1]);
    if (isNaN(amount) || amount <= 0)
      return message
        .reply({
          embeds: [
            client.embedBuilder.error(
              client,
              message.t("commands.removemoney.invalid_amount"),
            ),
          ],
        })
        .catch(() => {});

    const fmt = new Intl.NumberFormat("fr-FR");

    client.db.removeGlobalCoins(target.id, message.guild.id, amount);

    const embed = client.embedBuilder
      .success(client, "")
      .setDescription(null)
      .setThumbnail(target.user.displayAvatarURL({ size: 256 }))
      .addFields(
        {
          name: message.t("commands.removemoney.field_target"),
          value: `${target}`,
          inline: true,
        },
        {
          name: message.t("commands.removemoney.field_action"),
          value: `\`${message.t("commands.removemoney.action_debit")}\``,
          inline: true,
        },
        {
          name: message.t("commands.removemoney.field_value"),
          value: `\`\`\`prolog\n-${fmt.format(amount)}\n\`\`\``,
          inline: true,
        },
        {
          name: message.t("commands.removemoney.field_author"),
          value: `${message.author}`,
          inline: false,
        },
      );
    await message.reply({ embeds: [embed] }).catch(() => {});
  },
};
