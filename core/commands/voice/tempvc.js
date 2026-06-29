const {
  PermissionsBitField,
  ChannelType,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
} = require("discord.js");

module.exports = {
  name: "tempvc",
  description:
    "Configure le système TempVC : crée une catégorie, un hub vocal, et un panneau de contrôle avec boutons.",
  category: "voice",
  usage: "+tempvc",
  userPerms: [PermissionsBitField.Flags.Administrator],
  botPerms: [PermissionsBitField.Flags.ManageChannels],
  async execute(client, message, args) {
    const waitMsg = await message
      .reply({
        embeds: [
          client.embedBuilder.info(client, message.t("commands.tempvc.configuring")),
        ],
      })
      .catch(() => null);

    try {
      const category = await message.guild.channels.create({
        name: "TempVC",
        type: ChannelType.GuildCategory,
      });

      const hubVC = await message.guild.channels.create({
        name: message.t("commands.tempvc.hub_channel_name"),
        type: ChannelType.GuildVoice,
        parent: category.id,
      });

      const panelChannel = await message.guild.channels.create({
        name: "panneau-vocal",
        type: ChannelType.GuildText,
        parent: category.id,
      });

      const panelEmbed = new EmbedBuilder()
        .setColor(client.embedBuilder.getTheme(client))
        .setAuthor({
          name: message.t("commands.tempvc.panel_author"),
          iconURL: client.user.displayAvatarURL({ size: 256 }),
        })
        .setDescription(
          [
            message.t("commands.tempvc.panel_desc_line1"),
            message.t("commands.tempvc.panel_desc_line2"),
          ].join("\n"),
        )
        .addFields(
          {
            name: message.t("commands.tempvc.field_config"),
            value: message.t("commands.tempvc.field_config_value"),
            inline: false,
          },
          {
            name: message.t("commands.tempvc.field_access"),
            value: message.t("commands.tempvc.field_access_value"),
            inline: false,
          },
        )
        .setFooter({ text: message.t("commands.tempvc.footer_owner_only") });

      const row1 = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("tempvc_rename")
          .setLabel(message.t("commands.tempvc.btn_rename"))
          .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId("tempvc_limit")
          .setLabel(message.t("commands.tempvc.btn_limit"))
          .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId("tempvc_lock")
          .setLabel(message.t("commands.tempvc.btn_lock"))
          .setStyle(ButtonStyle.Danger),
        new ButtonBuilder()
          .setCustomId("tempvc_unlock")
          .setLabel(message.t("commands.tempvc.btn_unlock"))
          .setStyle(ButtonStyle.Success),
      );

      const row2 = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("tempvc_permit")
          .setLabel(message.t("commands.tempvc.btn_permit"))
          .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
          .setCustomId("tempvc_kick")
          .setLabel(message.t("commands.tempvc.btn_kick"))
          .setStyle(ButtonStyle.Danger),
        new ButtonBuilder()
          .setCustomId("tempvc_claim")
          .setLabel(message.t("commands.tempvc.btn_claim"))
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId("tempvc_delete")
          .setLabel(message.t("commands.tempvc.btn_close"))
          .setStyle(ButtonStyle.Danger),
      );

      await panelChannel
        .send({ embeds: [panelEmbed], components: [row1, row2] })
        .catch(() => {});

      client.db.db
        .prepare(
          "INSERT OR REPLACE INTO tempvc_config (guildId, categoryId, hubId, panelChannelId) VALUES (?, ?, ?, ?)",
        )
        .run(message.guild.id, category.id, hubVC.id, panelChannel.id);

      const successEmbed = client.embedBuilder
        .success(client, message.t("commands.tempvc.configured"))
        .setAuthor({
          name: message.t("commands.tempvc.success_author"),
          iconURL: client.user.displayAvatarURL(),
        })
        .addFields(
          { name: message.t("commands.tempvc.field_hub"), value: `${hubVC}`, inline: true },
          { name: message.t("commands.tempvc.field_category"), value: `${category}`, inline: true },
          { name: message.t("commands.tempvc.field_moderator"), value: `${message.author}`, inline: true },
          { name: message.t("commands.tempvc.field_panel"), value: `${panelChannel}`, inline: true },
        );
      if (waitMsg)
        await waitMsg.edit({ embeds: [successEmbed] }).catch(() => {});
      else await message.reply({ embeds: [successEmbed] }).catch(() => {});
    } catch (err) {
      const errEmbed = client.embedBuilder.error(
        client,
        message.t("commands.tempvc.config_failed"),
      );
      if (waitMsg) await waitMsg.edit({ embeds: [errEmbed] }).catch(() => {});
      else await message.reply({ embeds: [errEmbed] }).catch(() => {});
    }
  },
};
