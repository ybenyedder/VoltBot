const Logger = require("../../utils/logger");
const { t } = require("../../utils/i18n");
const {
  PermissionsBitField,
  ChannelType,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  StringSelectMenuBuilder,
  AttachmentBuilder,
  MessageFlags,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ChannelSelectMenuBuilder,
} = require("discord.js");
const Canvas = require("@napi-rs/canvas");
const discordTranscripts = require("discord-html-transcripts");

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

/**
 * Helper pour parser et valider un emoji (unicode ou custom)
 * @param {string} emojiString
 */
const parseEmoji = (emojiString) => {
  if (!emojiString) return null;

  // Format emoji custom: <name:id> ou <:name:id> ou <a:name:id>
  const customEmojiMatch = emojiString.match(/^(?:<a?:)?(\w+):(\d+)>?$/);
  if (customEmojiMatch) {
    return {
      name: customEmojiMatch[1],
      id: customEmojiMatch[2],
      animated: emojiString.includes("<a:"),
    };
  }

  // Si l'émoji contient des caractères alphanumériques sans être un émoji custom,
  // c'est probablement du texte ou un format invalide (ex: ":ticket:", "id", "name")
  if (/[a-zA-Z0-9]/.test(emojiString)) return null;

  // Sinon on assume que c'est de l'unicode (ou au pire Discord rejettera proprement)
  return emojiString;
};

/**
 * Crée le salon de ticket et envoie l'en-tête. Réutilisé par la sélection
 * directe et par le flux modal (raison obligatoire).
 * @param {import("discord.js").Interaction} interaction
 * @param {import("discord.js").Client} client
 * @param {string} optionValue - valeur de l'option sélectionnée (ex: ticket_opt_5)
 * @param {string|null} reason - raison fournie par le membre (ou null)
 */
