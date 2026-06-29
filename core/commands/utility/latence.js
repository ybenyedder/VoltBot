module.exports = {
  name: "latence",
  description: "Affiche la latence du bot",
  category: "utility",
  usage: "latence",
  async execute(client, message, args) {
    const startTime = Date.now();
    const msg = await message
      .reply({ embeds: [client.embedBuilder.info(client, message.t("commands.latence.measuring"))] })
      .catch(() => null);
    if (!msg) return;
    const apiLatency = Date.now() - startTime;
    const ws = Math.round(client.ws.ping);

    const embed = client.embedBuilder
      .base(client, message.t("commands.latence.title"))
      .addFields(
        { name: "API", value: `\`${apiLatency} ms\``, inline: true },
        { name: "WebSocket", value: `\`${ws} ms\``, inline: true },
      );

    await msg.edit({ content: null, embeds: [embed] }).catch(() => {});
  },
};
