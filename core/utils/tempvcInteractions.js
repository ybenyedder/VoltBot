const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  MessageFlags,
} = require("discord.js");

const handleTempVCInteractions = async (interaction, client) => {
  if (!interaction.isButton() && !interaction.isModalSubmit()) return;

  const channel = interaction.channel;
  if (!channel || !channel.isVoiceBased()) return;

  const tempVcData = client.db.getTempVCChannel(channel.id);
  if (!tempVcData) {
    // Not a temp VC, ignore (let other handlers process)
    return;
  }
  if (
    tempVcData.ownerId !== interaction.user.id &&
    interaction.customId !== "tempvc_claim"
  ) {
    await interaction.reply({
      content: interaction.t("utils.tempvcInteractions.not_owner"),
      flags: [MessageFlags.Ephemeral],
    });
    return;
  }

  if (interaction.isButton()) {
    switch (interaction.customId) {
      case "tempvc_rename":
        const modal = new ModalBuilder()
          .setTitle(interaction.t("utils.tempvcInteractions.rename_modal_title"))
          .setCustomId("tempvc_rename_modal")
          .addComponents(
            new ActionRowBuilder().addComponents(
              new TextInputBuilder()
                .setCustomId("new_name")
                .setLabel(interaction.t("utils.tempvcInteractions.rename_input_label"))
                .setStyle(TextInputStyle.Short)
                .setPlaceholder(interaction.t("utils.tempvcInteractions.rename_input_placeholder"))
                .setRequired(true)
                .setMaxLength(100),
            ),
          );
        await interaction.showModal(modal);
        break;

      case "tempvc_limit":
        const limitModal = new ModalBuilder()
          .setTitle(interaction.t("utils.tempvcInteractions.limit_modal_title"))
          .setCustomId("tempvc_limit_modal")
          .addComponents(
            new ActionRowBuilder().addComponents(
              new TextInputBuilder()
                .setCustomId("user_limit")
                .setLabel(interaction.t("utils.tempvcInteractions.limit_input_label"))
                .setStyle(TextInputStyle.Short)
                .setPlaceholder(interaction.t("utils.tempvcInteractions.limit_input_placeholder"))
                .setRequired(false)
                .setMaxLength(2),
            ),
          );
        await interaction.showModal(limitModal);
        break;

      case "tempvc_lock":
        await channel.permissionOverwrites.edit(channel.guild.id, {
          Connect: false,
        });
        await interaction.reply({
          embeds: [
            client.embedBuilder.success(
              client,
              interaction.t("utils.tempvcInteractions.locked"),
            ),
          ],
          flags: [MessageFlags.Ephemeral],
        });
        break;

      case "tempvc_unlock":
        await channel.permissionOverwrites.edit(channel.guild.id, {
          Connect: null,
        });
        await interaction.reply({
          embeds: [
            client.embedBuilder.success(
              client,
              interaction.t("utils.tempvcInteractions.unlocked"),
            ),
          ],
          flags: [MessageFlags.Ephemeral],
        });
        break;

      case "tempvc_kick":
        const kickModal = new ModalBuilder()
          .setTitle(interaction.t("utils.tempvcInteractions.kick_modal_title"))
          .setCustomId("tempvc_kick_modal")
          .addComponents(
            new ActionRowBuilder().addComponents(
              new TextInputBuilder()
                .setCustomId("user_to_kick")
                .setLabel(interaction.t("utils.tempvcInteractions.kick_input_label"))
                .setStyle(TextInputStyle.Short)
                .setPlaceholder(interaction.t("utils.tempvcInteractions.user_id_placeholder"))
                .setRequired(true),
            ),
          );
        await interaction.showModal(kickModal);
        break;

      case "tempvc_claim":
        if (!channel.members.has(interaction.user.id)) {
          await interaction.reply({
            embeds: [
              client.embedBuilder.error(
                client,
                interaction.t("utils.tempvcInteractions.claim_must_be_in"),
              ),
            ],
            flags: [MessageFlags.Ephemeral],
          });
          return;
        }
        if (channel.members.has(tempVcData.ownerId)) {
          await interaction.reply({
            embeds: [
              client.embedBuilder.error(
                client,
                interaction.t("utils.tempvcInteractions.claim_owner_present"),
              ),
            ],
            flags: [MessageFlags.Ephemeral],
          });
          return;
        }
        client.db.updateTempVCOwner(channel.id, interaction.user.id);
        await channel.permissionOverwrites
          .edit(interaction.user.id, {
            Connect: true,
            ManageChannels: true,
            MoveMembers: true,
          })
          .catch(() => {});
        await channel.permissionOverwrites
          .edit(tempVcData.ownerId, {
            ManageChannels: null,
            MoveMembers: null,
          })
          .catch(() => {});
        await interaction.reply({
          embeds: [
            client.embedBuilder.success(
              client,
              interaction.t("utils.tempvcInteractions.claim_success"),
            ),
          ],
          flags: [MessageFlags.Ephemeral],
        });
        break;

      case "tempvc_delete":
        const confirmEmbed = client.embedBuilder.warning(
          client,
          interaction.t("utils.tempvcInteractions.delete_confirm"),
        );
        const confirmRow = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId("tempvc_confirm_delete")
            .setLabel(interaction.t("utils.tempvcInteractions.confirm_button"))
            .setStyle(ButtonStyle.Danger),
          new ButtonBuilder()
            .setCustomId("tempvc_cancel_delete")
            .setLabel(interaction.t("utils.tempvcInteractions.cancel_button"))
            .setStyle(ButtonStyle.Secondary),
        );
        await interaction.reply({
          embeds: [confirmEmbed],
          components: [confirmRow],
          flags: [MessageFlags.Ephemeral],
        });
        break;

      case "tempvc_permit":
        const permitModal = new ModalBuilder()
          .setTitle(interaction.t("utils.tempvcInteractions.permit_modal_title"))
          .setCustomId("tempvc_permit_modal")
          .addComponents(
            new ActionRowBuilder().addComponents(
              new TextInputBuilder()
                .setCustomId("user_to_permit")
                .setLabel(interaction.t("utils.tempvcInteractions.permit_input_label"))
                .setStyle(TextInputStyle.Short)
                .setPlaceholder(interaction.t("utils.tempvcInteractions.user_id_placeholder"))
                .setRequired(true),
            ),
          );
        await interaction.showModal(permitModal);
        break;

      case "tempvc_confirm_delete":
        await interaction.deferUpdate().catch(() => {});
        try {
          client.db.deleteTempVCChannel(channel.id);
        } catch (_) {}
        await channel
          .delete("Suppression du salon vocal temporaire")
          .catch(() => {});
        break;

      case "tempvc_cancel_delete":
        await interaction.update({
          embeds: [client.embedBuilder.info(client, interaction.t("utils.tempvcInteractions.delete_cancelled"))],
          components: [],
        });
        break;
    }
  }

  if (interaction.isModalSubmit()) {
    switch (interaction.customId) {
      case "tempvc_rename_modal":
        const newName = interaction.fields.getTextInputValue("new_name");
        if (newName && newName.trim()) {
          await channel.setName(newName.trim());
          await interaction.reply({
            embeds: [
              client.embedBuilder.success(
                client,
                interaction.t("utils.tempvcInteractions.renamed", { name: newName.trim() }),
              ),
            ],
            flags: [MessageFlags.Ephemeral],
          });
        }
        break;

      case "tempvc_limit_modal":
        const limit =
          parseInt(interaction.fields.getTextInputValue("user_limit")) || 0;
        if (limit >= 0 && limit <= 99) {
          await channel.setUserLimit(limit);
          await interaction.reply({
            embeds: [
              client.embedBuilder.success(
                client,
                interaction.t("utils.tempvcInteractions.limit_set", { limit }),
              ),
            ],
            flags: [MessageFlags.Ephemeral],
          });
        }
        break;

      case "tempvc_permit_modal":
        const userToPermit = interaction.fields
          .getTextInputValue("user_to_permit")
          .replace(/[<@!>]/g, "");
        const targetPermit = await interaction.guild.members
          .fetch(userToPermit)
          .catch(() => null);
        if (targetPermit) {
          await channel.permissionOverwrites.edit(targetPermit.id, {
            Connect: true,
          });
          await interaction.reply({
            embeds: [
              client.embedBuilder.success(
                client,
                interaction.t("utils.tempvcInteractions.permit_success", { user: targetPermit.user.tag }),
              ),
            ],
            flags: [MessageFlags.Ephemeral],
          });
        } else {
          await interaction.reply({
            embeds: [
              client.embedBuilder.error(client, interaction.t("utils.tempvcInteractions.user_not_found")),
            ],
            flags: [MessageFlags.Ephemeral],
          });
        }
        break;

      case "tempvc_kick_modal":
        const userToKick = interaction.fields
          .getTextInputValue("user_to_kick")
          .replace(/[<@!>]/g, "");
        if (userToKick === interaction.user.id) {
          await interaction.reply({
            embeds: [
              client.embedBuilder.error(client, interaction.t("utils.tempvcInteractions.self_kick_forbidden")),
            ],
            flags: [MessageFlags.Ephemeral],
          });
          break;
        }
        const targetKick = await interaction.guild.members
          .fetch(userToKick)
          .catch(() => null);
        if (targetKick && targetKick.voice.channelId === channel.id) {
          await targetKick.voice.disconnect().catch(() => {});
          await interaction.reply({
            embeds: [
              client.embedBuilder.success(
                client,
                interaction.t("utils.tempvcInteractions.kick_success", { user: targetKick.user.tag }),
              ),
            ],
            flags: [MessageFlags.Ephemeral],
          });
        } else {
          await interaction.reply({
            embeds: [
              client.embedBuilder.error(
                client,
                interaction.t("utils.tempvcInteractions.kick_not_found"),
              ),
            ],
            flags: [MessageFlags.Ephemeral],
          });
        }
        break;
    }
  }
};

module.exports = handleTempVCInteractions;
