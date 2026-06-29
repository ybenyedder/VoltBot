const { EmbedBuilder } = require("discord.js");

module.exports = {
  name: "server-stats",
  aliases: ["s-stats", "ss", "serverstats"],
  description: "Affiche les statistiques rapides du serveur.",
  category: "stats",
  usage: "server-stats",
  async execute(client, message, args) {
    const guild = message.guild;
    const nf = new Intl.NumberFormat("en-US");

    const members = guild.memberCount;
    const online = guild.presences.cache.filter(
      (presence) => presence.status !== "offline",
    ).size;
    const inVoice = guild.voiceStates.cache.filter(
      (voiceState) => voiceState.channelId,
    ).size;
    const streaming = guild.voiceStates.cache.filter(
      (vs) => vs.channelId && vs.streaming,
    ).size;
    const boosts = guild.premiumSubscriptionCount || 0;

    const embed = new EmbedBuilder()
      .setColor(client.embedBuilder.getTheme(client))
      .setTitle(message.t("commands.server-stats.title", { guild: guild.name }))
      .setDescription(
        [
          message.t("commands.server-stats.members", {
            count: nf.format(members),
          }),
          message.t("commands.server-stats.online", {
            count: nf.format(online),
          }),
          message.t("commands.server-stats.in_voice", {
            count: nf.format(inVoice),
          }),
          message.t("commands.server-stats.streaming", {
            count: nf.format(streaming),
          }),
          message.t("commands.server-stats.boosts", {
            count: nf.format(boosts),
          }),
        ].join("\n"),
      );

    const icon = guild.iconURL({ dynamic: true, size: 256 });
    if (icon) embed.setThumbnail(icon);

    await message.reply({ embeds: [embed] }).catch(() => {});
  },
};
