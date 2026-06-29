module.exports = {
  name: "vocal",
  description: "Affiche les informations sur les salons vocaux",
  category: "utility",
  usage: "vocal",
  async execute(client, message, args) {
    const voiceChannels = message.guild.channels.cache.filter(
      (c) => c.type === 2,
    );
    const voiceMembers = message.guild.members.cache.filter(
      (m) => m.voice.channel,
    );
    const pct = Math.round(
      (voiceMembers.size / Math.max(1, message.guild.memberCount)) * 100,
    );

    const channelList =
      voiceChannels
        .first(20)
        .map((c) => `<#${c.id}> \`${c.members.size}/${c.userLimit || "∞"}\``)
        .join("\n") || message.t("commands.vocal.none");

    const embed = client.embedBuilder.base(client, message.t("commands.vocal.title")).addFields(
      {
        name: message.t("commands.vocal.field_channels"),
        value: `\`${voiceChannels.size}\``,
        inline: true,
      },
      {
        name: message.t("commands.vocal.field_connected"),
        value: `\`${voiceMembers.size}\``,
        inline: true,
      },
      { name: message.t("commands.vocal.field_activity"), value: `\`${pct} %\``, inline: true },
      {
        name: message.t("commands.vocal.field_list"),
        value:
          channelList.length > 1024
            ? channelList.slice(0, 1021) + "..."
            : channelList,
        inline: false,
      },
    );

    await message.reply({ embeds: [embed] }).catch(() => {});
  },
};
