const {
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
  EmbedBuilder,
  MessageFlags,
} = require("discord.js");
const ms = require("ms");
const giveawayUtils = require("../../utils/giveaways");

const safeRespond = async (interaction, payload) => {
  try {
    if (interaction.replied || interaction.deferred) {
      return await interaction.followUp(payload);
    }
    return await interaction.reply(payload);
  } catch (_) {
    /* swallow */
  }
};

const handleGiveawayInteractions = async (interaction, client) => {
  try {
    if (
      interaction.isModalSubmit() &&
      interaction.customId === "giveaway_modal"
    ) {
      const durationArg =
        interaction.fields.getTextInputValue("giveaway_duration");
      const prize = interaction.fields.getTextInputValue("giveaway_prize");
      const winnersArg =
        interaction.fields.getTextInputValue("giveaway_winners");

      const duration = ms(durationArg);
      if (!duration) {
        return safeRespond(interaction, {
          embeds: [
            client.embedBuilder.error(
              client,
              interaction.t("interactions.giveaway.invalid_duration"),
            ),
          ],
          flags: [MessageFlags.Ephemeral],
        });
      }

      const winnersCount = parseInt(winnersArg) || 1;
      await giveawayUtils.createGiveaway(client, {
        channel: interaction.channel,
        guild: interaction.guild,
        prize,
        winnersCount,
        durationMs: duration,
        hostId: interaction.user.id,
      });

      return safeRespond(interaction, {
        embeds: [
          client.embedBuilder.success(
            client,
            interaction.t("interactions.giveaway.created"),
          ),
        ],
        flags: [MessageFlags.Ephemeral],
      });
    }

    if (interaction.isButton() && interaction.customId === "giveaway_join") {
      const result = await giveawayUtils.joinGiveaway(interaction, client);
      if (!result.ok && result.reason === "requirements") {
        return safeRespond(interaction, {
          embeds: [
            client.embedBuilder.error(
              client,
              interaction.t("interactions.giveaway.missing_roles"),
            ),
          ],
          flags: [MessageFlags.Ephemeral],
        });
      }
      if (!result.ok) {
        return safeRespond(interaction, {
          embeds: [
            client.embedBuilder.error(
              client,
              interaction.t("interactions.giveaway.ended"),
            ),
          ],
          flags: [MessageFlags.Ephemeral],
        });
      }
      const msg = result.alreadyJoined
        ? interaction.t("interactions.giveaway.already_joined")
        : interaction.t("interactions.giveaway.joined");
      const builder = result.alreadyJoined
        ? client.embedBuilder.warning
        : client.embedBuilder.success;
      return safeRespond(interaction, {
        embeds: [builder(client, msg)],
        flags: [MessageFlags.Ephemeral],
      });
    }

    if (
      interaction.isButton() &&
      interaction.customId.startsWith("open_giveaway_modal_")
    ) {
      const authorId = interaction.customId.split("_")[3];
      if (interaction.user.id !== authorId) {
        return safeRespond(interaction, {
          embeds: [
            client.embedBuilder.error(
              client,
              interaction.t("interactions.giveaway.author_only"),
            ),
          ],
          flags: [MessageFlags.Ephemeral],
        });
      }

      const modal = new ModalBuilder()
        .setCustomId("giveaway_modal")
        .setTitle(interaction.t("interactions.giveaway.modal_title"));

      const durationInput = new TextInputBuilder()
        .setCustomId("giveaway_duration")
        .setLabel(interaction.t("interactions.giveaway.input_duration"))
        .setStyle(TextInputStyle.Short)
        .setRequired(true)
        .setPlaceholder("24h");

      const prizeInput = new TextInputBuilder()
        .setCustomId("giveaway_prize")
        .setLabel(interaction.t("interactions.giveaway.input_prize"))
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(true)
        .setPlaceholder(interaction.t("interactions.giveaway.input_prize_placeholder"));

      const winnersInput = new TextInputBuilder()
        .setCustomId("giveaway_winners")
        .setLabel(interaction.t("interactions.giveaway.input_winners"))
        .setStyle(TextInputStyle.Short)
        .setRequired(true)
        .setValue("1");

      modal.addComponents(
        new ActionRowBuilder().addComponents(durationInput),
        new ActionRowBuilder().addComponents(prizeInput),
        new ActionRowBuilder().addComponents(winnersInput),
      );

      return interaction.showModal(modal);
    }

    return false;
  } catch (e) {
    await safeRespond(interaction, {
      embeds: [
        client.embedBuilder.error(
          client,
          interaction.t("interactions.giveaway.process_failed"),
        ),
      ],
      flags: [MessageFlags.Ephemeral],
    });
    return true;
  }
};

