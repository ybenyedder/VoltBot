const {
  PermissionsBitField,
  ChannelType,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require("discord.js");
const permissions = require("../../utils/permissions");

const MAX_BUTTONS_PER_ROW = 5;
const MAX_ROWS_PER_MESSAGE = 5;
const MAX_BUTTONS_PER_MESSAGE = MAX_BUTTONS_PER_ROW * MAX_ROWS_PER_MESSAGE;
const LIST_PAGE_SIZE = 10;

const STYLE_MAP = {
  primary: ButtonStyle.Primary,
  blue: ButtonStyle.Primary,
  bleu: ButtonStyle.Primary,
  secondary: ButtonStyle.Secondary,
  gray: ButtonStyle.Secondary,
  grey: ButtonStyle.Secondary,
  gris: ButtonStyle.Secondary,
  success: ButtonStyle.Success,
  green: ButtonStyle.Success,
  vert: ButtonStyle.Success,
  danger: ButtonStyle.Danger,
  red: ButtonStyle.Danger,
  rouge: ButtonStyle.Danger,
};

const STYLE_NAME = {
  [ButtonStyle.Primary]: "Primary",
  [ButtonStyle.Secondary]: "Secondary",
  [ButtonStyle.Success]: "Success",
  [ButtonStyle.Danger]: "Danger",
};

const parseStyle = (input) => {
  if (!input) return ButtonStyle.Secondary;
  const v = String(input).toLowerCase();
  return STYLE_MAP[v] ?? ButtonStyle.Secondary;
};

const styleFromStored = (stored) => {
  if (!stored) return ButtonStyle.Secondary;
  const v = String(stored).toLowerCase();
  return STYLE_MAP[v] ?? ButtonStyle.Secondary;
};

const generateCustomId = () =>
  `br:${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

const rebuildComponents = (rows) => {
  // rows: array of DB rows for one message, in insertion order
  const components = [];
  for (let i = 0; i < rows.length; i += MAX_BUTTONS_PER_ROW) {
    const slice = rows.slice(i, i + MAX_BUTTONS_PER_ROW);
    const ar = new ActionRowBuilder().addComponents(
      slice.map((r) =>
        new ButtonBuilder()
          .setCustomId(r.customId)
          .setLabel(r.label.slice(0, 80))
          .setStyle(styleFromStored(r.style)),
      ),
    );
    components.push(ar);
  }
  return components;
};

const sendError = (client, message, text) =>
  message
    .reply({ embeds: [client.embedBuilder.error(client, text)] })
    .catch(() => {});

const handleAdd = async (client, message, args) => {
  // Usage: +buttonrole add <#channel> <messageId|new> <label> @role [style]
  const channel =
    message.mentions.channels.first() ||
    message.guild.channels.cache.get(args[1]);
  if (
    !channel ||
    ![ChannelType.GuildText, ChannelType.GuildAnnouncement].includes(
      channel.type,
    )
  ) {
    return sendError(client, message, message.t("commands.buttonrole.invalid_text_channel"));
  }

  const messageIdArg = args[2];
  if (!messageIdArg) {
    return sendError(
      client,
      message,
      message.t("commands.buttonrole.message_id_required"),
    );
  }

  // role mention is one of the args; label is everything between messageId and role mention
  const role = message.mentions.roles.first();
  if (!role) {
    return sendError(client, message, message.t("commands.buttonrole.mention_role"));
  }

  // Find the index of the role mention in args
  const roleArgIndex = args.findIndex((a) => /^<@&?\d+>$/.test(a));
  if (roleArgIndex === -1 || roleArgIndex <= 2) {
    return sendError(
      client,
      message,
      message.t("commands.buttonrole.format_add"),
    );
  }

  const label = args.slice(3, roleArgIndex).join(" ").trim();
  if (!label) return sendError(client, message, message.t("commands.buttonrole.label_required"));
  if (label.length > 80) {
    return sendError(client, message, message.t("commands.buttonrole.label_too_long"));
  }

  const styleArg = args[roleArgIndex + 1];
  const style = parseStyle(styleArg);

  if (message.guild.members.me.roles.highest.position <= role.position) {
    return sendError(
      client,
      message,
      message.t("commands.buttonrole.role_higher_than_bot"),
    );
  }

  // Resolve target message: existing or new panel
  let targetMessage = null;
  if (messageIdArg.toLowerCase() === "new") {
    const panel = client.embedBuilder.premium(
      client,
      message.t("commands.buttonrole.panel_title"),
      message.t("commands.buttonrole.panel_description"),
    );
    targetMessage = await channel
      .send({ embeds: [panel], components: [] })
      .catch(() => null);
    if (!targetMessage) {
      return sendError(client, message, message.t("commands.buttonrole.panel_send_failed"));
    }
  } else {
    targetMessage = await channel.messages
      .fetch(messageIdArg)
      .catch(() => null);
    if (!targetMessage) {
      return sendError(client, message, message.t("commands.buttonrole.message_not_found"));
    }
    if (targetMessage.author.id !== client.user.id) {
      return sendError(
        client,
        message,
        message.t("commands.buttonrole.message_not_from_bot"),
      );
    }
  }

  // Capacity check
  const existing = client.db.getButtonRolesForMessage(targetMessage.id);
  if (existing.length >= MAX_BUTTONS_PER_MESSAGE) {
    return sendError(
      client,
      message,
      message.t("commands.buttonrole.limit_reached", { max: MAX_BUTTONS_PER_MESSAGE }),
    );
  }
  if (existing.some((r) => r.roleId === role.id)) {
    return sendError(
      client,
      message,
      message.t("commands.buttonrole.role_already_has_button"),
    );
  }

  const customId = generateCustomId();
  const styleName = STYLE_NAME[style] || "Secondary";

  try {
    client.db.addButtonRole(
      message.guild.id,
      targetMessage.id,
      channel.id,
      customId,
      label,
      styleName,
      role.id,
      message.author.id,
    );
  } catch (err) {
    return sendError(client, message, message.t("commands.buttonrole.save_failed"));
  }

  const all = client.db.getButtonRolesForMessage(targetMessage.id);
  const components = rebuildComponents(all);

  try {
    await targetMessage.edit({ components });
  } catch (err) {
    client.db.removeButtonRole(targetMessage.id, customId);
    return sendError(client, message, message.t("commands.buttonrole.edit_message_failed"));
  }

  const confirm = client.embedBuilder
    .success(client, message.t("commands.buttonrole.button_added"))
    .addFields(
      { name: message.t("commands.buttonrole.field_channel"), value: `${channel}`, inline: true },
      { name: message.t("commands.buttonrole.field_role"), value: `${role}`, inline: true },
      { name: message.t("commands.buttonrole.field_style"), value: `\`${styleName}\``, inline: true },
      { name: message.t("commands.buttonrole.field_message"), value: `\`${targetMessage.id}\``, inline: true },
      { name: message.t("commands.buttonrole.field_customid"), value: `\`${customId}\``, inline: true },
    );
  await message.reply({ embeds: [confirm] }).catch(() => {});
};

