const math = require("mathjs");

module.exports = {
  name: "calc",
  aliases: ["math", "calcul"],
  description: "Calcule l'expression mathématique donnée.",
  category: "utility",
  usage: "+calc [expression]",
  async execute(client, message, args) {
    const expression = args.join(" ");
    if (!expression)
      return message
        .reply({
          embeds: [
            client.embedBuilder.warning(
              client,
              message.t("commands.calc.expr_required"),
            ),
          ],
        })
        .catch(() => {});

    try {
      if (!/^[0-9+\-*/().\s]+$/.test(expression)) {
        return message
          .reply({
            embeds: [
              client.embedBuilder.warning(
                client,
                message.t("commands.calc.invalid_chars"),
              ),
            ],
          })
          .catch(() => {});
      }

      const result = math.evaluate(expression);

      const embed = client.embedBuilder.base(client, message.t("commands.calc.title")).addFields(
        {
          name: message.t("commands.calc.field_expression"),
          value: `\`\`\`\n${expression}\n\`\`\``,
          inline: true,
        },
        {
          name: message.t("commands.calc.field_result"),
          value: `\`\`\`\n${result}\n\`\`\``,
          inline: true,
        },
      );

      await message.reply({ embeds: [embed] }).catch(() => {});
    } catch (err) {
      await message
        .reply({
          embeds: [
            client.embedBuilder.warning(
              client,
              message.t("commands.calc.expr_invalid"),
            ),
          ],
        })
        .catch(() => {});
    }
  },
};