const handleEmbedBuilderInteractions = async (interaction, client) => {
  try {
    if (interaction.isButton() && interaction.customId === "open_embed_modal") {
      const modal = new ModalBuilder()
        .setCustomId("embed_modal")
        .setTitle(interaction.t("interactions.embedbuilder.modal_title"));

      const titleInput = new TextInputBuilder()
        .setCustomId("embed_title")
        .setLabel(interaction.t("interactions.embedbuilder.input_title"))
        .setStyle(TextInputStyle.Short)
        .setRequired(false)
        .setPlaceholder(interaction.t("interactions.embedbuilder.input_title_placeholder"));

      const descInput = new TextInputBuilder()
        .setCustomId("embed_desc")
        .setLabel(interaction.t("interactions.embedbuilder.input_desc"))
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(false)
        .setPlaceholder(interaction.t("interactions.embedbuilder.input_desc_placeholder"));

      const colorInput = new TextInputBuilder()
        .setCustomId("embed_color")
        .setLabel(interaction.t("interactions.embedbuilder.input_color"))
        .setStyle(TextInputStyle.Short)
        .setRequired(false)
        .setPlaceholder("#FF0000");

      const thumbInput = new TextInputBuilder()
        .setCustomId("embed_thumb")
        .setLabel(interaction.t("interactions.embedbuilder.input_thumb"))
        .setStyle(TextInputStyle.Short)
        .setRequired(false)
        .setPlaceholder("https://...");

      const footerInput = new TextInputBuilder()
        .setCustomId("embed_footer")
        .setLabel(interaction.t("interactions.embedbuilder.input_footer"))
        .setStyle(TextInputStyle.Short)
        .setRequired(false);

      modal.addComponents(
        new ActionRowBuilder().addComponents(titleInput),
        new ActionRowBuilder().addComponents(descInput),
        new ActionRowBuilder().addComponents(colorInput),
        new ActionRowBuilder().addComponents(thumbInput),
        new ActionRowBuilder().addComponents(footerInput),
      );

      return interaction.showModal(modal);
    }

    if (interaction.isModalSubmit() && interaction.customId === "embed_modal") {
      const title = interaction.fields.getTextInputValue("embed_title");
      const desc = interaction.fields.getTextInputValue("embed_desc");
      const color = interaction.fields.getTextInputValue("embed_color");
      const thumb = interaction.fields.getTextInputValue("embed_thumb");
      const footer = interaction.fields.getTextInputValue("embed_footer");

      if (!title && !desc && !thumb && !footer) {
        return safeRespond(interaction, {
          embeds: [
            client.embedBuilder.error(
              client,
              interaction.t("interactions.embedbuilder.field_required"),
            ),
          ],
          flags: [MessageFlags.Ephemeral],
        });
      }

      const embed = new EmbedBuilder();
      if (title) embed.setTitle(title);
      if (desc) embed.setDescription(desc);
      if (color) {
        try {
          embed.setColor(color);
        } catch {
          embed.setColor(client.config.colors.theme || "#2f3136");
        }
      } else {
        embed.setColor(client.config.colors.theme || "#2f3136");
      }
      if (thumb) {
        try {
          embed.setThumbnail(thumb);
        } catch {
          /* ignore invalid url */
        }
      }
      if (footer) embed.setFooter({ text: footer });
      embed.setTimestamp();

      if (interaction.message) {
        try {
          await interaction.update({
            content: null,
            embeds: [embed],
            components: [],
          });
          return true;
        } catch (_) {
          /* fall through to reply */
        }
      }
      await interaction.reply({ embeds: [embed] }).catch(() => {});
      return true;
    }

    return false;
  } catch (e) {
    await safeRespond(interaction, {
      embeds: [
        client.embedBuilder.error(
          client,
          interaction.t("interactions.embedbuilder.process_failed"),
        ),
      ],
      flags: [MessageFlags.Ephemeral],
    });
    return true;
  }
};

module.exports = {
  handleGiveawayInteractions,
  handleEmbedBuilderInteractions,
};
