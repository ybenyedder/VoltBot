const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  PermissionFlagsBits,
} = require("discord.js");

const fmtNum = (n) => new Intl.NumberFormat("fr-FR").format(n || 0);

module.exports = {
  name: "removeinvite",
  description: "Retire des invitations à un utilisateur",
  category: "invitations",
  usage: "removeinvite",
  userPerms: [PermissionFlagsBits.ManageGuild],
  async execute(client, message, args) {
    if (!args[0] || !args[1]) {
      return message
        .reply({
          embeds: [
            client.embedBuilder.warning(
              client,
              "Usage : `+removeinvite @membre <nombre>`",
            ),
          ],
        })
        .catch(() => {});
    }

    const user =
      message.mentions.users.first() || client.users.cache.get(args[0]);
    if (!user) {
      return message
        .reply({
          embeds: [client.embedBuilder.error(client, "Membre introuvable.")],
        })
        .catch(() => {});
    }

    const amount = parseInt(args[1]);
    if (isNaN(amount) || amount < 1) {
      return message
        .reply({
          embeds: [
            client.embedBuilder.error(
              client,
              "Nombre invalide. Entier positif requis.",
            ),
          ],
        })
        .catch(() => {});
    }

    const invites = client.db.getUser(user.id, message.guild.id, "invites") || {
      regular: 0,
      bonus: 0,
      leaves: 0,
      total: 0,
    };

    const oldTotalBonusRegular = (invites.bonus || 0) + (invites.regular || 0);
    const projectedRemovedFromBonus = Math.min(amount, invites.bonus || 0);
    const projectedRemovedFromRegular = Math.min(
      amount - projectedRemovedFromBonus,
      invites.regular || 0,
    );
    const projectedBonus = (invites.bonus || 0) - projectedRemovedFromBonus;
    const projectedRegular =
      (invites.regular || 0) - projectedRemovedFromRegular;
    const projectedAfter = projectedBonus + projectedRegular;

    const applyRemove = () => {
      const removedFromBonus = Math.min(amount, invites.bonus || 0);
      const removedFromRegular = Math.min(
        amount - removedFromBonus,
        invites.regular || 0,
      );
      invites.bonus = (invites.bonus || 0) - removedFromBonus;
      invites.regular = (invites.regular || 0) - removedFromRegular;
      invites.total = invites.regular + invites.bonus - (invites.leaves || 0);
      client.db.updateUser(user.id, message.guild.id, "invites", invites);

      return client.embedBuilder
        .base(client, "Retrait d'invitations")
        .addFields(
          { name: "Cible", value: `<@${user.id}>`, inline: true },
          {
            name: "Avant",
            value: `\`${fmtNum(oldTotalBonusRegular)}\``,
            inline: true,
          },
          {
            name: message.t("commands.removeinvite.field_after"),
            value: `\`${fmtNum(invites.regular + invites.bonus)}\``,
            inline: true,
          },
        );
    };

    if (amount <= 5) {
      await message.reply({ embeds: [applyRemove()] }).catch(() => {});
      return;
    }

    const confirmEmbed = client.embedBuilder
      .base(client, "Confirmation de retrait")
      .addFields(
        { name: "Cible", value: `<@${user.id}>`, inline: true },
        {
          name: "Avant",
          value: `\`${fmtNum(oldTotalBonusRegular)}\``,
          inline: true,
        },
        {
          name: message.t("commands.removeinvite.field_after"),
          value: `\`${fmtNum(projectedAfter)}\``,
          inline: true,
        },
      );

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("removeinvite_confirm")
        .setLabel("Confirmer")
        .setStyle(ButtonStyle.Danger),
      new ButtonBuilder()
        .setCustomId("removeinvite_cancel")
        .setLabel("Annuler")
        .setStyle(ButtonStyle.Secondary),
    );

    const prompt = await message
      .reply({ embeds: [confirmEmbed], components: [row] })
      .catch(() => null);
    if (!prompt) return;

    const filter = (i) =>
      i.user.id === message.author.id &&
      ["removeinvite_confirm", "removeinvite_cancel"].includes(i.customId);
    const collector = prompt.createMessageComponentCollector({
      filter,
      time: 30_000,
      max: 1,
    });

    collector.on("collect", async (interaction) => {
      if (interaction.customId === "removeinvite_cancel") {
        await interaction
          .update({
            embeds: [
              client.embedBuilder.warning(
                client,
                message.t("commands.removeinvite.cancelled"),
              ),
            ],
            components: [],
          })
          .catch(() => {});
        return;
      }

      const resultEmbed = applyRemove();
      await interaction
        .update({ embeds: [resultEmbed], components: [] })
        .catch(() => {});
    });

    collector.on("end", (collected) => {
      if (collected.size === 0) {
        prompt
          .edit({
            embeds: [
              client.embedBuilder.warning(
                client,
                message.t("commands.removeinvite.timeout"),
              ),
            ],
            components: [],
          })
          .catch(() => {});
      }
    });
  },
};
