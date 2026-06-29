const fmtNum = (n) => new Intl.NumberFormat("fr-FR").format(n || 0);

module.exports = {
  name: "invites",
  description: "Affiche les invitations d'un utilisateur",
  category: "invitations",
  usage: "invites",
  async execute(client, message, args) {
    const user =
      message.mentions.users.first() ||
      client.users.cache.get(args[0]) ||
      message.author;

    if (!user) {
      return message
        .reply({
          embeds: [client.embedBuilder.error(client, "Membre introuvable.")],
        })
        .catch(() => {});
    }

    let invites = client.db.getUser(user.id, message.guild.id, "invites") || {
      regular: 0,
      bonus: 0,
      leaves: 0,
      total: 0,
    };

    if (typeof invites === "string") {
      try {
        invites = JSON.parse(invites);
      } catch (e) {
        invites = { regular: 0, bonus: 0, leaves: 0, total: 0 };
      }
    }

    let regularInvites = 0;
    try {
      const guildInvites = await message.guild.invites.fetch();
      const userInvites = guildInvites.filter(
        (i) => i.inviter && i.inviter.id === user.id,
      );
      regularInvites = userInvites.reduce(
        (acc, invite) => acc + invite.uses,
        0,
      );

      invites.regular = regularInvites;
      invites.total =
        regularInvites + (invites.bonus || 0) - (invites.leaves || 0);
      client.db.updateUser(user.id, message.guild.id, "invites", invites);
    } catch (e) {
      regularInvites =
        invites.regular ||
        client.db.getInvitesByInviter(message.guild.id, user.id)?.length ||
        0;
    }

    const bonus = invites.bonus || 0;
    const leaves = invites.leaves || 0;
    const fake = invites.fake || 0;
    const totalInvites = regularInvites + bonus - leaves - fake;

    const embed = client.embedBuilder
      .base(client, `Invitations de ${user.tag}`)
      .setThumbnail(user.displayAvatarURL({ size: 256 }))
      .addFields(
        {
          name: message.t("commands.invites.field_regular"),
          value: `\`\`\`prolog\n${fmtNum(regularInvites)}\n\`\`\``,
          inline: true,
        },
        {
          name: "Bonus",
          value: `\`\`\`prolog\n${fmtNum(bonus)}\n\`\`\``,
          inline: true,
        },
        {
          name: message.t("commands.invites.field_leaves"),
          value: `\`\`\`prolog\n${fmtNum(leaves)}\n\`\`\``,
          inline: true,
        },
        {
          name: "Faux",
          value: `\`\`\`prolog\n${fmtNum(fake)}\n\`\`\``,
          inline: true,
        },
        {
          name: "Total",
          value: `\`\`\`prolog\n${fmtNum(totalInvites)}\n\`\`\``,
          inline: true,
        },
      );

    await message.reply({ embeds: [embed] }).catch(() => {});
  },
};
