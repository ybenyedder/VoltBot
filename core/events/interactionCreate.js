const {
  PermissionsBitField,
  ChannelType,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  AttachmentBuilder,
  UserSelectMenuBuilder,
  ChannelSelectMenuBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  MessageFlags,
} = require("discord.js");
const Logger = require("../utils/logger");
const {
  handleGiveawayInteractions,
  handleEmbedBuilderInteractions,
} = require("./interactionHandlers/giveawayEmbedHandlers");
const {
  handleCaptchaInteractions,
  handleTicketInteractions,
  handleTicketOptionInteraction,
  handleTicketGUIPanelInteractions,
} = require("./interactionHandlers/captchaTicketHandlers");
const {
  handleConfigMenuInteractions,
} = require("./interactionHandlers/configMenuHandlers");
const {
  handleCasinoInteractions,
} = require("./interactionHandlers/casinoHandlers");
const {
  handleButtonRoleInteractions,
} = require("./interactionHandlers/buttonRoleHandlers");
const handleTempVCInteractions = require("../utils/tempvcInteractions");
const { findBadword } = require("../utils/badwords");
const { t } = require("../utils/i18n");

// Helper pour générer un ID unique
const generateId = () => Math.random().toString(36).substring(2, 12);

// Helper pour mettre à jour l'embed de composition de lettres
const updateComposeEmbed = (state, userName, client, lang = "fr") => {
  const undefinedTag = t(lang, "interactions.lettres.undefined_tag");
  const embed = new EmbedBuilder()
    .setColor(client.embedBuilder.getTheme(client))
    .setTitle(t(lang, "interactions.lettres.compose_title"))
    .setDescription(
      t(lang, "interactions.lettres.compose_intro") +
        "\n\n" +
        t(lang, "interactions.lettres.field_target") +
        "\n" +
        (userName ? `@${userName}` : undefinedTag) +
        "\n\n" +
        t(lang, "interactions.lettres.field_channel") +
        "\n" +
        (state.targetChannel ? `<#${state.targetChannel}>` : undefinedTag) +
        "\n\n" +
        t(lang, "interactions.lettres.field_message") +
        "\n" +
        (state.message
          ? `\`${state.message.substring(0, 50)}${state.message.length > 50 ? "..." : ""}\``
          : undefinedTag) +
        "\n\n" +
        `<t:${Math.floor(Date.now() / 1000)}:t>`,
    );
  return embed;
};