const createTicketChannel = async (interaction, client, optionValue, reason) => {
  const lang = client.db.getGuild(interaction.guild.id, "language") || "fr";
  const ticketConfig = client.db.getTicketConfig(interaction.guild.id);
  if (!ticketConfig) {
    return safeRespond(interaction, {
      embeds: [
        client.embedBuilder.error(client, t(lang, "tickets.not_configured")),
      ],
      flags: [MessageFlags.Ephemeral],
    });
  }

  const existingTicket = client.db.getTicket(
    interaction.guild.id,
    interaction.user.id,
  );
  if (existingTicket) {
    try {
      const channel = await interaction.guild.channels.fetch(
        existingTicket.channelId,
      );
      if (channel) {
        return safeRespond(interaction, {
          embeds: [
            client.embedBuilder.warning(
              client,
              t(lang, "tickets.already_open", {
                channel: `<#${existingTicket.channelId}>`,
              }),
            ),
          ],
          flags: [MessageFlags.Ephemeral],
        });
      }
    } catch (_) {
      client.db.closeTicket(existingTicket.channelId);
    }
  }

  const permissionOverwrites = [
    {
      id: interaction.guild.id,
      deny: [PermissionsBitField.Flags.ViewChannel],
    },
    {
      id: interaction.user.id,
      allow: [
        PermissionsBitField.Flags.ViewChannel,
        PermissionsBitField.Flags.SendMessages,
        PermissionsBitField.Flags.AttachFiles,
        PermissionsBitField.Flags.EmbedLinks,
        PermissionsBitField.Flags.ReadMessageHistory,
        PermissionsBitField.Flags.AddReactions,
        PermissionsBitField.Flags.UseExternalEmojis,
      ],
    },
  ];

  let selectedRoles = ticketConfig.roleId ? ticketConfig.roleId.split(",") : [];
  let optionName = "Ticket";

  if (
    optionValue.startsWith("ticket_opt_") &&
    optionValue !== "ticket_opt_default"
  ) {
    const optId = optionValue.replace("ticket_opt_", "");
    try {
      const customOpt = client.db.getTicketOption(optId);
      if (customOpt) {
        selectedRoles = customOpt.roleId ? customOpt.roleId.split(",") : [];
        optionName = customOpt.title;
      }
    } catch (e) {
      Logger.error("[Ticket Handler] Error fetching custom ticket option:", e);
    }
  }

  selectedRoles.forEach((rId) => {
    if (rId && interaction.guild.roles.cache.has(rId.trim())) {
      permissionOverwrites.push({
        id: rId.trim(),
        allow: [
          PermissionsBitField.Flags.ViewChannel,
          PermissionsBitField.Flags.SendMessages,
          PermissionsBitField.Flags.AttachFiles,
          PermissionsBitField.Flags.EmbedLinks,
          PermissionsBitField.Flags.ReadMessageHistory,
          PermissionsBitField.Flags.AddReactions,
          PermissionsBitField.Flags.UseExternalEmojis,
          PermissionsBitField.Flags.ManageMessages,
        ],
      });
    }
  });

  await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });

  const channel = await interaction.guild.channels.create({
    name: `ticket-${interaction.user.username}`,
    type: ChannelType.GuildText,
    parent: ticketConfig.categoryId || null,
    permissionOverwrites: permissionOverwrites,
  });

  client.db.createTicket(
    channel.id,
    interaction.guild.id,
    interaction.user.id,
    optionName,
  );

  const embed = new EmbedBuilder()
    .setColor(client.embedBuilder.getTheme(client))
    .setAuthor({
      name: t(lang, "tickets.header_author", {
        user: interaction.user.username,
      }),
      iconURL: interaction.user.displayAvatarURL({ size: 256 }),
    })
    .addFields(
      {
        name: t(lang, "tickets.field_author"),
        value: `${interaction.user}`,
        inline: true,
      },
      {
        name: t(lang, "tickets.field_category"),
        value: `**${optionName}**`,
        inline: true,
      },
      {
        name: t(lang, "tickets.field_status"),
        value: t(lang, "tickets.status_open"),
        inline: true,
      },
    );

  if (reason && reason.trim()) {
    embed.addFields({
      name: t(lang, "tickets.field_reason"),
      value: reason.trim().slice(0, 1024),
      inline: false,
    });
  }

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("ticket_close")
      .setLabel(t(lang, "interactions.tickets.btn_close"))
      .setStyle(ButtonStyle.Danger),
    new ButtonBuilder()
      .setCustomId("ticket_claim")
      .setLabel(t(lang, "interactions.tickets.btn_claim"))
      .setStyle(ButtonStyle.Secondary),
  );

  const pings = selectedRoles
    .filter((rId) => rId && interaction.guild.roles.cache.has(rId.trim()))
    .map((rId) => `<@&${rId.trim()}>`)
    .join(" ");

  await channel
    .send({
      content: `${interaction.user} ${pings}`,
      embeds: [embed],
      components: [row],
    })
    .catch(() => {});
  await channel
    .setTopic(`Ticket de ${interaction.user.tag} — ${optionName}`)
    .catch(() => {});

  return interaction
    .editReply({
      embeds: [
        client.embedBuilder.success(
          client,
          t(lang, "tickets.opened", { channel: `${channel}` }),
        ),
      ],
    })
    .catch(() => {});
};

