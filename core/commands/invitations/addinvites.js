const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  PermissionFlagsBits,
} = require("discord.js");

const fmtNum = (n) => new Intl.NumberFormat("fr-FR").format(n || 0);

module.exports = {
  name: "addinvites",
  description: "Ajoute des invitations manuellement",
  category: "invitations",
  usage: "addinvites",
  userPerms: [PermissionFlagsBits.ManageGuild],
  async execute(client, message, args) {
    if (!args[0] || !args[1]) {
      return message
        .reply({
          embeds: [
            client.embedBuilder.warning(
              client,
              "Usage : `+addinvites @membre <nombre>`",
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
    const oldBonus = invites.bonus || 0;
    const projectedBonus = oldBonus + amount;

    const applyAdd = () => {
      invites.bonus = (invites.bonus || 0) + amount;
      invites.total =
        (invites.regular || 0) + invites.bonus - (invites.leaves || 0);
      client.db.updateUser(user.id, message.guild.id, "invites", invites);

      return client.embedBuilder
        .base(client, "Ajout d'invitations")
        .addFields(
          { name: "Cible", value: `<@${user.id}>`, inline: true },
          { name: "Avant", value: `\`${fmtNum(oldBonus)}\``, inline: true },
          {
            name: message.t("commands.addinvites.field_after"),
            value: `\`${fmtNum(invites.bonus)}\``,
            inline: true,
          },
        );
    };

    if (amount <= 5) {
      await message.reply({ embeds: [applyAdd()] }).catch(() => {});
      return;
    }

    const confirmEmbed = client.embedBuilder
      .base(client, "Confirmation d'ajout")
      .addFields(
        { name: "Cible", value: `<@${user.id}>`, inline: true },
        { name: "Avant", value: `\`${fmtNum(oldBonus)}\``, inline: true },
        { name: message.t("commands.addinvites.field_after"), value: `\`${fmtNum(projectedBonus)}\``, inline: true },
      );

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("addinvites_confirm")
        .setLabel("Confirmer")
        .setStyle(ButtonStyle.Danger),
      new ButtonBuilder()
        .setCustomId("addinvites_cancel")
        .setLabel("Annuler")
        .setStyle(ButtonStyle.Secondary),
    );

    const prompt = await message
      .reply({ embeds: [confirmEmbed], components: [row] })
      .catch(() => null);
    if (!prompt) return;

    const filter = (i) =>
      i.user.id === message.author.id &&
      ["addinvites_confirm", "addinvites_cancel"].includes(i.customId);
    const collector = prompt.createMessageComponentCollector({
      filter,
      time: 30_000,
      max: 1,
    });

    collector.on("collect", async (interaction) => {
      if (interaction.customId === "addinvites_cancel") {
        await interaction
          .update({
            embeds: [client.embedBuilder.warning(client, message.t("commands.addinvites.cancelled"))],
            components: [],
          })
          .catch(() => {});
        return;
      }

      const resultEmbed = applyAdd();
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
                message.t("commands.addinvites.timeout"),
              ),
            ],
            components: [],
          })
          .catch(() => {});
      }
    });
  },
};
