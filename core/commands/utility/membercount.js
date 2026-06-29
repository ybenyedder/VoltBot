const nf = new Intl.NumberFormat("fr-FR");

module.exports = {
  name: "membercount",
  aliases: ["mc", "membres"],
  description: "Nombre de membres du serveur.",
  category: "utility",
  usage: "+membercount",
  async execute(client, message, args) {
    const g = message.guild;
    const total = g.memberCount;
    const humans = g.members.cache.filter((m) => !m.user.bot).size;
    const bots = g.members.cache.filter((m) => m.user.bot).size;
    const online = g.members.cache.filter(
      (m) => m.presence?.status && m.presence.status !== "offline",
    ).size;

    const embed = client.embedBuilder
      .base(client, g.name)
      .setAuthor({ name: g.name, iconURL: g.iconURL() || undefined })
      .addFields(
        { name: message.t("commands.membercount.total"), value: `${nf.format(total)}`, inline: true },
        { name: message.t("commands.membercount.humans"), value: `${nf.format(humans)}`, inline: true },
        { name: message.t("commands.membercount.bots"), value: `${nf.format(bots)}`, inline: true },
        { name: message.t("commands.membercount.online"), value: `${nf.format(online)}`, inline: true },
      );

    await message.reply({ embeds: [embed] }).catch(() => {});
  },
};