// Handler pour les lettres anonymes
const handleLetterInteractions = async (interaction, client) => {
  // LETTRES ANONYMES — Composer
  if (interaction.isButton() && interaction.customId === "lettres_start") {
    // Cooldown check
    if (!client.lettresCooldown) client.lettresCooldown = new Map();
    const cd = client.lettresCooldown.get(interaction.user.id);
    if (cd && Date.now() - cd < 30000) {
      const remaining = Math.ceil((30000 - (Date.now() - cd)) / 1000);
      return interaction.reply({
        content: interaction.t("interactions.lettres.cooldown", { remaining }),
        flags: [MessageFlags.Ephemeral],
      });
    }

    // Init state for this user
    if (!client.lettresState) client.lettresState = new Map();
    client.lettresState.set(interaction.user.id, {
      targetUser: null,
      targetChannel: null,
      message: null,
      sourceChannel: interaction.channelId,
      _createdAt: Date.now(),
    });

    const undefinedTag = interaction.t("interactions.lettres.undefined_tag");
    const embed = new EmbedBuilder()
      .setColor(client.embedBuilder.getTheme(client))
      .setTitle(interaction.t("interactions.lettres.compose_title"))
      .setDescription(
        interaction.t("interactions.lettres.compose_intro") +
          "\n\n" +
          interaction.t("interactions.lettres.field_target") +
          "\n" + undefinedTag + "\n\n" +
          interaction.t("interactions.lettres.field_channel") +
          "\n" + undefinedTag + "\n\n" +
          interaction.t("interactions.lettres.field_message") +
          "\n" + undefinedTag + "\n\n" +
          `<t:${Math.floor(Date.now() / 1000)}:t>`,
      );

    const userSelect = new ActionRowBuilder().addComponents(
      new UserSelectMenuBuilder()
        .setCustomId("lettres_user")
        .setPlaceholder(interaction.t("interactions.lettres.select_user")),
    );

    const channelSelect = new ActionRowBuilder().addComponents(
      new ChannelSelectMenuBuilder()
        .setCustomId("lettres_channel")
        .setPlaceholder(interaction.t("interactions.lettres.select_channel"))
        .setChannelTypes([ChannelType.GuildText]),
    );

    const buttons = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("lettres_write")
        .setLabel(interaction.t("interactions.lettres.btn_write"))
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId("lettres_send")
        .setStyle(ButtonStyle.Success),
    );

    return interaction.reply({
      embeds: [embed],
      components: [userSelect, channelSelect, buttons],
      flags: [MessageFlags.Ephemeral],
    });
  }

  // User select
  if (
    interaction.isUserSelectMenu() &&
    interaction.customId === "lettres_user"
  ) {
    if (!client.lettresState) client.lettresState = new Map();
    const state = client.lettresState.get(interaction.user.id) || {
      targetUser: null,
      targetChannel: null,
      message: null,
    };
    state.targetUser = interaction.values[0];
    client.lettresState.set(interaction.user.id, state);

    const user = await client.users.fetch(state.targetUser).catch(() => null);
    const userName = user
      ? user.username
      : interaction.t("interactions.lettres.unknown_user");

    return interaction.update({
      embeds: [updateComposeEmbed(state, userName, client, interaction.lang)],
      components: interaction.message.components,
    });
  }

  // Channel select
  if (
    interaction.isChannelSelectMenu() &&
    interaction.customId === "lettres_channel"
  ) {
    if (!client.lettresState) client.lettresState = new Map();
    const state = client.lettresState.get(interaction.user.id) || {
      targetUser: null,
      targetChannel: null,
      message: null,
    };
    state.targetChannel = interaction.values[0];
    client.lettresState.set(interaction.user.id, state);

    const user = state.targetUser
      ? (await client.users.fetch(state.targetUser).catch(() => null))
          ?.username || interaction.t("interactions.lettres.unknown_user")
      : null;

    return interaction.update({
      embeds: [updateComposeEmbed(state, user, client, interaction.lang)],
      components: interaction.message.components,
    });
  }

  // Write message (modal)
  if (interaction.isButton() && interaction.customId === "lettres_write") {
    const modal = new ModalBuilder()
      .setCustomId("lettres_modal")
      .setTitle(interaction.t("interactions.lettres.modal_title"));

    const input = new TextInputBuilder()
      .setCustomId("lettres_text")
      .setLabel(interaction.t("interactions.lettres.modal_input_label"))
      .setPlaceholder(interaction.t("interactions.lettres.modal_input_placeholder"))
      .setStyle(TextInputStyle.Paragraph)
      .setRequired(true)
      .setMaxLength(1000);

    modal.addComponents(new ActionRowBuilder().addComponents(input));
    return interaction.showModal(modal);
  }

  // Modal submit
  if (interaction.isModalSubmit() && interaction.customId === "lettres_modal") {
    if (!client.lettresState) client.lettresState = new Map();
    const state = client.lettresState.get(interaction.user.id) || {
      targetUser: null,
      targetChannel: null,
      message: null,
    };
    state.message = interaction.fields.getTextInputValue("lettres_text");
    client.lettresState.set(interaction.user.id, state);

    const user = state.targetUser
      ? (await client.users.fetch(state.targetUser).catch(() => null))
          ?.username || interaction.t("interactions.lettres.unknown_user")
      : null;

    return interaction.update({
      embeds: [updateComposeEmbed(state, user, client, interaction.lang)],
      components: interaction.message.components,
    });
  }

  // Send letter
  if (interaction.isButton() && interaction.customId === "lettres_send") {
    if (!client.lettresState) client.lettresState = new Map();
    const state = client.lettresState.get(interaction.user.id);

    if (!state || !state.targetUser || !state.targetChannel || !state.message) {
      return interaction.reply({
        content: interaction.t("interactions.lettres.missing_fields"),
        flags: [MessageFlags.Ephemeral],
      });
    }

    // Anti-link check
    if (/(https?:\/\/[^\s]+)/g.test(state.message)) {
      return interaction.reply({
        content: interaction.t("interactions.lettres.no_links"),
        flags: [MessageFlags.Ephemeral],
      });
    }

    // Anti-Badword check
    const guildSettings = client.db.getGuild(interaction.guild.id);
    const antiraidConfig = client.db.getAntiraidConfig(interaction.guild.id);
    if ((antiraidConfig.antiBadWords ?? guildSettings.antiBadWords) > 0) {
      const words = client.db.db
        .prepare("SELECT word FROM badwords WHERE guildId = ?")
        .all(interaction.guild.id);
      if (words && words.length > 0) {
        const found = findBadword(state.message, words);

        if (found) {
          return interaction.reply({
            content: interaction.t("interactions.lettres.badword", {
              word: found.word,
            }),
            flags: [MessageFlags.Ephemeral],
          });
        }
      }
    }

    const channel = interaction.guild.channels.cache.get(state.targetChannel);
    if (!channel) {
      return interaction.reply({
        content: interaction.t("interactions.lettres.channel_not_found"),
        flags: [MessageFlags.Ephemeral],
      });
    }

    // Generate unique ID
    const letterId = generateId();

    // Store in DB for persistence
    try {
      client.db.insertLettre(letterId, state.message);
    } catch (err) {
      client.logger.error(
        `[LETTRES] Error saving letter ${letterId}: ${err.message}`,
      );
    }

    const letterEmbed = new EmbedBuilder()
      .setColor(client.embedBuilder.getTheme(client))
      .setDescription(
        interaction.t("interactions.lettres.received_title") + "\n" +
          interaction.t("interactions.lettres.received_hint") + "\n\n" +
          `\`${letterId}\` • <t:${Math.floor(Date.now() / 1000)}:t>`,
      )
      .setThumbnail("https://cdn-icons-gif.flaticon.com/16904/16904076.gif");

    const actionRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`lettres_open_${letterId}`)
        .setLabel(interaction.t("interactions.lettres.btn_open"))
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId(`lettres_delete_${letterId}`)
        .setStyle(ButtonStyle.Danger),
    );

    await channel.send({
      content: `<@${state.targetUser}> <#${state.sourceChannel}>`,
      embeds: [letterEmbed],
      components: [actionRow],
    });

    // Set cooldown
    if (!client.lettresCooldown) client.lettresCooldown = new Map();
    client.lettresCooldown.set(interaction.user.id, Date.now());

    // Clean state
    client.lettresState.delete(interaction.user.id);

    return interaction.update({
      embeds: [
        new EmbedBuilder()
          .setColor("#57F287")
          .setDescription(interaction.t("interactions.lettres.sent")),
      ],
      components: [],
    });
  }

  // Open a received letter
  if (
    interaction.isButton() &&
    interaction.customId.startsWith("lettres_open_")
  ) {
    const letterId = interaction.customId.replace("lettres_open_", "");

    const mentioned = interaction.message.content.match(/<@(\d+)>/);
    const targetId = mentioned ? mentioned[1] : null;

    if (interaction.user.id !== targetId) {
      return interaction.reply({
        content: interaction.t("interactions.lettres.only_recipient_open"),
        flags: [MessageFlags.Ephemeral],
      });
    }

    let content = interaction.t("interactions.lettres.content_not_found");
    try {
      const row = client.db.getLettre(letterId);
      if (row) content = row.content;
    } catch (err) {
      client.logger.error(
        `[LETTRES] Error creating/inserting letter ${letterId}: ${err.message}`,
      );
    }

    const newEmbed = EmbedBuilder.from(
      interaction.message.embeds[0],
    ).setDescription(
      interaction.t("interactions.lettres.received_title") + "\n" +
        `> ${content}\n\n` +
        `\`${letterId}\` • ${interaction.t("interactions.lettres.opened_tag")}`,
    );

    const newRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`lettres_delete_${letterId}`)
        .setStyle(ButtonStyle.Danger),
    );

    await interaction.update({ embeds: [newEmbed], components: [newRow] });
    return true;
  }

  // Delete a received letter
  if (
    interaction.isButton() &&
    interaction.customId.startsWith("lettres_delete_")
  ) {
    const mentioned = interaction.message.content.match(/<@(\d+)>/);
    const targetId = mentioned ? mentioned[1] : null;

    if (
      interaction.user.id !== targetId &&
      !interaction.member.permissions.has(
        PermissionsBitField.Flags.ManageMessages,
      )
    ) {
      return interaction.reply({
        content: interaction.t("interactions.lettres.only_recipient_delete"),
        flags: [MessageFlags.Ephemeral],
      });
    }

    await interaction.message.delete().catch(() => {});
    return true;
  }

  return false;
};

