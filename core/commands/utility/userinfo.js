const nf = new Intl.NumberFormat("fr-FR");

module.exports = {
  name: "userinfo",
  aliases: ["ui", "whois", "infouser"],
  description: "Affiche des informations sur un utilisateur.",
  category: "utility",
  usage: "+userinfo [@user]",
  async execute(client, message, args) {
    const target =
      message.mentions.members.first() ||
      message.guild.members.cache.get(args[0]) ||
      message.member;

    const roles = target.roles.cache.filter((r) => r.id !== message.guild.id);

    const sortedMembers = message.guild.members.cache
      .filter((m) => m.joinedTimestamp)
      .sort((a, b) => a.joinedTimestamp - b.joinedTimestamp)
      .map((m) => m.id);
    const joinPosition = sortedMembers.indexOf(target.id) + 1;

    const flags = target.user.flags ? target.user.flags.toArray() : [];
    const createdTs = Math.floor(target.user.createdTimestamp / 1000);
    const joinedTs = target.joinedTimestamp
      ? Math.floor(target.joinedTimestamp / 1000)
      : null;

    const status = target.presence?.status || "offline";
    const topRole = target.roles.highest;

    const embed = client.embedBuilder
      .premium(client, target.user.tag, `<@${target.id}>`)
      .setAuthor({
        name: target.user.tag,
        iconURL: target.user.displayAvatarURL({ dynamic: true, size: 64 }),
      })
      .setThumbnail(target.user.displayAvatarURL({ dynamic: true, size: 256 }))
      .addFields(
        { name: message.t("commands.userinfo.field_created"), value: `<t:${createdTs}:R>`, inline: true },
        {
          name: message.t("commands.userinfo.field_joined"),
          value: joinedTs ? `<t:${joinedTs}:R>` : "`—`",
          inline: true,
        },
        {
          name: message.t("commands.userinfo.field_position"),
          value:
            joinPosition > 0
              ? `\`#${nf.format(joinPosition)} / ${nf.format(message.guild.memberCount)}\``
              : "`—`",
          inline: true,
        },
        { name: message.t("commands.userinfo.field_roles"), value: `\`${nf.format(roles.size)}\``, inline: true },
        { name: message.t("commands.userinfo.field_badges"), value: `\`${nf.format(flags.length)}\``, inline: true },
        {
          name: message.t("commands.userinfo.field_status"),
          value: `\`${status}\``,
          inline: true,
        },
        {
          name: message.t("commands.userinfo.field_top_role"),
          value:
            topRole && topRole.id !== message.guild.id
              ? `<@&${topRole.id}>`
              : "`—`",
          inline: true,
        },
        {
          name: message.t("commands.userinfo.field_color"),
          value: `\`${target.displayHexColor}\``,
          inline: true,
        },
        {
          name: message.t("commands.userinfo.field_type"),
          value: `\`${target.user.bot ? message.t("commands.userinfo.type_bot") : message.t("commands.userinfo.type_member")}\``,
          inline: true,
        },
      )
      .setFooter({
        text: `ID ${target.id}`,
        iconURL: target.user.displayAvatarURL({ size: 32 }),
      });

    if (target.user.banner) {
      try {
        const fetched = await client.users.fetch(target.id, { force: true });
        if (fetched.banner)
          embed.setImage(fetched.bannerURL({ dynamic: true, size: 1024 }));
      } catch {}
    }

    await message.reply({ embeds: [embed] }).catch(() => {});
  },
};
