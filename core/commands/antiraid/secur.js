const { PermissionFlagsBits } = require("discord.js");

module.exports = {
  name: "secur",
  aliases: ["security", "protection"],
  description: "Affiche le niveau de sécurité du serveur",
  category: "antiraid",
  usage: "secur",
  userPerms: [PermissionFlagsBits.Administrator],
  async execute(client, message, args) {
    const antiraid = client.db.getAntiraidConfig(message.guild.id);

    const securityModules = [
      { id: "antiBan", name: "Anti-Ban" },
      { id: "antiBot", name: "Anti-Bot" },
      { id: "antiChannel", name: "Anti-Channel" },
      { id: "antiCreateInvite", name: "Anti-Invite" },
      { id: "antiEditGuild", name: "Anti-Edit" },
      { id: "antiEmote", name: "Anti-Emote" },
      { id: "antiLink", name: "Anti-Link" },
      { id: "antiMassMention", name: "Anti-Mention" },
      { id: "antiNewAccount", name: "Anti-Join" },
      { id: "antiRole", name: "Anti-Role" },
      { id: "antiSoundboard", name: "Anti-Sound" },
      { id: "antiSpam", name: "Anti-Spam" },
      { id: "antiSticker", name: "Anti-Sticker" },
      { id: "antiGif", name: "Anti-GIF" },
      { id: "antiThread", name: "Anti-Thread" },
      { id: "antiUnban", name: "Anti-Unban" },
      { id: "antiWebhook", name: "Anti-Webhook" },
      { id: "antiRank", name: "Anti-Rank" },
      { id: "antiNuke", name: "Anti-Nuke" },
      { id: "antiKick", name: "Anti-Kick" },
      { id: "raidMode", name: "Raid-Mode" },
      { id: "antiBadWords", name: "Anti-BadWords" },
    ];

    const isOn = (m) => {
      const v = antiraid[m.id];
      return v && v !== 0 && v !== "0";
    };

    const enabledCount = securityModules.filter(isOn).length;
    const percentage = (enabledCount / securityModules.length) * 100;

    let level = message.t("commands.secur.level_weak");
    if (percentage >= 80) level = message.t("commands.secur.level_optimal");
    else if (percentage >= 50)
      level = message.t("commands.secur.level_medium");
    else if (percentage >= 20)
      level = message.t("commands.secur.level_basic");

    const active =
      securityModules
        .filter(isOn)
        .map((m) => `\`${m.name}\``)
        .join(" ") || message.t("commands.secur.none");
    const inactive =
      securityModules
        .filter((m) => !isOn(m))
        .map((m) => `\`${m.name}\``)
        .join(" ") || message.t("commands.secur.none");

    const embed = client.embedBuilder
      .base(client, message.t("commands.secur.title"))
      .setDescription(null)
      .setThumbnail(message.guild.iconURL({ dynamic: true }))
      .addFields(
        {
          name: message.t("commands.secur.field_level"),
          value: level,
          inline: true,
        },
        {
          name: message.t("commands.secur.field_modules"),
          value: `\`${enabledCount}/${securityModules.length}\``,
          inline: true,
        },
        {
          name: message.t("commands.secur.field_coverage"),
          value: `\`${Math.round(percentage)}%\``,
          inline: true,
        },
        {
          name: message.t("commands.secur.field_active"),
          value: active,
          inline: false,
        },
        {
          name: message.t("commands.secur.field_inactive"),
          value: inactive,
          inline: false,
        },
      );

    message.reply({ embeds: [embed] }).catch(() => {});
  },
};
