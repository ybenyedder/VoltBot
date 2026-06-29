const os = require("os");
const nf = new Intl.NumberFormat("fr-FR");

module.exports = {
  name: "botinfo",
  aliases: ["bot", "info"],
  description: "Informations et statistiques du bot.",
  category: "utility",
  usage: "+botinfo",
  async execute(client, message, args) {
    const up = process.uptime();
    const startTs = Math.floor((Date.now() - up * 1000) / 1000);

    const totalMembers = client.guilds.cache.reduce(
      (a, g) => a + g.memberCount,
      0,
    );
    const totalChannels = client.channels.cache.size;
    const memMb = (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(1);

    const embed = client.embedBuilder
      .base(client, client.user.username)
      .setAuthor({
        name: client.user.username,
        iconURL: client.user.displayAvatarURL({ size: 64 }),
      })
      .setThumbnail(client.user.displayAvatarURL({ size: 256 }))
      .addFields(
        { name: "ID", value: `\`${client.user.id}\``, inline: true },
        {
          name: message.t("commands.botinfo.field_servers"),
          value: `${nf.format(client.guilds.cache.size)}`,
          inline: true,
        },
        {
          name: message.t("commands.botinfo.field_users"),
          value: `${nf.format(totalMembers)}`,
          inline: true,
        },
        {
          name: message.t("commands.botinfo.field_channels"),
          value: `${nf.format(totalChannels)}`,
          inline: true,
        },
        {
          name: message.t("commands.botinfo.field_commands"),
          value: `${nf.format(client.commands.size)}`,
          inline: true,
        },
        { name: "Uptime", value: `<t:${startTs}:R>`, inline: true },
        { name: "RAM", value: message.t("commands.botinfo.ram_value", { mb: memMb }), inline: true },
        { name: "Ping", value: `${client.ws.ping} ms`, inline: true },
        { name: "Node", value: `\`${process.version}\``, inline: true },
        { name: "OS", value: `\`${os.platform()}\``, inline: true },
      );

    await message.reply({ embeds: [embed] }).catch(() => {});
  },
};
