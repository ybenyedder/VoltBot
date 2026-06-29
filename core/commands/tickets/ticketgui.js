const {
  PermissionsBitField,
  ActionRowBuilder,
  StringSelectMenuBuilder,
} = require("discord.js");
const { t } = require("../../utils/i18n");

const truncate = (s, max) => {
  if (!s) return null;
  const str = String(s).trim();
  return str.length > max ? `${str.slice(0, max - 1)}…` : str;
};

const parseEmoji = (emojiString) => {
  if (!emojiString) return null;
  const customEmojiMatch = String(emojiString).match(
    /^(?:<a?:)?(\w+):(\d+)>?$/,
  );
  if (customEmojiMatch) {
    return {
      name: customEmojiMatch[1],
      id: customEmojiMatch[2],
      animated: emojiString.includes("<a:"),
    };
  }
  if (/[a-zA-Z0-9]/.test(emojiString)) return null;
  return emojiString;
};

module.exports = {
  name: "ticketgui",
  aliases: ["ticketpanel"],
  description: "Affiche le panneau de sélection de catégorie de tickets.",
  category: "tickets",
  usage: "+ticketgui",
  userPerms: [PermissionsBitField.Flags.Administrator],
  async execute(client, message, args) {
    const lang = client.db.getGuild(message.guild.id, "language") || "fr";
    const options = client.db.db
      .prepare("SELECT * FROM ticket_options WHERE guildId = ?")
      .all(message.guild.id);

    const guildIcon = message.guild.iconURL({ size: 256 });

    const embed = client.embedBuilder
      .premium(
        client,
        t(lang, "tickets.panel_title"),
        t(lang, "tickets.panel_description"),
        guildIcon,
      );

    const selectOptions =
      options.length > 0
        ? options.map((opt) => {
            const emoji = parseEmoji(opt.emoji);
            const o = {
              label: truncate(opt.title, 100),
              description:
                truncate(opt.description, 100) ||
                t(lang, "tickets.default_option_description"),
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

    const row = new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId("ticket_select")
        .setPlaceholder(t(lang, "tickets.panel_placeholder"))
        .addOptions(selectOptions),
    );

    if (message.guild && message.deletable)
      await message.delete().catch(() => {});
    await message.channel
      .send({ embeds: [embed], components: [row] })
      .catch(() => {});
  },
};
