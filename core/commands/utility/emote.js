const nf = new Intl.NumberFormat("fr-FR");

module.exports = {
  name: "emote",
  description: "Affiche des informations sur un emoji",
  category: "utility",
  usage: "emote",
  async execute(client, message, args) {
    if (!args[0]) {
      const emojis = message.guild.emojis.cache;
      const sample = emojis
        .first(25)
        .map((e) => `${e} \`${e.name}\``)
        .join(" ");
      const embed = client.embedBuilder
        .base(client, message.guild.name)
        .setAuthor({
          name: message.guild.name,
          iconURL: message.guild.iconURL() || undefined,
        })
        .addFields(
          { name: message.t("commands.emote.field_total"), value: `${nf.format(emojis.size)}`, inline: true },
          {
            name: message.t("commands.emote.field_displayed"),
            value: `${nf.format(Math.min(25, emojis.size))}`,
            inline: true,
          },
          { name: message.t("commands.emote.field_preview"), value: sample || message.t("commands.emote.none"), inline: false },
        );

      return message.reply({ embeds: [embed] }).catch(() => {});
    }

    const emojiMatch = args[0].match(/<a?:([^:]+):(\d+)>/);
    if (!emojiMatch) {
      return message
        .reply({
          embeds: [client.embedBuilder.warning(client, message.t("commands.emote.invalid_emoji"))],
        })
        .catch(() => {});
    }

    const emojiId = emojiMatch[2];
    const emoji = message.guild.emojis.cache.get(emojiId);

    if (!emoji) {
      return message
        .reply({
          embeds: [
            client.embedBuilder.warning(client, message.t("commands.emote.emoji_not_in_server")),
          ],
        })
        .catch(() => {});
    }

    const createdTs = emoji.createdAt
      ? Math.floor(emoji.createdTimestamp / 1000)
      : null;

    const embed = client.embedBuilder
      .base(client, emoji.name)
      .setAuthor({ name: emoji.name, iconURL: emoji.url })
      .setThumbnail(emoji.url)
      .addFields(
        { name: "ID", value: `\`${emoji.id}\``, inline: true },
        { name: message.t("commands.emote.field_animated"), value: emoji.animated ? message.t("commands.emote.yes") : message.t("commands.emote.no"), inline: true },
        {
          name: message.t("commands.emote.field_author"),
          value: emoji.user ? `<@${emoji.user.id}>` : message.t("commands.emote.unknown"),
          inline: true,
        },
        {
          name: message.t("commands.emote.field_created"),
          value: createdTs ? `<t:${createdTs}:R>` : message.t("commands.emote.unknown"),
          inline: true,
        },
      );

    await message.reply({ embeds: [embed] }).catch(() => {});
  },
};
