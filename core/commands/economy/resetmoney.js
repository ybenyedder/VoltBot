const {
  PermissionFlagsBits,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
} = require("discord.js");

module.exports = {
  name: "resetmoney",
  aliases: ["resetbal", "clearbalance", "reset-money"],
  description: "Réinitialise le solde d'un utilisateur à zéro.",
  category: "economy",
  usage: "+resetmoney @user",
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
              message.t("commands.resetmoney.target_not_found"),
            ),
          ],
        })
        .catch(() => {});

    const warnEmbed = client.embedBuilder
      .warning(client, message.t("commands.resetmoney.warn_irreversible"))
      .addFields(
        {
          name: message.t("commands.resetmoney.field_target"),
          value: `${target}`,
          inline: true,
        },
        {
          name: message.t("commands.resetmoney.field_author"),
          value: `${message.author}`,
          inline: true,
        },
        {
          name: message.t("commands.resetmoney.field_expires"),
          value: `<t:${Math.floor((Date.now() + 20000) / 1000)}:R>`,
          inline: true,
        },
      );
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("reset_yes")
        .setLabel(message.t("commands.resetmoney.confirm"))
        .setStyle(ButtonStyle.Danger),
      new ButtonBuilder()
        .setCustomId("reset_no")
        .setLabel(message.t("commands.resetmoney.cancel"))
        .setStyle(ButtonStyle.Secondary),
    );

    const prompt = await message
      .reply({ embeds: [warnEmbed], components: [row] })
      .catch(() => null);
    if (!prompt) return;

    try {
      const click = await prompt.awaitMessageComponent({
        componentType: ComponentType.Button,
        time: 20000,
        filter: (i) => i.user.id === message.author.id,
      });
      if (click.customId === "reset_no") {
        return click
          .update({
            embeds: [
              client.embedBuilder.info(
                client,
                message.t("commands.resetmoney.cancelled"),
              ),
            ],
            components: [],
          })
          .catch(() => {});
      }
      client.db.resetEconomy(target.id, message.guild.id);
      const okEmbed = client.embedBuilder
        .success(client, "")
        .setDescription(null)
        .setThumbnail(target.user.displayAvatarURL({ size: 256 }))
        .addFields(
          {
            name: message.t("commands.resetmoney.field_target"),
            value: `${target}`,
            inline: true,
          },
          {
            name: message.t("commands.resetmoney.field_action"),
            value: `\`${message.t("commands.resetmoney.action_reset")}\``,
            inline: true,
          },
          {
            name: message.t("commands.resetmoney.field_value"),
            value: "```prolog\n0\n```",
            inline: true,
          },
          {
            name: message.t("commands.resetmoney.field_author"),
            value: `${message.author}`,
            inline: false,
          },
        );
      return click
        .update({ embeds: [okEmbed], components: [] })
        .catch(() => {});
    } catch (e) {
      return prompt
        .edit({
          embeds: [
            client.embedBuilder.warning(
              client,
              message.t("commands.resetmoney.confirm_expired"),
            ),
          ],
          components: [],
        })
        .catch(() => {});
    }
  },
};