// Handler pour la vérification CAPTCHA
const handleCaptchaInteractions = async (interaction, client) => {
  try {
    if (interaction.customId === "verify_captcha_start") {
      const config = client.db.getVerifyConfig(interaction.guild.id);
      if (!config || !config.roleId) {
        return safeRespond(interaction, {
          embeds: [
            client.embedBuilder.error(
              client,
              interaction.t("interactions.captcha.not_configured"),
            ),
          ],
          flags: [MessageFlags.Ephemeral],
        });
      }

      if (interaction.member.roles.cache.has(config.roleId)) {
        return safeRespond(interaction, {
          embeds: [
            client.embedBuilder.warning(
              client,
              interaction.t("interactions.captcha.already_verified"),
            ),
          ],
          flags: [MessageFlags.Ephemeral],
        });
      }

      const code = Math.random().toString(36).substring(2, 8).toUpperCase();

      const canvas = Canvas.createCanvas(200, 100);
      const ctx = canvas.getContext("2d");

      ctx.fillStyle = "#2C2F33";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 2;
      for (let i = 0; i < 5; i++) {
        ctx.beginPath();
        ctx.moveTo(Math.random() * 200, Math.random() * 100);
        ctx.lineTo(Math.random() * 200, Math.random() * 100);
        ctx.stroke();
      }

      ctx.font = "30px sans-serif";
      ctx.fillStyle = "#ffffff";
      ctx.fillText(code, 40, 60);

      const attachment = new AttachmentBuilder(await canvas.encode("png"), {
        name: "captcha.png",
      });

      await interaction
        .reply({
          content: interaction.t("interactions.captcha.enter_code"),
          files: [attachment],
          flags: [MessageFlags.Ephemeral],
        })
        .catch(() => {});

      const filter = (m) => m.author.id === interaction.user.id;
      const collector = interaction.channel.createMessageCollector({
        filter,
        time: 60000,
        max: 1,
      });

      collector.on("collect", async (m) => {
        await m.delete().catch(() => {});
        if (m.content.trim().toUpperCase() === code) {
          await interaction.member.roles.add(config.roleId).catch(() => {});
          const successEmbed = client.embedBuilder
            .success(client, interaction.t("interactions.captcha.confirmed"))
            .addFields({
              name: interaction.t("interactions.captcha.role_granted"),
              value: `<@&${config.roleId}>`,
              inline: true,
            });
          await interaction
            .followUp({
              embeds: [successEmbed],
              flags: [MessageFlags.Ephemeral],
            })
            .catch(() => {});
        } else {
          await interaction
            .followUp({
              embeds: [
                client.embedBuilder.error(
                  client,
                  interaction.t("interactions.captcha.wrong_code"),
                ),
              ],
              flags: [MessageFlags.Ephemeral],
            })
            .catch(() => {});
        }
      });
      return true;
    }

    return false;
  } catch (e) {
    await safeRespond(interaction, {
      embeds: [
        client.embedBuilder.error(
          client,
          interaction.t("interactions.captcha.failed"),
        ),
      ],
      flags: [MessageFlags.Ephemeral],
    });
    return true;
  }
};

