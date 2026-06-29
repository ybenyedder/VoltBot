module.exports = {
  name: "decode",
  aliases: ["debase64"],
  description: "Décode du texte encodé en Base64.",
  category: "utility",
  usage: "+decode [texte en base64]",
  async execute(client, message, args) {
    const text = args.join(" ");
    if (!text)
      return message
        .reply({
          embeds: [client.embedBuilder.warning(client, message.t("commands.decode.text_required"))],
        })
        .catch(() => {});

    try {
      const decoded = Buffer.from(text, "base64").toString("utf-8");

      if (decoded.length > 1000)
        return message
          .reply({
            embeds: [client.embedBuilder.error(client, message.t("commands.decode.result_too_long"))],
          })
          .catch(() => {});

      const inTrunc = text.length > 500 ? text.slice(0, 497) + "..." : text;

      await message
        .reply({
          embeds: [
            client.embedBuilder.base(client, message.t("commands.decode.title")).addFields(
              { name: message.t("commands.decode.field_method"), value: "`Base64`", inline: true },
              {
                name: message.t("commands.decode.field_input"),
                value: `\`\`\`\n${inTrunc}\n\`\`\``,
                inline: false,
              },
              {
                name: message.t("commands.decode.field_output"),
                value: `\`\`\`\n${decoded}\n\`\`\``,
                inline: false,
              },
            ),
          ],
        })
        .catch(() => {});
    } catch (err) {
      message
        .reply({
          embeds: [client.embedBuilder.error(client, message.t("commands.decode.invalid_base64"))],
        })
        .catch(() => {});
    }
  },
};
