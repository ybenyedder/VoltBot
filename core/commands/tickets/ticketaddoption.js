const {
  PermissionsBitField,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  RoleSelectMenuBuilder,
} = require("discord.js");
const permissions = require("../../utils/permissions");
const { t } = require("../../utils/i18n");

module.exports = {
  name: "ticketaddoption",
  description:
    "Ajoute une option au menu deroulant des tickets via une interface interactive.",
  category: "tickets",
  usage: "+ticketaddoption",
  userPerms: [PermissionsBitField.Flags.Administrator],
  async execute(client, message, args) {
    try {
      client.db.db
        .prepare(
          "CREATE TABLE IF NOT EXISTS ticket_options (id INTEGER PRIMARY KEY AUTOINCREMENT, guildId TEXT, title TEXT, emoji TEXT, roleId TEXT, description TEXT)",
        )
        .run();
    } catch (e) {}

    if (!client.ticketOptionState) client.ticketOptionState = new Map();
    client.ticketOptionState.set(message.author.id, {
      guildId: message.guild.id,
      title: null,
      emoji: null,
      roleId: null,
      description: null,
      _createdAt: Date.now(),
      _moderatorId: message.author.id,
    });

    const embed = buildTicketOptionEmbed(
      client.ticketOptionState.get(message.author.id),
      client,
      message.lang,
    );
    const components = buildTicketOptionComponents(message.lang);

    await message
      .reply({ embeds: [embed], components: components })
      .catch(() => {});
  },
};

function buildTicketOptionEmbed(state, client, lang = "fr") {
  const undefinedLabel = t(lang, "commands.ticketaddoption.undefined");
  const title = state.title || undefinedLabel;
  const emoji = state.emoji || undefinedLabel;
  const role = state.roleId ? `<@&${state.roleId}>` : undefinedLabel;
  const description =
    state.description || t(lang, "commands.ticketaddoption.default_description");
  const moderator = state._moderatorId
    ? `<@${state._moderatorId}>`
    : undefinedLabel;

  return new EmbedBuilder()
    .setColor(client.embedBuilder.getTheme(client))
    .setAuthor({
      name: t(lang, "commands.ticketaddoption.author_new_option"),
      iconURL: client?.user?.displayAvatarURL?.({ size: 64 }),
    })
    .setDescription(t(lang, "commands.ticketaddoption.fill_each_field"))
    .addFields(
      {
        name: t(lang, "commands.ticketaddoption.field_option"),
        value: title,
        inline: true,
      },
      {
        name: t(lang, "commands.ticketaddoption.field_action"),
        value: t(lang, "commands.ticketaddoption.action_creation"),
        inline: true,
      },
      {
        name: t(lang, "commands.ticketaddoption.field_moderator"),
        value: moderator,
        inline: true,
      },
      {
        name: t(lang, "commands.ticketaddoption.field_emoji"),
        value: emoji,
        inline: true,
      },
      {
        name: t(lang, "commands.ticketaddoption.field_role"),
        value: role,
        inline: true,
      },
      {
        name: t(lang, "commands.ticketaddoption.field_description"),
        value: description,
        inline: true,
      },
    );
}

function buildTicketOptionComponents(lang = "fr") {
  const row1 = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("ticketopt_title")
      .setLabel(t(lang, "commands.ticketaddoption.btn_title"))
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId("ticketopt_emoji")
      .setLabel(t(lang, "commands.ticketaddoption.btn_emoji"))
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId("ticketopt_description")
      .setLabel(t(lang, "commands.ticketaddoption.btn_description"))
      .setStyle(ButtonStyle.Secondary),
  );

  const row2 = new ActionRowBuilder().addComponents(
    new RoleSelectMenuBuilder()
      .setCustomId("ticketopt_role")
      .setPlaceholder(t(lang, "commands.ticketaddoption.placeholder_role"))
      .setMinValues(1)
      .setMaxValues(1),
  );

  const row3 = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("ticketopt_save")
      .setLabel(t(lang, "commands.ticketaddoption.btn_save"))
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId("ticketopt_cancel")
      .setLabel(t(lang, "commands.ticketaddoption.btn_cancel"))
      .setStyle(ButtonStyle.Danger),
  );

  return [row1, row2, row3];
}

// Export pour interactionCreate
module.exports.buildTicketOptionEmbed = buildTicketOptionEmbed;
module.exports.buildTicketOptionComponents = buildTicketOptionComponents;
