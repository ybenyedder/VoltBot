module.exports = {
  name: "onepage",
  description: "Affiche toutes les commandes sur une seule page",
  category: "utility",
  usage: "onepage",
  async execute(client, message, args) {
    const categories = new Map();

    client.commands.forEach((cmd) => {
      const category = cmd.category || "other";
      if (!categories.has(category)) categories.set(category, []);
      categories.get(category).push(cmd);
    });

    const embed = client.embedBuilder.base(client, message.t("commands.onepage.title"));

    const sorted = Array.from(categories.keys()).sort();
    let totalChars = 0;
    for (const cat of sorted) {
      const cmds = categories.get(cat);
      const label = cat.charAt(0).toUpperCase() + cat.slice(1);
      const names = cmds.map((c) => `\`${c.name}\``).join(", ");
      const value = names.length > 1024 ? names.slice(0, 1021) + "..." : names;
      totalChars += value.length + label.length + 16;
      if (totalChars > 5500) break;
      embed.addFields({
        name: `${label} (${cmds.length})`,
        value,
        inline: false,
      });
    }

    embed.setFooter({
      text: message.t("commands.onepage.footer", { commands: client.commands.size, categories: categories.size }),
    });

    await message.reply({ embeds: [embed] }).catch(() => {});
  },
};