// Handler pour les drops aléatoires
const handleDropInteractions = async (interaction, client) => {
  if (
    interaction.isButton() &&
    interaction.customId.startsWith("drop_claim_")
  ) {
    const amount = parseInt(interaction.customId.replace("drop_claim_", ""));
    if (isNaN(amount)) return false;

    // Disable building
    const newEmbed = EmbedBuilder.from(interaction.message.embeds[0])
      .setColor("#57F287")
      .setTitle(interaction.t("interactions.drop.opened_title"))
      .setDescription(
        interaction.t("interactions.drop.claimed_desc", {
          user: interaction.user.username,
          amount,
          coin: client.config.emojis.coin,
        }),
      );

    const disabledRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("drop_claimed_already")
        .setLabel(
          interaction.t("interactions.drop.claimed_by", {
            user: interaction.user.username,
          }),
        )
        .setStyle(ButtonStyle.Success)
        .setDisabled(true),
    );

    // Add coins to user
    client.db.addCoins(interaction.user.id, interaction.guild.id, amount);

    await interaction
      .update({ embeds: [newEmbed], components: [disabledRow] })
      .catch(() => {});
    return true;
  }

  return false;
};

// Handler pour les interactions de la boutique
const handleShopInteractions = async (interaction, client) => {
  if (
    interaction.isStringSelectMenu() &&
    interaction.customId === "shop_buy_select"
  ) {
    const selectedValue = interaction.values[0];

    // Vérifier si c'est un article de boutique (format: shop_item_123)
    if (selectedValue && selectedValue.startsWith("shop_item_")) {
      const itemId = selectedValue.replace("shop_item_", "");
      let item;

      try {
        // Récupérer tous les articles de la boutique
        const shopItems = client.db.getEconomyShop(interaction.guild.id);
        item = shopItems.find((i) => i.id == itemId);

        if (!item) {
          await interaction.reply({
            content: interaction.t("interactions.shop.item_gone"),
            flags: [MessageFlags.Ephemeral],
          });
          return true;
        }

        // Vérifier si l'utilisateur a assez d'argent et déduire atomiquement
        const success = client.db.tryRemoveCoins(
          interaction.user.id,
          interaction.guild.id,
          item.price,
        );

        if (!success) {
          const userEconomy = client.db.getUser(
            interaction.user.id,
            interaction.guild.id,
          );
          const userCoins = userEconomy?.coins || 0;
          await interaction.reply({
            content: interaction.t("interactions.shop.not_enough", {
              price: item.price,
              coins: userCoins,
            }),
            flags: [MessageFlags.Ephemeral],
          });
          return true;
        }

        // L'argent est déduit à ce stade.

        // Si c'est un rôle, donner le rôle à l'utilisateur
        if (item.itemType === "role" && item.roleId) {
          try {
            const member = await interaction.guild.members.fetch(
              interaction.user.id,
            );
            const role = interaction.guild.roles.cache.get(item.roleId);

            if (role) {
              await member.roles.add(role);

              await interaction.reply({
                content: interaction.t("interactions.shop.bought_role", {
                  name: item.name,
                  price: item.price,
                  role: `<@&${item.roleId}>`,
                }),
                flags: [MessageFlags.Ephemeral],
              });
            } else {
              // Rôle introuvable : on rembourse
              client.db.addCoins(
                interaction.user.id,
                interaction.guild.id,
                item.price,
              );
              await interaction.reply({
                content: interaction.t("interactions.shop.role_gone_refund"),
                flags: [MessageFlags.Ephemeral],
              });
            }
          } catch (error) {
            // Erreur d'ajout de rôle : on rembourse
            client.db.addCoins(
              interaction.user.id,
              interaction.guild.id,
              item.price,
            );
            client.logger.error(
              `[SHOP] Failed to assign role ${item.roleId} to ${interaction.user.id}: ${error.message}`,
            );
            await interaction.reply({
              content: interaction.t("interactions.shop.role_fail_refund"),
              flags: [MessageFlags.Ephemeral],
            });
          }
        } else {
          // Autres types d'articles (à implémenter si nécessaire)
          await interaction.reply({
            content: interaction.t("interactions.shop.bought", {
              name: item.name,
              price: item.price,
            }),
            flags: [MessageFlags.Ephemeral],
          });
        }

        return true;
      } catch (error) {
        Logger.error(
          `[SHOP] purchase failed guild=${interaction.guild?.id} user=${interaction.user?.id} item=${item?.id || item?.name || "?"}:`,
          error,
        );
        await interaction.reply({
          content: interaction.t("interactions.shop.purchase_error"),
          flags: [MessageFlags.Ephemeral],
        });
        return true;
      }
    }
  }

  return false;
};

