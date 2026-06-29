const Logger = require("../../utils/logger");

const nf = new Intl.NumberFormat("fr-FR");

module.exports = {
  name: "panel",
  aliases: ["dashboard", "serverpanel"],
  description: "Dashboard complet du serveur.",
  category: "utility",
  usage: "+panel",
  async execute(client, message, args) {
    const g = message.guild;
    const guildSettings = client.db.getGuild(g.id);
    const antiraid = client.db.getAntiraidConfig(g.id);
    const prefix = guildSettings.prefix || client.config.prefix;

    const humans = g.members.cache.filter((m) => !m.user.bot).size;
    const bots = g.members.cache.filter((m) => m.user.bot).size;
    const textChannels = g.channels.cache.filter((c) => c.type === 0).size;
    const voiceChannels = g.channels.cache.filter((c) => c.type === 2).size;
    const categories = g.channels.cache.filter((c) => c.type === 4).size;
    const roles = g.roles.cache.size;

    let antiraidStatus = message.t("commands.panel.disabled");
    try {
      const ar = antiraid;
      if (ar) {
        const active = [];
        if (ar.raidMode === 1) active.push("Raid");
        if (ar.antiBot === 1) active.push("Bot");
        if (ar.antiNuke === 1) active.push("Nuke");
        if (ar.antiChannel === 1) active.push("Channel");
        if (ar.antiRole === 1) active.push("Role");
        if (ar.antiBan === 1) active.push("Ban");
        if (ar.antiWebhook === 1) active.push("Webhook");
        if (active.length > 0) antiraidStatus = active.join(", ");
      }
    } catch (e) {
      Logger.error(
        `[CMD panel] guild=${g.id} user=${message?.author?.id || "?"} antiraid config fetch failed:`,
        e,
      );
    }

    const automod = [];
    if (antiraid.antiSpam) automod.push("Spam");
    if (antiraid.antiLink) automod.push(message.t("commands.panel.automod_links"));
    if ((antiraid.antiBadWords ?? guildSettings.antiBadWords) === 1)
      automod.push(message.t("commands.panel.automod_insults"));
    const automodStatus = automod.length > 0 ? automod.join(", ") : message.t("commands.panel.disabled");

    const createdTs = Math.floor(g.createdTimestamp / 1000);

    const embed = client.embedBuilder
      .base(client, g.name)
      .setAuthor({ name: g.name, iconURL: g.iconURL() || undefined })
      .setThumbnail(g.iconURL({ size: 256 }))
      .addFields(
        { name: "ID", value: `\`${g.id}\``, inline: true },
        { name: message.t("commands.panel.prefix"), value: `\`${prefix}\``, inline: true },
        {
          name: message.t("commands.panel.owner"),
          value: `<@${g.ownerId}>`,
          inline: true,
        },
        {
          name: message.t("commands.panel.members"),
          value: `${nf.format(g.memberCount)}`,
          inline: true,
        },
        { name: message.t("commands.panel.humans"), value: `${nf.format(humans)}`, inline: true },
        { name: message.t("commands.panel.bots"), value: `${nf.format(bots)}`, inline: true },
        { name: message.t("commands.panel.text"), value: `${nf.format(textChannels)}`, inline: true },
        { name: message.t("commands.panel.voice"), value: `${nf.format(voiceChannels)}`, inline: true },
        { name: message.t("commands.panel.categories"), value: `${nf.format(categories)}`, inline: true },
        { name: message.t("commands.panel.roles"), value: `${nf.format(roles)}`, inline: true },
        {
          name: "Boost",
          value: message.t("commands.panel.boost_value", { tier: g.premiumTier, count: nf.format(g.premiumSubscriptionCount || 0) }),
          inline: true,
        },
        { name: message.t("commands.panel.created"), value: `<t:${createdTs}:D>`, inline: true },
        { name: "Anti-Raid", value: antiraidStatus, inline: true },
        { name: "AutoMod", value: automodStatus, inline: true },
      );

    if (g.bannerURL()) embed.setImage(g.bannerURL({ size: 1024 }));

    await message.reply({ embeds: [embed] }).catch(() => {});
  },
};
