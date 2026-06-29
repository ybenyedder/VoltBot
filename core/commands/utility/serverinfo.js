const nf = new Intl.NumberFormat("fr-FR");

module.exports = {
  name: "serverinfo",
  aliases: ["si", "servinfo", "guildinfo"],
  description: "Affiche des informations sur le serveur.",
  category: "utility",
  usage: "serverinfo",
  async execute(client, message, args) {
    const guild = message.guild;
    const owner = await guild.fetchOwner().catch(() => null);
    const members = guild.memberCount;
    const bots = guild.members.cache.filter((m) => m.user.bot).size;
    const channels = guild.channels.cache.size;
    const roles = guild.roles.cache.size;
    const emojis = guild.emojis.cache.size;
    const stickers = guild.stickers?.cache?.size || 0;
    const createdTs = Math.floor(guild.createdTimestamp / 1000);

    const verifLevels = {
      0: message.t("commands.serverinfo.verif_none"),
      1: message.t("commands.serverinfo.verif_low"),
      2: message.t("commands.serverinfo.verif_medium"),
      3: message.t("commands.serverinfo.verif_high"),
      4: message.t("commands.serverinfo.verif_very_high"),
    };

    const embed = client.embedBuilder
      .base(client, guild.name)
      .setAuthor({ name: guild.name, iconURL: guild.iconURL() || undefined })
      .setThumbnail(guild.iconURL({ dynamic: true, size: 256 }))
      .addFields(
        { name: "ID", value: `\`${guild.id}\``, inline: true },
        { name: message.t("commands.serverinfo.field_members"), value: `${nf.format(members)}`, inline: true },
        { name: message.t("commands.serverinfo.field_bots"), value: `${nf.format(bots)}`, inline: true },
        { name: message.t("commands.serverinfo.field_channels"), value: `${nf.format(channels)}`, inline: true },
        { name: message.t("commands.serverinfo.field_roles"), value: `${nf.format(roles)}`, inline: true },
        { name: message.t("commands.serverinfo.field_emojis"), value: `${nf.format(emojis)}`, inline: true },
        { name: message.t("commands.serverinfo.field_stickers"), value: `${nf.format(stickers)}`, inline: true },
        { name: message.t("commands.serverinfo.field_created"), value: `<t:${createdTs}:f>`, inline: true },
        {
          name: message.t("commands.serverinfo.field_owner"),
          value: owner ? `<@${owner.id}>` : message.t("commands.serverinfo.unknown"),
          inline: true,
        },
        {
          name: message.t("commands.serverinfo.field_boosts"),
          value: `${nf.format(guild.premiumSubscriptionCount || 0)}`,
          inline: true,
        },
        { name: message.t("commands.serverinfo.field_level"), value: `${guild.premiumTier}`, inline: true },
        {
          name: message.t("commands.serverinfo.field_verification"),
          value:
            verifLevels[guild.verificationLevel] ??
            `${guild.verificationLevel}`,
          inline: true,
        },
      );

    if (guild.bannerURL())
      embed.setImage(guild.bannerURL({ dynamic: true, size: 1024 }));

    await message.reply({ embeds: [embed] }).catch(() => {});
  },
};
