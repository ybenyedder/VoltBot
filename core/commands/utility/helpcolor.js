module.exports = {
  name: "helpcolor",
  description: "Affiche les couleurs disponibles pour le thème",
  category: "utility",
  usage: "helpcolor",
  async execute(client, message, args) {
    const colors = [
      { name: message.t("commands.helpcolor.blue"), hex: "#3498db" },
      { name: message.t("commands.helpcolor.red"), hex: "#e74c3c" },
      { name: message.t("commands.helpcolor.green"), hex: "#2ecc71" },
      { name: message.t("commands.helpcolor.yellow"), hex: "#f1c40f" },
      { name: message.t("commands.helpcolor.purple"), hex: "#9b59b6" },
      { name: message.t("commands.helpcolor.orange"), hex: "#e67e22" },
      { name: message.t("commands.helpcolor.gray"), hex: "#95a5a6" },
      { name: message.t("commands.helpcolor.black"), hex: "#34495e" },
      { name: message.t("commands.helpcolor.pink"), hex: "#ff69b4" },
      { name: message.t("commands.helpcolor.cyan"), hex: "#00bcd4" },
    ];

    const embed = client.embedBuilder
      .base(client, message.t("commands.helpcolor.title"))
      .addFields(
        ...colors.map((c) => ({
          name: c.name,
          value: `\`${c.hex}\``,
          inline: true,
        })),
      )
      .setFooter({ text: message.t("commands.helpcolor.footer") });

    await message.reply({ embeds: [embed] }).catch(() => {});
  },
};