const handleDel = async (client, message, args) => {
  // Usage: +buttonrole del <messageId> <customId>
  const messageId = args[1];
  const customId = args[2];
  if (!messageId || !customId) {
    return sendError(
      client,
      message,
      message.t("commands.buttonrole.format_del"),
    );
  }

  const row = client.db.getButtonRoleByCustomId(customId);
  if (!row || row.messageId !== messageId) {
    return sendError(client, message, message.t("commands.buttonrole.button_not_found"));
  }
  if (row.guildId !== message.guild.id) {
    return sendError(client, message, message.t("commands.buttonrole.button_other_server"));
  }

  try {
    client.db.removeButtonRole(messageId, customId);
  } catch (err) {
    return sendError(client, message, message.t("commands.buttonrole.delete_failed"));
  }

  // Update target message
  const channel = message.guild.channels.cache.get(row.channelId);
  if (channel) {
    const target = await channel.messages.fetch(messageId).catch(() => null);
    if (target && target.author.id === client.user.id) {
      const all = client.db.getButtonRolesForMessage(messageId);
      const components = rebuildComponents(all);
      await target.edit({ components }).catch(() => {});
    }
  }

  const confirm = client.embedBuilder
    .success(client, message.t("commands.buttonrole.button_deleted"))
    .addFields(
      { name: message.t("commands.buttonrole.field_message"), value: `\`${messageId}\``, inline: true },
      { name: message.t("commands.buttonrole.field_customid"), value: `\`${customId}\``, inline: true },
    );
  await message.reply({ embeds: [confirm] }).catch(() => {});
};