// Handler pour les tickets
const handleTicketInteractions = async (interaction, client) => {
  try {
    if (
      interaction.isStringSelectMenu() &&
      interaction.customId === "ticket_select"
    ) {
      const lang = client.db.getGuild(interaction.guild.id, "language") || "fr";
      const ticketConfig = client.db.getTicketConfig(interaction.guild.id);
      if (!ticketConfig) {
        return safeRespond(interaction, {
          embeds: [
            client.embedBuilder.error(
              client,
              t(lang, "tickets.not_configured"),
            ),
          ],
          flags: [MessageFlags.Ephemeral],
        });
      }

      const optionValue = interaction.values[0];

      // Raison obligatoire : on présente un modal avant de créer le ticket.
      if (ticketConfig.requireReason) {
        const modal = new ModalBuilder()
          .setCustomId(`ticket_reason_${optionValue}`)
          .setTitle(t(lang, "tickets.reason_modal_title"));

        const input = new TextInputBuilder()
          .setCustomId("ticket_reason_input")
          .setLabel(t(lang, "tickets.reason_input_label"))
          .setPlaceholder(t(lang, "tickets.reason_input_placeholder"))
          .setStyle(TextInputStyle.Paragraph)
          .setRequired(true)
          .setMaxLength(500);

        modal.addComponents(new ActionRowBuilder().addComponents(input));
        return interaction.showModal(modal);
      }

      return createTicketChannel(interaction, client, optionValue, null);
    }

    // Soumission du modal de raison → création du ticket avec la raison.
    if (
      interaction.isModalSubmit() &&
      interaction.customId.startsWith("ticket_reason_")
    ) {
      const optionValue = interaction.customId.replace("ticket_reason_", "");
      const reason = interaction.fields.getTextInputValue("ticket_reason_input");
      return createTicketChannel(interaction, client, optionValue, reason);
    }

    // Close ticket confirmation — ephemeral so it doesn't pollute the ticket
    if (interaction.customId === "ticket_close") {
      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("ticket_confirm_close")
          .setLabel(interaction.t("interactions.tickets.btn_close"))
          .setStyle(ButtonStyle.Danger),
        new ButtonBuilder()
          .setCustomId("ticket_cancel_close")
          .setLabel(interaction.t("interactions.tickets.btn_cancel"))
          .setStyle(ButtonStyle.Secondary),
      );
      return interaction.reply({
        embeds: [
          client.embedBuilder.warning(
            client,
            interaction.t("interactions.tickets.confirm_close"),
          ),
        ],
        components: [row],
        flags: [MessageFlags.Ephemeral],
      });
    }

    // Claim ticket — update channel topic + edit header embed in place
    if (interaction.customId === "ticket_claim") {
      if (!interaction.member.permissions.has("ManageMessages")) {
        return safeRespond(interaction, {
          embeds: [
            client.embedBuilder.error(
              client,
              interaction.t("interactions.tickets.no_permission"),
            ),
          ],
          flags: [MessageFlags.Ephemeral],
        });
      }

      try {
        client.db.claimTicket(interaction.channel.id, interaction.user.id);
      } catch (e) {
        Logger.error("[Ticket Claim] persistance échouée:", e?.message || e);
      }

      const lang = client.db.getGuild(interaction.guild.id, "language") || "fr";
      const claimedAt = Math.floor(Date.now() / 1000);

      const baseEmbed = interaction.message.embeds[0]
        ? EmbedBuilder.from(interaction.message.embeds[0])
        : new EmbedBuilder().setAuthor({ name: "Ticket" });

      // Réécrit le champ statut en place s'il existe (FR ou EN), sinon l'ajoute.
      const statusNames = ["Statut", "Status"];
      const statutValue = t(lang, "tickets.status_claimed", {
        user: `${interaction.user}`,
        time: claimedAt,
      });
      const data = baseEmbed.data || {};
      const fields = (data.fields || []).map((f) =>
        statusNames.includes(f.name) ? { ...f, value: statutValue } : f,
      );
      if (!fields.some((f) => statusNames.includes(f.name))) {
        fields.push({
          name: t(lang, "tickets.field_status"),
          value: statutValue,
          inline: true,
        });
      }
      baseEmbed.setFields(fields);
      baseEmbed.setColor("#FFD700");

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("ticket_close")
          .setLabel(t(lang, "interactions.tickets.btn_close"))
          .setStyle(ButtonStyle.Danger),
      );

      const prevTopic = interaction.channel.topic || "";
      await interaction.channel
        .setTopic(
          `${prevTopic.split(" — pris par ")[0]} — pris par ${interaction.user.tag}`,
        )
        .catch(() => {});

      await interaction.update({ embeds: [baseEmbed], components: [row] });

      // Message simple (pas d'embed) annonçant la prise en charge.
      await interaction.channel
        .send({
          content: t(lang, "tickets.claim_message", {
            user: `${interaction.user}`,
          }),
        })
        .catch(() => {});
      return;
    }

    // Cancel close — ephemeral confirmation now, so just acknowledge silently
    if (interaction.customId === "ticket_cancel_close") {
      try {
        return await interaction.update({
          embeds: [
            client.embedBuilder.info(
              client,
              interaction.t("interactions.tickets.close_cancelled"),
            ),
          ],
          components: [],
        });
      } catch (_) {
        return interaction.message?.delete().catch(() => {});
      }
    }

    // Confirm close — transcript attached + close-summary embed
    if (interaction.customId === "ticket_confirm_close") {
      const channelName = interaction.channel.name;
      const closedAt = Math.floor(Date.now() / 1000);

      client.db.closeTicket(interaction.channel.id);

      const transcript = await discordTranscripts.createTranscript(
        interaction.channel,
        {
          limit: -1,
          returnType: "attachment",
          filename: `${channelName}-transcript.html`,
          saveImages: true,
          poweredBy: false,
        },
      );

      const summary = new EmbedBuilder()
        .setColor(client.embedBuilder.getTheme(client))
        .setAuthor({
          name: interaction.t("interactions.tickets.closed_author", {
            channel: channelName,
          }),
          iconURL: interaction.user.displayAvatarURL({ size: 256 }),
        })
        .addFields(
          {
            name: interaction.t("interactions.tickets.field_channel"),
            value: `\`${channelName}\``,
            inline: true,
          },
          {
            name: interaction.t("interactions.tickets.field_closed_by"),
            value: `${interaction.user}`,
            inline: true,
          },
          {
            name: interaction.t("interactions.tickets.field_date"),
            value: `<t:${closedAt}:f>`,
            inline: true,
          },
        );

      await interaction
        .reply({
          embeds: [summary],
          files: [transcript],
        })
        .catch(() => {});

      const ticketConfig = client.db.getTicketConfig(interaction.guild.id);
      if (ticketConfig && ticketConfig.logsChannelId) {
        const logsChannel = interaction.guild.channels.cache.get(
          ticketConfig.logsChannelId,
        );
        if (logsChannel) {
          const logTranscript = await discordTranscripts.createTranscript(
            interaction.channel,
            {
              limit: -1,
              returnType: "attachment",
              filename: `${channelName}-transcript.html`,
              saveImages: true,
              poweredBy: false,
            },
          );
          await logsChannel
            .send({
              embeds: [summary],
              files: [logTranscript],
            })
            .catch(() => {});
        }
      }

      setTimeout(() => {
        interaction.channel.delete().catch(() => {});
      }, 5000);
      return true;
    }

    return false;
  } catch (e) {
    Logger.error("[Ticket Handler]", e?.message || e);
    await safeRespond(interaction, {
      embeds: [
        client.embedBuilder.error(
          client,
          interaction.t("interactions.tickets.error_generic"),
        ),
      ],
      flags: [MessageFlags.Ephemeral],
    });
    return true;
  }
};