module.exports = {
  name: "interactionCreate",
  async execute(interaction, client) {
    const { executeSafe } = require("../utils/errorHandler");

    // Langue du serveur — bind un traducteur sur l'interaction pour que tous
    // les handlers puissent faire interaction.t(key). Cache partagé client.
    let lang = "fr";
    if (interaction.guild) {
      let guildSettings = client.guildSettingsCache.get(interaction.guild.id);
      if (!guildSettings) {
        guildSettings = client.db.getGuild(interaction.guild.id);
        client.guildSettingsCache.set(interaction.guild.id, guildSettings);
      }
      lang = guildSettings.language || "fr";
    }
    interaction.lang = lang;
    interaction.t = (key, vars) => t(lang, key, vars);

    await executeSafe(
      client,
      interaction,
      interaction.customId || "interaction",
      async () => {
        // Ticket Option GUI
        if (interaction.customId?.startsWith("ticketopt_")) {
          const handled = await handleTicketOptionInteraction(
            interaction,
            client,
          );
          if (handled !== false) return;
        }

        // Config Menu
        if (await handleConfigMenuInteractions(interaction, client)) return;

        // Button Roles
        if (await handleButtonRoleInteractions(interaction, client)) return;

        // Lettres anonymes
        if (await handleLetterInteractions(interaction, client)) return;

        // Drops aléatoires
        if (await handleDropInteractions(interaction, client)) return;

        // Casino
        if (await handleCasinoInteractions(interaction, client)) return;

        // Giveaway
        if (await handleGiveawayInteractions(interaction, client)) return;

        // Embed Builder
        if (await handleEmbedBuilderInteractions(interaction, client)) return;

        // Captcha
        if (await handleCaptchaInteractions(interaction, client)) return;

        // Tickets
        if (await handleTicketInteractions(interaction, client)) return;

        // Boutique
        if (await handleShopInteractions(interaction, client)) return;

        // Ticket GUI Panel (Administration)
        if (await handleTicketGUIPanelInteractions(interaction, client)) return;

        // TempVC
        await handleTempVCInteractions(interaction, client);
      },
    );
  },
};
