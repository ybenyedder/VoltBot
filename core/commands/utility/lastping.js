module.exports = {
  name: "lastping",
  description: "Affiche le dernier ping du bot",
  category: "utility",
  usage: "lastping",
  async execute(client, message, args) {
    const startTime = Date.now();
    const msg = await message
      .reply({ embeds: [client.embedBuilder.info(client, message.t("commands.lastping.measuring"))] })
      .catch(() => null);
    if (!msg) return;
    const apiLatency = Date.now() - startTime;
    const ws = Math.round(client.ws.ping);

    const embed = client.embedBuilder
      .base(client, message.t("commands.lastping.title"))
      .addFields(
        { name: "API", value: `\`${apiLatency} ms\``, inline: true },
        { name: "WebSocket", value: `\`${ws} ms\``, inline: true },
      );

    await msg.edit({ content: null, embeds: [embed] }).catch(() => {});
  },
};