// Handler pour la configuration des options de tickets
const handleTicketOptionInteraction = async (interaction, client) => {
  try {
    const {
      buildTicketOptionEmbed,
      buildTicketOptionComponents,
    } = require("../../commands/tickets/ticketaddoption");

    if (!client.ticketOptionState) client.ticketOptionState = new Map();

    // --- Title Button ---
    if (interaction.isButton() && interaction.customId === "ticketopt_title") {
      const modal = new ModalBuilder()
        .setCustomId("ticketopt_modal_title")
        .setTitle(interaction.t("interactions.tickets.opt_title_modal_title"));

      const input = new TextInputBuilder()
        .setCustomId("ticketopt_input_title")
        .setLabel(interaction.t("interactions.tickets.opt_title_label"))
        .setPlaceholder(
          interaction.t("interactions.tickets.opt_title_placeholder"),
        )
        .setStyle(TextInputStyle.Short)
        .setRequired(true)
        .setMaxLength(50);

      modal.addComponents(new ActionRowBuilder().addComponents(input));
      return interaction.showModal(modal);
    }

    // --- Emoji Button ---
    if (interaction.isButton() && interaction.customId === "ticketopt_emoji") {
      const modal = new ModalBuilder()
        .setCustomId("ticketopt_modal_emoji")
        .setTitle(interaction.t("interactions.tickets.opt_emoji_modal_title"));

      const input = new TextInputBuilder()
        .setCustomId("ticketopt_input_emoji")
        .setLabel(interaction.t("interactions.tickets.opt_emoji_label"))
        .setPlaceholder(
          interaction.t("interactions.tickets.opt_emoji_placeholder"),
        )
        .setStyle(TextInputStyle.Short)
        .setRequired(true)
        .setMaxLength(50);

      modal.addComponents(new ActionRowBuilder().addComponents(input));
      return interaction.showModal(modal);
    }

    // --- Description Button ---
    if (
      interaction.isButton() &&
      interaction.customId === "ticketopt_description"
    ) {
      const modal = new ModalBuilder()
        .setCustomId("ticketopt_modal_description")
        .setTitle(interaction.t("interactions.tickets.opt_desc_modal_title"));

      const input = new TextInputBuilder()
        .setCustomId("ticketopt_input_description")
        .setLabel(interaction.t("interactions.tickets.opt_desc_label"))
        .setPlaceholder(
          interaction.t("interactions.tickets.opt_desc_placeholder"),
        )
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(false)
        .setMaxLength(100);

      modal.addComponents(new ActionRowBuilder().addComponents(input));
      return interaction.showModal(modal);
    }

    // --- Role Select ---
    if (
      interaction.isRoleSelectMenu() &&
      interaction.customId === "ticketopt_role"
    ) {
      const state = client.ticketOptionState.get(interaction.user.id);
      if (!state) {
        return interaction.reply({
          content: interaction.t("interactions.tickets.opt_session_expired"),
          flags: [MessageFlags.Ephemeral],
        });
      }

      state.roleId = interaction.values[0];
      client.ticketOptionState.set(interaction.user.id, state);

      const embed = buildTicketOptionEmbed(state, client);
      return interaction.update({
        embeds: [embed],
        components: buildTicketOptionComponents(),
      });
    }

    // --- Modal Submits ---
    if (
      interaction.isModalSubmit() &&
      interaction.customId === "ticketopt_modal_title"
    ) {
      const state = client.ticketOptionState.get(interaction.user.id);
      if (!state) {
        return interaction.reply({
          content: interaction.t("interactions.tickets.opt_session_expired"),
          flags: [MessageFlags.Ephemeral],
        });
      }

      state.title = interaction.fields.getTextInputValue(
        "ticketopt_input_title",
      );
      client.ticketOptionState.set(interaction.user.id, state);

      const embed = buildTicketOptionEmbed(state, client);
      return interaction.update({
        embeds: [embed],
        components: buildTicketOptionComponents(),
      });
    }

    if (
      interaction.isModalSubmit() &&
      interaction.customId === "ticketopt_modal_emoji"
    ) {
      const state = client.ticketOptionState.get(interaction.user.id);
      if (!state) {
        return interaction.reply({
          content: interaction.t("interactions.tickets.opt_session_expired"),
          flags: [MessageFlags.Ephemeral],
        });
      }

      state.emoji = interaction.fields.getTextInputValue(
        "ticketopt_input_emoji",
      );

      // Validation immédiate
      if (!parseEmoji(state.emoji)) {
        return interaction.reply({
          embeds: [
            client.embedBuilder.error(
              client,
              interaction.t("interactions.tickets.opt_emoji_invalid"),
            ),
          ],
          flags: [MessageFlags.Ephemeral],
        });
      }

      client.ticketOptionState.set(interaction.user.id, state);

      const embed = buildTicketOptionEmbed(state, client);
      return interaction.update({
        embeds: [embed],
        components: buildTicketOptionComponents(),
      });
    }

    if (
      interaction.isModalSubmit() &&
      interaction.customId === "ticketopt_modal_description"
    ) {
      const state = client.ticketOptionState.get(interaction.user.id);
      if (!state) {
        return interaction.reply({
          content: interaction.t("interactions.tickets.opt_session_expired"),
          flags: [MessageFlags.Ephemeral],
        });
      }

      state.description =
        interaction.fields.getTextInputValue("ticketopt_input_description") ||
        interaction.t("interactions.tickets.opt_default_description");
      client.ticketOptionState.set(interaction.user.id, state);

      const embed = buildTicketOptionEmbed(state, client);
      return interaction.update({
        embeds: [embed],
        components: buildTicketOptionComponents(),
      });
    }

    // --- Save Button ---
    if (interaction.isButton() && interaction.customId === "ticketopt_save") {
      const state = client.ticketOptionState.get(interaction.user.id);
      if (!state) {
        return interaction.reply({
          content: interaction.t("interactions.tickets.opt_session_expired"),
          flags: [MessageFlags.Ephemeral],
        });
      }

      if (!state.title || !state.emoji || !state.roleId) {
        return interaction.reply({
          embeds: [
            client.embedBuilder.error(
              client,
              interaction.t("interactions.tickets.opt_missing_fields"),
            ),
          ],
          flags: [MessageFlags.Ephemeral],
        });
      }

      // Save to database
      try {
        client.db.db
          .prepare(
            "INSERT INTO ticket_options (guildId, title, emoji, roleId, description) VALUES (?, ?, ?, ?, ?)",
          )
          .run(
            state.guildId,
            state.title,
            state.emoji,
            state.roleId,
            state.description ||
              interaction.t("interactions.tickets.opt_default_description"),
          );

        // Clean up state
        client.ticketOptionState.delete(interaction.user.id);

        const role = interaction.guild.roles.cache.get(state.roleId);
        const successEmbed = new EmbedBuilder()
          .setColor("#57F287")
          .setAuthor({
            name: interaction.t("interactions.tickets.opt_added_author", {
              title: state.title,
            }),
          })
          .addFields(
            {
              name: interaction.t("interactions.tickets.opt_field_emoji"),
              value: `${state.emoji}`,
              inline: true,
            },
            {
              name: interaction.t("interactions.tickets.opt_field_role"),
              value: `${role || state.roleId}`,
              inline: true,
            },
            {
              name: interaction.t("interactions.tickets.opt_field_description"),
              value: `\`${state.description || interaction.t("interactions.tickets.opt_default_description")}\``,
              inline: false,
            },
          );

        return interaction.update({ embeds: [successEmbed], components: [] });
      } catch (err) {
        return interaction.reply({
          content: interaction.t("interactions.tickets.opt_save_error"),
          flags: [MessageFlags.Ephemeral],
        });
      }
    }

    // --- Cancel Button ---
    if (interaction.isButton() && interaction.customId === "ticketopt_cancel") {
      client.ticketOptionState.delete(interaction.user.id);

      const cancelEmbed = new EmbedBuilder()
        .setColor("#ED4245")
        .setDescription(interaction.t("interactions.tickets.opt_cancelled"));

      return interaction.update({ embeds: [cancelEmbed], components: [] });
    }

    return false;
  } catch (e) {
    Logger.error("[Ticket Option Handler]", e?.message || e);
    await safeRespond(interaction, {
      embeds: [
        client.embedBuilder.error(
          client,
          interaction.t("interactions.tickets.opt_config_failed"),
        ),
      ],
      flags: [MessageFlags.Ephemeral],
    });
    return true;
  }
};

