const {
  PermissionsBitField,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
} = require("discord.js");
const permissions = require("../../utils/permissions");

const nfFr = new Intl.NumberFormat("fr-FR");

module.exports = {
  name: "resetxp",
  description: "Réinitialise l'XP d'un membre à zéro.",
  category: "levels",
  usage: "+resetxp @user",
  userPerms: [PermissionsBitField.Flags.Administrator],
  async execute(client, message, args) {
    if (!permissions.isAdmin(message)) {
      return message
        .reply({
          embeds: [
            client.embedBuilder.error(
              client,
              message.t("commands.resetxp.admin_only"),
            ),
          ],
        })
        .catch(() => {});
    }

    const target =
      message.mentions.members.first() ||
      message.guild.members.cache.get(args[0]);
    if (!target) {
      return message
        .reply({
          embeds: [
            client.embedBuilder.error(
              client,
              message.t("commands.resetxp.no_target"),
            ),
          ],
        })
        .catch(() => {});
    }

    if (target.user.bot) {
      return message
        .reply({
          embeds: [
            client.embedBuilder.warning(
              client,
              message.t("commands.resetxp.no_bots"),
            ),
          ],
        })
        .catch(() => {});
    }

    const before = client.db.getUser(target.id, message.guild.id);

    const confirmEmbed = client.embedBuilder
      .premium(client, message.t("commands.resetxp.confirm_title"), `${target}`)
      .addFields(
        {
          name: message.t("commands.resetxp.field_target"),
          value: `${target}`,
          inline: true,
        },
        {
          name: message.t("commands.resetxp.field_before"),
          value: message.t("commands.resetxp.before_value", {
            xp: nfFr.format(before.xp),
            level: nfFr.format(before.level),
          }),
          inline: true,
        },
        {
          name: message.t("commands.resetxp.field_action"),
          value: "`reset`",
          inline: true,
        },
      );

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("resetxp_confirm")
        .setLabel(message.t("commands.resetxp.btn_confirm"))
        .setStyle(ButtonStyle.Danger),
      new ButtonBuilder()
        .setCustomId("resetxp_cancel")
        .setLabel(message.t("commands.resetxp.btn_cancel"))
        .setStyle(ButtonStyle.Secondary),
    );

    const prompt = await message
      .reply({ embeds: [confirmEmbed], components: [row] })
      .catch(() => null);
    if (!prompt) return;

    const collector = prompt.createMessageComponentCollector({
      componentType: ComponentType.Button,
      time: 20000,
      max: 1,
      filter: (i) => i.user.id === message.author.id,
    });

    collector.on("collect", async (interaction) => {
      if (interaction.customId === "resetxp_cancel") {
        return interaction
          .update({
            embeds: [
              client.embedBuilder.info(
                client,
                message.t("commands.resetxp.cancelled"),
              ),
            ],
            components: [],
          })
          .catch(() => {});
      }

      // Atomic xp+level reset to avoid a transient (xp=0, level=N) state.
      client.db.setXpAndLevel(target.id, message.guild.id, 0, 0);

      const doneEmbed = client.embedBuilder
        .premium(client, message.t("commands.resetxp.done_title"), `${target}`)
        .addFields(
          {
            name: message.t("commands.resetxp.field_target"),
            value: `${target}`,
            inline: true,
          },
          {
            name: message.t("commands.resetxp.field_before"),
            value: message.t("commands.resetxp.before_value", {
              xp: nfFr.format(before.xp),
              level: nfFr.format(before.level),
            }),
            inline: true,
          },
          {
            name: message.t("commands.resetxp.field_after"),
            value: "`0 XP · n0`",
            inline: true,
          },
          {
            name: message.t("commands.resetxp.field_action"),
            value: "`reset`",
            inline: false,
          },
        );

      await interaction
        .update({ embeds: [doneEmbed], components: [] })
        .catch(() => {});
    });

    collector.on("end", (collected) => {
      if (collected.size === 0) {
        prompt
          .edit({
            embeds: [
              client.embedBuilder.info(
                client,
                message.t("commands.resetxp.timeout"),
              ),
            ],
            components: [],
          })
          .catch(() => {});
      }
    });
  },
};
