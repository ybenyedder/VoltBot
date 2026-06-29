const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
} = require("discord.js");

module.exports = {
  name: "pay",
  aliases: ["give", "transfer", "donner"],
  description: "Transfère de l'argent à un autre utilisateur.",
  category: "economy",
  usage: "+pay @user [montant]",
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
              message.t("commands.pay.target_not_found"),
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
              message.t("commands.pay.bot_target"),
            ),
          ],
        })
        .catch(() => {});
    if (target.id === message.author.id)
      return message
        .reply({
          embeds: [
            client.embedBuilder.error(
              client,
              message.t("commands.pay.self_transfer"),
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
              message.t("commands.pay.invalid_amount"),
            ),
          ],
        })
        .catch(() => {});

    const fmt = new Intl.NumberFormat("fr-FR");

    const userData = client.db.getUser(message.author.id, message.guild.id);
    if ((userData.coins || 0) < amount) {
      return message
        .reply({
          embeds: [
            client.embedBuilder.error(
              client,
              message.t("commands.pay.insufficient_pocket"),
            ),
          ],
        })
        .catch(() => {});
    }

    const finalize = async () => {
      // Atomic SELECT/check/DEBIT/CREDIT — prevents the two-command race that
      // could let a sender spend the same balance twice on +pay.
      const result = client.db.transferCoins(
        message.author.id,
        target.id,
        message.guild.id,
        amount,
      );
      if (!result.ok) {
        return null;
      }
      return client.embedBuilder
        .success(client, "")
        .setDescription(null)
        .addFields(
          {
            name: message.t("commands.pay.field_from"),
            value: `${message.author}`,
            inline: true,
          },
          {
            name: message.t("commands.pay.field_to"),
            value: `${target}`,
            inline: true,
          },
          {
            name: message.t("commands.pay.field_amount"),
            value: `\`\`\`prolog\n${fmt.format(amount)}\n\`\`\``,
            inline: true,
          },
        );
    };

    const CONFIRM_THRESHOLD = 10000;
    if (amount > CONFIRM_THRESHOLD) {
      const confirmEmbed = client.embedBuilder
        .warning(client, message.t("commands.pay.confirm_required"))
        .addFields(
          {
            name: message.t("commands.pay.field_to"),
            value: `${target}`,
            inline: true,
          },
          {
            name: message.t("commands.pay.field_amount"),
            value: `\`\`\`prolog\n${fmt.format(amount)}\n\`\`\``,
            inline: true,
          },
          {
            name: message.t("commands.pay.field_expires"),
            value: `<t:${Math.floor((Date.now() + 30000) / 1000)}:R>`,
            inline: true,
          },
        );
      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("pay_confirm")
          .setLabel(message.t("commands.pay.confirm"))
          .setStyle(ButtonStyle.Danger),
        new ButtonBuilder()
          .setCustomId("pay_cancel")
          .setLabel(message.t("commands.pay.cancel"))
          .setStyle(ButtonStyle.Secondary),
      );
      const prompt = await message
        .reply({ embeds: [confirmEmbed], components: [row] })
        .catch(() => null);
      if (!prompt) return;

      try {
        const click = await prompt.awaitMessageComponent({
          componentType: ComponentType.Button,
          time: 30000,
          filter: (i) => i.user.id === message.author.id,
        });
        if (click.customId === "pay_cancel") {
          return click
            .update({
              embeds: [
                client.embedBuilder.error(
                  client,
                  message.t("commands.pay.transfer_cancelled"),
                ),
              ],
              components: [],
            })
            .catch(() => {});
        }
        const result = await finalize();
        if (!result) {
          return click
            .update({
              embeds: [
                client.embedBuilder.error(
                  client,
                  message.t("commands.pay.insufficient_at_confirm"),
                ),
              ],
              components: [],
            })
            .catch(() => {});
        }
        return click
          .update({ embeds: [result], components: [] })
          .catch(() => {});
      } catch (e) {
        return prompt
          .edit({
            embeds: [
              client.embedBuilder.warning(
                client,
                message.t("commands.pay.confirm_expired"),
              ),
            ],
            components: [],
          })
          .catch(() => {});
      }
    }

    const result = await finalize();
    if (!result) {
      return message
        .reply({
          embeds: [
            client.embedBuilder.error(
              client,
              message.t("commands.pay.insufficient_pocket"),
            ),
          ],
        })
        .catch(() => {});
    }
    await message.reply({ embeds: [result] }).catch(() => {});
  },
};