// Handler pour le panel d'administration des tickets (ticketgui)
const handleTicketGUIPanelInteractions = async (interaction, client) => {
  try {
    const permissions = require("../../utils/permissions");

    if (interaction.isButton() && interaction.customId === "ticketgui_deploy") {
      if (
        !permissions.isAdmin(
          { author: interaction.user, member: interaction.member },
          client,
        )
      )
        return interaction.reply({
          content: interaction.t("interactions.tickets.gui_admin_only"),
          flags: [MessageFlags.Ephemeral],
        });

      const row = new ActionRowBuilder().addComponents(
        new ChannelSelectMenuBuilder()
          .setCustomId("ticketgui_select_channel")
          .setPlaceholder(
            interaction.t("interactions.tickets.gui_channel_placeholder"),
          )
          .setChannelTypes([ChannelType.GuildText]),
      );

      return interaction.reply({
        content: interaction.t("interactions.tickets.gui_choose_channel"),
        components: [row],
        flags: [MessageFlags.Ephemeral],
      });
    }

    if (
      interaction.isChannelSelectMenu() &&
      interaction.customId === "ticketgui_select_channel"
    ) {
      if (
        !permissions.isAdmin(
          { author: interaction.user, member: interaction.member },
          client,
        )
      )
        return;

      const targetChannelId = interaction.values[0];
      const targetChannel =
        interaction.guild.channels.cache.get(targetChannelId);

      if (!targetChannel)
        return interaction.reply({
          content: interaction.t("interactions.tickets.gui_channel_not_found"),
          flags: [MessageFlags.Ephemeral],
        });

      // S'assurer qu'une config existe
      const config = client.db.getTicketConfig(interaction.guild.id);
      if (!config) {
        client.db.db
          .prepare("INSERT OR IGNORE INTO tickets_config (guildId) VALUES (?)")
          .run(interaction.guild.id);
      }

      const lang = client.db.getGuild(interaction.guild.id, "language") || "fr";

      const embed = client.embedBuilder
        .base(
          client,
          t(lang, "tickets.panel_title"),
          t(lang, "tickets.panel_description"),
        )
        .setThumbnail(interaction.guild.iconURL({ dynamic: true }));

      const optionsRow = client.db.db
        .prepare("SELECT * FROM ticket_options WHERE guildId = ?")
        .all(interaction.guild.id);

      const selectOptions =
        optionsRow.length > 0
          ? optionsRow.map((opt) => {
              const emoji = parseEmoji(opt.emoji);
              const o = {
                label: opt.title,
                description:
                  opt.description || t(lang, "tickets.default_option_description"),
                value: `ticket_opt_${opt.id}`,
              };
              if (emoji) o.emoji = emoji;
              return o;
            })
          : [
              {
                label: t(lang, "tickets.default_option_label"),
                description: t(lang, "tickets.default_option_description"),
                value: "ticket_opt_default",
              },
            ];

      const selectMenu = new StringSelectMenuBuilder()
        .setCustomId("ticket_select")
        .setPlaceholder(t(lang, "tickets.panel_placeholder"))
        .addOptions(selectOptions);

      const panelRow = new ActionRowBuilder().addComponents(selectMenu);

      try {
        await targetChannel.send({ embeds: [embed], components: [panelRow] });
      } catch (sendError) {
        Logger.error("[Ticket Deploy Error]:", sendError?.message || sendError);
        return interaction.reply({
          embeds: [
            client.embedBuilder.error(
              client,
              t(lang, "interactions.tickets.gui_deploy_failed"),
            ),
          ],
          flags: [MessageFlags.Ephemeral],
        });
      }

      return interaction.update({
        embeds: [
          client.embedBuilder.success(
            client,
            t(lang, "interactions.tickets.gui_deployed", {
              channel: `${targetChannel}`,
            }),
          ),
        ],
        content: null,
        components: [],
      });
    }

    if (interaction.isButton() && interaction.customId === "ticketgui_addopt") {
      if (
        !permissions.isAdmin(
          { author: interaction.user, member: interaction.member },
          client,
        )
      )
        return;

      const ticketAddCmd = client.commands.get("ticketaddoption");
      if (!ticketAddCmd)
        return interaction.reply({
          content: interaction.t("interactions.tickets.gui_cmd_not_found"),
          flags: [MessageFlags.Ephemeral],
        });

      return ticketAddCmd.execute(
        client,
        {
          author: interaction.user,
          guild: interaction.guild,
          channel: interaction.channel,
          member: interaction.member,
          reply: (c) =>
            interaction.reply({ ...c, flags: [MessageFlags.Ephemeral] }),
        },
        [],
      );
    }

    if (interaction.isButton() && interaction.customId === "ticketgui_delopt") {
      if (
        !permissions.isAdmin(
          { author: interaction.user, member: interaction.member },
          client,
        )
      )
        return;

      try {
        const optionsRow = client.db.db
          .prepare("SELECT * FROM ticket_options WHERE guildId = ?")
          .all(interaction.guild.id);
        if (optionsRow.length === 0) {
          return interaction.reply({
            content: interaction.t("interactions.tickets.gui_no_options"),
            flags: [MessageFlags.Ephemeral],
          });
        }

        const delSelect = new StringSelectMenuBuilder()
          .setCustomId("ticketgui_select_del")
          .setPlaceholder(
            interaction.t("interactions.tickets.gui_del_placeholder"),
          )
          .addOptions(
            optionsRow.map((opt) => ({
              label: opt.title,
              description: `ID: ${opt.id}`,
              value: `delopt_${opt.id}`,
            })),
          );

        const row = new ActionRowBuilder().addComponents(delSelect);
        return interaction.reply({
          content: interaction.t("interactions.tickets.gui_del_choose"),
          components: [row],
          flags: [MessageFlags.Ephemeral],
        });
      } catch (e) {
        return interaction.reply({
          content: interaction.t("interactions.tickets.gui_read_error"),
          flags: [MessageFlags.Ephemeral],
        });
      }
    }

    if (
      interaction.isStringSelectMenu() &&
      interaction.customId === "ticketgui_select_del"
    ) {
      if (
        !permissions.isAdmin(
          { author: interaction.user, member: interaction.member },
          client,
        )
      )
        return;

      const optId = interaction.values[0].replace("delopt_", "");
      client.db.db
        .prepare("DELETE FROM ticket_options WHERE id = ? AND guildId = ?")
        .run(optId, interaction.guild.id);

      return interaction.update({
        embeds: [
          client.embedBuilder.success(
            client,
            interaction.t("interactions.tickets.gui_option_deleted"),
          ),
        ],
        content: null,
        components: [],
      });
    }

    return false;
  } catch (e) {
    Logger.error("[Ticket GUI Handler]", e?.message || e);
    await safeRespond(interaction, {
      embeds: [
        client.embedBuilder.error(
          client,
          interaction.t("interactions.tickets.gui_error"),
        ),
      ],
      flags: [MessageFlags.Ephemeral],
    });
    return true;
  }
};

module.exports = {
  handleCaptchaInteractions,
  handleTicketInteractions,
  handleTicketOptionInteraction,
  handleTicketGUIPanelInteractions,
};
