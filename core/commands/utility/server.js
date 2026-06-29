const nf = new Intl.NumberFormat("fr-FR");

module.exports = {
  name: "server",
  description: "Affiche des informations détaillées sur le serveur",
  category: "utility",
  usage: "server",
  async execute(client, message, args) {
    const guild = message.guild;
    const owner = await guild.fetchOwner().catch(() => null);
    const humans = guild.members.cache.filter((m) => !m.user.bot).size;
    const bots = guild.members.cache.filter((m) => m.user.bot).size;
    const texts = guild.channels.cache.filter((c) => c.type === 0).size;
    const voices = guild.channels.cache.filter((c) => c.type === 2).size;
    const createdTs = Math.floor(guild.createdTimestamp / 1000);

    const embed = client.embedBuilder
      .base(client, guild.name)
      .setAuthor({ name: guild.name, iconURL: guild.iconURL() || undefined })
      .setThumbnail(guild.iconURL({ dynamic: true, size: 256 }))
      .addFields(
        { name: "ID", value: `\`${guild.id}\``, inline: true },
        {
          name: message.t("commands.server.field_owner"),
          value: owner ? `<@${owner.id}>` : message.t("commands.server.unknown"),
          inline: true,
        },
        { name: message.t("commands.server.field_created"), value: `<t:${createdTs}:f>`, inline: true },
        {
          name: message.t("commands.server.field_members"),
          value: `${nf.format(guild.memberCount)}`,
          inline: true,
        },
        { name: message.t("commands.server.field_humans"), value: `${nf.format(humans)}`, inline: true },
        { name: message.t("commands.server.field_bots"), value: `${nf.format(bots)}`, inline: true },
        { name: message.t("commands.server.field_text"), value: `${nf.format(texts)}`, inline: true },
        { name: message.t("commands.server.field_voice"), value: `${nf.format(voices)}`, inline: true },
        {
          name: message.t("commands.server.field_roles"),
          value: `${nf.format(guild.roles.cache.size)}`,
          inline: true,
        },
        {
          name: message.t("commands.server.field_boosts"),
          value: `${nf.format(guild.premiumSubscriptionCount || 0)}`,
          inline: true,
        },
        { name: message.t("commands.server.field_level"), value: `${guild.premiumTier}`, inline: true },
        {
          name: message.t("commands.server.field_verification"),
          value: `${guild.verificationLevel}`,
          inline: true,
        },
      );

    if (guild.bannerURL()) embed.setImage(guild.bannerURL({ size: 1024 }));

    await message.reply({ embeds: [embed] }).catch(() => {});
  },
};
