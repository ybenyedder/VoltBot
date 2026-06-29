const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  PermissionFlagsBits,
} = require("discord.js");

const fmtNum = (n) => new Intl.NumberFormat("fr-FR").format(n || 0);

module.exports = {
  name: "clearinvites",
  description: "Réinitialise les invitations d'un utilisateur",
  category: "invitations",
  usage: "clearinvites",
  userPerms: [PermissionFlagsBits.ManageGuild],
  async execute(client, message, args) {
    if (!args[0]) {
      return message
        .reply({
          embeds: [
            client.embedBuilder.warning(
              client,
              "Usage : `+clearinvites @membre`",
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

    const oldInvites = client.db.getUser(
      user.id,
      message.guild.id,
      "invites",
    ) || { regular: 0, bonus: 0, leaves: 0, total: 0 };

    const oldTotal = oldInvites.total || 0;

    const confirmEmbed = client.embedBuilder
      .base(client, message.t("commands.clearinvites.confirm_title"))
      .addFields(
        { name: "Cible", value: `<@${user.id}>`, inline: true },
        { name: "Total avant", value: `\`${fmtNum(oldTotal)}\``, inline: true },
        {
          name: message.t("commands.clearinvites.field_moderator"),
          value: `<@${message.author.id}>`,
          inline: true,
        },
      );

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("clearinvites_confirm")
        .setLabel(message.t("commands.clearinvites.btn_reset"))
        .setStyle(ButtonStyle.Danger),
      new ButtonBuilder()
        .setCustomId("clearinvites_cancel")
        .setLabel("Annuler")
        .setStyle(ButtonStyle.Secondary),
    );

    const prompt = await message
      .reply({ embeds: [confirmEmbed], components: [row] })
      .catch(() => null);
    if (!prompt) return;

    const filter = (i) =>
      i.user.id === message.author.id &&
      ["clearinvites_confirm", "clearinvites_cancel"].includes(i.customId);
    const collector = prompt.createMessageComponentCollector({
      filter,
      time: 30_000,
      max: 1,
    });

    collector.on("collect", async (interaction) => {
      if (interaction.customId === "clearinvites_cancel") {
        await interaction
          .update({
            embeds: [
              client.embedBuilder.warning(
                client,
                message.t("commands.clearinvites.cancelled"),
              ),
            ],
            components: [],
          })
          .catch(() => {});
        return;
      }

      client.db.setUser(user.id, message.guild.id, {
        invites: { regular: 0, bonus: 0, leaves: 0, total: 0 },
      });

      const resultEmbed = client.embedBuilder
        .base(client, message.t("commands.clearinvites.done_title"))
        .addFields(
          { name: "Cible", value: `<@${user.id}>`, inline: true },
          {
            name: "Total avant",
            value: `\`${fmtNum(oldTotal)}\``,
            inline: true,
          },
          {
            name: message.t("commands.clearinvites.field_moderator"),
            value: `<@${message.author.id}>`,
            inline: true,
          },
        );

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
                message.t("commands.clearinvites.timeout"),
              ),
            ],
            components: [],
          })
          .catch(() => {});
      }
    });
  },
};
