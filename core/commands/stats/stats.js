const { version: djsversion } = require("discord.js");
const os = require("os");

const formatUptime = (ms, message) => {
  let totalSeconds = Math.floor(ms / 1000);
  const days = Math.floor(totalSeconds / 86400);
  totalSeconds %= 86400;
  const hours = Math.floor(totalSeconds / 3600);
  totalSeconds %= 3600;
  const minutes = Math.floor(totalSeconds / 60);
  return message.t("commands.stats.uptime_format", {
    days,
    hours,
    minutes,
  });
};

module.exports = {
  name: "stats",
  aliases: ["botinfo", "botstats", "system"],
  description: "Affiche les statistiques générales du bot.",
  category: "stats",
  usage: "stats",
  async execute(client, message, args) {
    const nf = new Intl.NumberFormat("fr-FR");

    const totalUsers = client.guilds.cache.reduce(
      (acc, guild) => acc + guild.memberCount,
      0,
    );
    const totalChannels = client.channels.cache.size;
    const ramMB = (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(1);
    const wsPing = Math.round(client.ws.ping);

    const sent = await message
      .reply({
        embeds: [
          client.embedBuilder.base(
            client,
            message.t("commands.stats.embed_title"),
          ),
        ],
      })
      .catch(() => null);
    const apiPing = sent ? sent.createdTimestamp - message.createdTimestamp : 0;
    const uptimeStr = formatUptime(client.uptime, message);

    const embed = client.embedBuilder
      .base(client, message.t("commands.stats.embed_title"))
      .setThumbnail(client.user.displayAvatarURL({ size: 256 }))
      .addFields(
        {
          name: message.t("commands.stats.field_servers"),
          value: `\`${nf.format(client.guilds.cache.size)}\``,
          inline: true,
        },
        {
          name: message.t("commands.stats.field_users"),
          value: `\`${nf.format(totalUsers)}\``,
          inline: true,
        },
        {
          name: message.t("commands.stats.field_channels"),
          value: `\`${nf.format(totalChannels)}\``,
          inline: true,
        },
        {
          name: message.t("commands.stats.field_commands"),
          value: `\`${nf.format(client.commands.size)}\``,
          inline: true,
        },
        {
          name: message.t("commands.stats.field_api_latency"),
          value: `\`${nf.format(apiPing)} ms\``,
          inline: true,
        },
        {
          name: message.t("commands.stats.field_ws_latency"),
          value: `\`${nf.format(wsPing)} ms\``,
          inline: true,
        },
        {
          name: message.t("commands.stats.field_uptime"),
          value: `\`${uptimeStr}\``,
          inline: true,
        },
        {
          name: message.t("commands.stats.field_memory"),
          value: `\`${ramMB} MB\``,
          inline: true,
        },
        {
          name: message.t("commands.stats.field_node"),
          value: `\`${process.version}\``,
          inline: true,
        },
      );

    if (sent) {
      await sent.edit({ embeds: [embed] }).catch(() => {});
    } else {
      await message.reply({ embeds: [embed] }).catch(() => {});
    }
  },
};
