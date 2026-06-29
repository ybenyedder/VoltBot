module.exports = {
  name: "encode",
  aliases: ["base64"],
  description: "Encode du texte en Base64.",
  category: "utility",
  usage: "+encode [texte]",
  async execute(client, message, args) {
    const text = args.join(" ");
    if (!text)
      return message
        .reply({
          embeds: [client.embedBuilder.warning(client, message.t("commands.encode.text_required"))],
        })
        .catch(() => {});

    const encoded = Buffer.from(text).toString("base64");

    if (encoded.length > 1000)
      return message
        .reply({
          embeds: [client.embedBuilder.error(client, message.t("commands.encode.result_too_long"))],
        })
        .catch(() => {});

    const inTrunc = text.length > 500 ? text.slice(0, 497) + "..." : text;

    await message
      .reply({
        embeds: [
          client.embedBuilder.base(client, message.t("commands.encode.title")).addFields(
            { name: message.t("commands.encode.field_method"), value: "`Base64`", inline: true },
            {
              name: message.t("commands.encode.field_input"),
              value: `\`\`\`\n${inTrunc}\n\`\`\``,
              inline: false,
            },
            {
              name: message.t("commands.encode.field_output"),
              value: `\`\`\`\n${encoded}\n\`\`\``,
              inline: false,
            },
          ),
        ],
      })
      .catch(() => {});
  },
};
