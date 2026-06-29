function buildEmbed(client, sticker, message) {
  const createdTs = sticker.createdAt
    ? Math.floor(sticker.createdTimestamp / 1000)
    : null;

  return client.embedBuilder
    .base(client, sticker.name)
    .setAuthor({ name: sticker.name, iconURL: sticker.url })
    .setThumbnail(sticker.url)
    .addFields(
      { name: message.t("commands.getsticker.field_id"), value: `\`${sticker.id}\``, inline: true },
      { name: message.t("commands.getsticker.field_pack"), value: sticker.pack?.name || message.t("commands.getsticker.none_m"), inline: true },
      {
        name: message.t("commands.getsticker.field_author"),
        value: sticker.user ? `<@${sticker.user.id}>` : message.t("commands.getsticker.unknown"),
        inline: true,
      },
      {
        name: message.t("commands.getsticker.field_created"),
        value: createdTs ? `<t:${createdTs}:R>` : message.t("commands.getsticker.unknown"),
        inline: true,
      },
      {
        name: message.t("commands.getsticker.field_description"),
        value: sticker.description || message.t("commands.getsticker.none_f"),
        inline: false,
      },
    );
}

module.exports = {
  name: "getsticker",
  description: "Affiche des informations sur un sticker",
  category: "utility",
  usage: "getsticker",
  async execute(client, message, args) {
    if (!args[0]) {
      return message
        .reply({
          embeds: [
            client.embedBuilder.warning(
              client,
              message.t("commands.getsticker.provide_id"),
            ),
          ],
        })
        .catch(() => {});
    }

    try {
      if (args[0].match(/^\d+$/) && !message.mentions.channels.first()) {
        try {
          const sticker = await client.fetchSticker(args[0]);
          return message
            .reply({ embeds: [buildEmbed(client, sticker, message)] })
            .catch(() => {});
        } catch {
          // Continue vers la recherche dans un message
        }
      }

      const messageId = args[0];
      const channel = message.mentions.channels.first() || message.channel;

      try {
        const msg = await channel.messages.fetch(messageId);
        if (msg.stickers.size > 0) {
          const sticker = msg.stickers.first();
          return message
            .reply({ embeds: [buildEmbed(client, sticker, message)] })
            .catch(() => {});
        }
        return message
          .reply({
            embeds: [
              client.embedBuilder.warning(
                client,
                message.t("commands.getsticker.no_sticker"),
              ),
            ],
          })
          .catch(() => {});
      } catch {
        return message
          .reply({
            embeds: [
              client.embedBuilder.error(
                client,
                message.t("commands.getsticker.message_not_found"),
              ),
            ],
          })
          .catch(() => {});
      }
    } catch {
      return message
        .reply({
          embeds: [client.embedBuilder.error(client, message.t("commands.getsticker.sticker_not_found"))],
        })
        .catch(() => {});
    }
  },
};
