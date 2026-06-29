module.exports = {
  name: "firstmsg",
  aliases: ["firstmessage"],
  description: "Lien vers le premier message du salon.",
  category: "utility",
  usage: "+firstmsg",
  async execute(client, message, args) {
    const channel = message.mentions.channels.first() || message.channel;

    try {
      const messages = await channel.messages.fetch({ after: "0", limit: 1 });
      const first = messages.first();

      if (!first)
        return message
          .reply({
            embeds: [
              client.embedBuilder.error(client, message.t("commands.firstmsg.no_message")),
            ],
          })
          .catch(() => {});

      const createdTs = Math.floor(first.createdTimestamp / 1000);

      const embed = client.embedBuilder
        .base(client, first.author.tag)
        .setAuthor({
          name: first.author.tag,
          iconURL: first.author.displayAvatarURL({ size: 64 }),
        })
        .addFields(
          {
            name: message.t("commands.firstmsg.field_channel"),
            value: `<#${channel.id}>`,
            inline: true,
          },
          { name: message.t("commands.firstmsg.field_author"), value: `<@${first.author.id}>`, inline: true },
          { name: message.t("commands.firstmsg.field_date"), value: `<t:${createdTs}:f>`, inline: true },
          {
            name: message.t("commands.firstmsg.field_link"),
            value: `[${message.t("commands.firstmsg.open")}](${first.url})`,
            inline: false,
          },
        );

      await message.reply({ embeds: [embed] }).catch(() => {});
    } catch {
      await message
        .reply({
          embeds: [
            client.embedBuilder.error(
              client,
              message.t("commands.firstmsg.fetch_failed"),
            ),
          ],
        })
        .catch(() => {});
    }
  },
};