const buildListEmbed = (client, rows, page, message) => {
  const totalPages = Math.max(1, Math.ceil(rows.length / LIST_PAGE_SIZE));
  const safePage = Math.min(Math.max(page, 1), totalPages);
  const start = (safePage - 1) * LIST_PAGE_SIZE;
  const slice = rows.slice(start, start + LIST_PAGE_SIZE);

  let description;
  if (slice.length === 0) {
    description = message.t("commands.buttonrole.no_button_registered");
  } else {
    description = slice
      .map((r) => {
        return (
          `\`${r.customId}\` · <@&${r.roleId}> · \`${r.style || "Secondary"}\`\n` +
          message.t("commands.buttonrole.list_entry", {
            label: r.label,
            channel: `<#${r.channelId}>`,
            msg: r.messageId,
          })
        );
      })
      .join("\n\n");
  }

  const embed = client.embedBuilder
    .base(
      client,
      message.t("commands.buttonrole.list_title", { page: safePage, total: totalPages }),
      description,
    );
  return { embed, totalPages, safePage };
};

const buildListRow = (page, totalPages, message) =>
  new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("buttonrole_list_prev")
      .setLabel(message.t("commands.buttonrole.btn_prev"))
      .setStyle(ButtonStyle.Primary)
      .setDisabled(page <= 1),
    new ButtonBuilder()
      .setCustomId("buttonrole_list_page")
      .setLabel(message.t("commands.buttonrole.btn_page", { page, total: totalPages }))
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(true),
    new ButtonBuilder()
      .setCustomId("buttonrole_list_next")
      .setLabel(message.t("commands.buttonrole.btn_next"))
      .setStyle(ButtonStyle.Primary)
      .setDisabled(page >= totalPages),
  );

const handleList = async (client, message) => {
  const rows = client.db.listButtonRoles(message.guild.id);

  if (rows.length === 0) {
    return message
      .reply({
        embeds: [
          client.embedBuilder.info(client, message.t("commands.buttonrole.no_button_configured")),
        ],
      })
      .catch(() => {});
  }

  let page = 1;
  let built = buildListEmbed(client, rows, page, message);
  page = built.safePage;

  const components =
    built.totalPages > 1 ? [buildListRow(page, built.totalPages, message)] : [];
  const reply = await message
    .reply({ embeds: [built.embed], components })
    .catch(() => null);
  if (!reply || built.totalPages <= 1) return;

  const filter = (i) =>
    i.user.id === message.author.id &&
    i.customId.startsWith("buttonrole_list_");
  const collector = reply.createMessageComponentCollector({
    filter,
    time: 120_000,
  });

  collector.on("collect", async (interaction) => {
    if (interaction.customId === "buttonrole_list_prev") {
      page = Math.max(1, page - 1);
    } else if (interaction.customId === "buttonrole_list_next") {
      page = Math.min(built.totalPages, page + 1);
    } else {
      return interaction.deferUpdate().catch(() => {});
    }

    built = buildListEmbed(client, rows, page, message);
    page = built.safePage;
    await interaction
      .update({
        embeds: [built.embed],
        components: [buildListRow(page, built.totalPages, message)],
      })
      .catch(() => {});
  });

  collector.on("end", async () => {
    await reply.edit({ components: [] }).catch(() => {});
  });
};

module.exports = {
  name: "buttonrole",
  aliases: ["brole", "btnrole"],
  description: "Gère les rôles assignables via boutons.",
  category: "roles",
  usage:
    "+buttonrole add <#salon> <messageId|new> <label> @role [style] | +buttonrole del <messageId> <customId> | +buttonrole list",
  userPerms: [
    PermissionsBitField.Flags.ManageRoles,
    PermissionsBitField.Flags.ManageMessages,
  ],
  botPerms: [PermissionsBitField.Flags.ManageRoles],
  async execute(client, message, args) {
    if (!permissions.isAdmin(message, client)) {
      return message
        .reply({
          embeds: [
            client.embedBuilder.error(client, message.t("commands.buttonrole.admin_only")),
          ],
        })
        .catch(() => {});
    }

    const sub = (args[0] || "").toLowerCase();

    if (sub === "add" || sub === "create") {
      return handleAdd(client, message, args);
    }
    if (sub === "del" || sub === "delete" || sub === "remove") {
      return handleDel(client, message, args);
    }
    if (sub === "list" || sub === "ls") {
      return handleList(client, message);
    }

    return message
      .reply({
        embeds: [
          client.embedBuilder.info(
            client,
            message.t("commands.buttonrole.usage_help"),
          ),
        ],
      })
      .catch(() => {});
  },
};
