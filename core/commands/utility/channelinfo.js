module.exports = {
  name: "channelinfo",
  aliases: ["ci"],
  description: "Informations sur un salon.",
  category: "utility",
  usage: "+channelinfo [#salon]",
  async execute(client, message, args) {
    const channel =
      message.mentions.channels.first() ||
      message.guild.channels.cache.get(args[0]) ||
      message.channel;

    const typeMap = {
      0: message.t("commands.channelinfo.type_text"),
      2: message.t("commands.channelinfo.type_voice"),
      4: message.t("commands.channelinfo.type_category"),
      5: message.t("commands.channelinfo.type_announcement"),
      10: message.t("commands.channelinfo.type_thread"),
      11: message.t("commands.channelinfo.type_thread_public"),
      12: message.t("commands.channelinfo.type_thread_private"),
      13: message.t("commands.channelinfo.type_stage"),
      15: message.t("commands.channelinfo.type_forum"),
    };

    const createdTs = Math.floor(channel.createdTimestamp / 1000);

    const embed = client.embedBuilder
      .base(client, `#${channel.name}`)
      .addFields(
        { name: "ID", value: `\`${channel.id}\``, inline: true },
        {
          name: message.t("commands.channelinfo.field_type"),
          value: typeMap[channel.type] || `${channel.type}`,
          inline: true,
        },
        {
          name: message.t("commands.channelinfo.field_position"),
          value: `${channel.position ?? "N/A"}`,
          inline: true,
        },
        { name: message.t("commands.channelinfo.field_created"), value: `<t:${createdTs}:R>`, inline: true },
        { name: "NSFW", value: channel.nsfw ? message.t("commands.channelinfo.yes") : message.t("commands.channelinfo.no"), inline: true },
        {
          name: "Slowmode",
          value: channel.rateLimitPerUser
            ? `${channel.rateLimitPerUser}s`
            : message.t("commands.channelinfo.none_m"),
          inline: true,
        },
      );

    if (channel.topic) {
      embed.addFields({ name: message.t("commands.channelinfo.field_topic"), value: channel.topic, inline: false });
    }

    if (channel.type === 2 || channel.type === 13) {
      embed.addFields(
        {
          name: "Bitrate",
          value: channel.bitrate ? `${channel.bitrate / 1000} kbps` : "N/A",
          inline: true,
        },
        {
          name: message.t("commands.channelinfo.field_limit"),
          value: channel.userLimit ? `${channel.userLimit}` : message.t("commands.channelinfo.none_f"),
          inline: true,
        },
      );
    }

    await message.reply({ embeds: [embed] }).catch(() => {});
  },
};
