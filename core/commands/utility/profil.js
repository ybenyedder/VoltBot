const nf = new Intl.NumberFormat("fr-FR");

module.exports = {
  name: "profil",
  description: "Affiche le profil détaillé d'un utilisateur",
  category: "utility",
  usage: "profil",
  async execute(client, message, args) {
    const user =
      message.mentions.users.first() ||
      client.users.cache.get(args[0]) ||
      message.author;
    const member = message.guild.members.cache.get(user.id);

    if (!member) {
      return message
        .reply({
          embeds: [
            client.embedBuilder.warning(
              client,
              message.t("commands.profil.member_not_found"),
            ),
          ],
        })
        .catch(() => {});
    }

    const roleCount = member.roles.cache.filter(
      (r) => r.id !== message.guild.id,
    ).size;
    const createdTs = Math.floor(user.createdTimestamp / 1000);
    const joinedTs = member.joinedTimestamp
      ? Math.floor(member.joinedTimestamp / 1000)
      : null;

    const topRole = member.roles.highest;
    const userData = client.db.getUser
      ? client.db.getUser(user.id, message.guild.id)
      : null;

    const embed = client.embedBuilder
      .premium(client, user.tag, `<@${user.id}>`)
      .setAuthor({
        name: user.tag,
        iconURL: user.displayAvatarURL({ dynamic: true, size: 64 }),
      })
      .setThumbnail(user.displayAvatarURL({ dynamic: true, size: 256 }))
      .addFields(
        {
          name: message.t("commands.profil.created"),
          value: `<t:${createdTs}:R>`,
          inline: true,
        },
        {
          name: message.t("commands.profil.joined"),
          value: joinedTs ? `<t:${joinedTs}:R>` : "`—`",
          inline: true,
        },
        { name: message.t("commands.profil.roles"), value: `\`${nf.format(roleCount)}\``, inline: true },
        {
          name: message.t("commands.profil.status"),
          value: `\`${member.presence?.status || "offline"}\``,
          inline: true,
        },
        {
          name: message.t("commands.profil.top_role"),
          value:
            topRole && topRole.id !== message.guild.id
              ? `<@&${topRole.id}>`
              : "`—`",
          inline: true,
        },
        {
          name: message.t("commands.profil.color"),
          value: `\`${member.displayHexColor}\``,
          inline: true,
        },
      );

    if (userData) {
      embed.addFields(
        {
          name: message.t("commands.profil.level"),
          value: `\`${nf.format(userData.level || 0)}\``,
          inline: true,
        },
        {
          name: "XP",
          value: `\`${nf.format(userData.xp || 0)}\``,
          inline: true,
        },
        {
          name: "Coins",
          value: `\`${nf.format((userData.coins || 0) + (userData.bank || 0))}\``,
          inline: true,
        },
      );
    }

    embed.setFooter({
      text: `ID ${user.id}`,
      iconURL: user.displayAvatarURL({ size: 32 }),
    });

    if (user.banner) {
      try {
        const fetched = await client.users.fetch(user.id, { force: true });
        if (fetched.banner)
          embed.setImage(fetched.bannerURL({ dynamic: true, size: 1024 }));
      } catch {}
    }

    await message.reply({ embeds: [embed] }).catch(() => {});
  },
};
