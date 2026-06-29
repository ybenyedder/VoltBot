module.exports = {
  name: "qrcode",
  aliases: ["qr"],
  description: "Génère un QR Code avec le lien ou le texte fourni.",
  category: "utility",
  usage: "+qrcode [texte/lien]",
  async execute(client, message, args) {
    const text = args.join(" ");
    if (!text)
      return message
        .reply({
          embeds: [
            client.embedBuilder.warning(
              client,
              message.t("commands.qrcode.text_required"),
            ),
          ],
        })
        .catch(() => {});

    try {
      const apiUrl = `https://api.qrserver.com/v1/create-qr-code/?size=512x512&data=${encodeURIComponent(text)}`;
      const truncated = text.length > 50 ? text.slice(0, 47) + "..." : text;

      const embed = client.embedBuilder
        .premium(client, message.t("commands.qrcode.title"), "​")
        .setImage(apiUrl)
        .addFields({
          name: message.t("commands.qrcode.source_text"),
          value: `\`${truncated}\``,
          inline: false,
        })
        .setFooter({ text: "api.qrserver.com" });

      await message.reply({ embeds: [embed] }).catch(() => {});
    } catch (err) {
      await message
        .reply({
          embeds: [client.embedBuilder.error(client, message.t("commands.qrcode.generation_failed"))],
        })
        .catch(() => {});
    }
  },
};
