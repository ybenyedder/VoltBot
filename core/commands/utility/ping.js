module.exports = {
  name: "ping",
  aliases: ["latency", "pong"],
  description: "Affiche la latence du bot.",
  category: "utility",
  usage: "ping",
  async execute(client, message, args) {
    const msg = await message
      .reply({ embeds: [client.embedBuilder.info(client, message.t("commands.ping.measuring"))] })
      .catch(() => null);
    if (!msg) return;

    const api = msg.createdTimestamp - message.createdTimestamp;
    const ws = Math.round(client.ws.ping);

    const embed = client.embedBuilder
      .base(client, "Pong")
      .addFields(
        { name: "API", value: `\`${api} ms\``, inline: true },
        { name: "WebSocket", value: `\`${ws} ms\``, inline: true },
      );

    await msg.edit({ content: null, embeds: [embed] }).catch(() => {});
  },
};
