module.exports = {
  name: "suggestbasic",
  aliases: ["simplesuggest"],
  description: "Fait une suggestion simple au serveur (sans vote).",
  category: "utility",
  usage: "+suggestbasic <texte>",
  async execute(client, message, args) {
    if (!args[0]) {
      return message
        .reply({
          embeds: [
            client.embedBuilder.warning(
              client,
              message.t("commands.suggest.suggestion_required"),
            ),
          ],
        })
        .catch(() => {});
    }

    const suggestion = args.join(" ");
    const guildSettings = client.db.getGuild(message.guild.id);
    const suggestChannel = guildSettings.suggestChannel;

    if (!suggestChannel) {
      return message
        .reply({
          embeds: [
            client.embedBuilder.error(
              client,
              message.t("commands.suggest.channel_not_configured"),
            ),
          ],
        })
        .catch(() => {});
    }

    const channel = message.guild.channels.cache.get(suggestChannel);
    if (!channel) {
      return message
        .reply({
          embeds: [client.embedBuilder.error(client, message.t("commands.suggest.channel_not_found"))],
        })
        .catch(() => {});
    }

    const embed = client.embedBuilder
      .premium(
        client,
        message.t("commands.suggest.embed_title"),
        suggestion,
        message.author.displayAvatarURL({ size: 256 }),
      )
      .addFields(
        { name: message.t("commands.suggest.field_author"), value: `<@${message.author.id}>`, inline: true },
        {
          name: message.t("commands.suggest.field_date"),
          value: `<t:${Math.floor(Date.now() / 1000)}:f>`,
          inline: true,
        },
      );

    const suggestMessage = await channel
      .send({ embeds: [embed] })
      .catch(() => null);
    if (!suggestMessage) {
      return message
        .reply({
          embeds: [
            client.embedBuilder.error(
              client,
              message.t("commands.suggest.send_failed"),
            ),
          ],
        })
        .catch(() => {});
    }

    if (message.guild && message.deletable)
      await message.delete().catch(() => {});

    await message.channel
      .send({
        embeds: [
          client.embedBuilder.success(
            client,
            message.t("commands.suggest.sent", { channel: `<#${channel.id}>` }),
          ),
        ],
      })
      .then((m) => setTimeout(() => m.delete().catch(() => {}), 5000))
      .catch(() => {});
  },
};
