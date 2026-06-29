module.exports = {
  name: "invited",
  description: "Affiche qui a invité un utilisateur",
  category: "invitations",
  usage: "invited",
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

    const inviteData = client.db.getUser(
      user.id,
      message.guild.id,
      "inviteData",
    );

    if (!inviteData || !inviteData.inviterId) {
      return message
        .reply({
          embeds: [
            client.embedBuilder.info(
              client,
              message.t("commands.invited.none"),
            ),
          ],
        })
        .catch(() => {});
    }

    const ts = inviteData.date
      ? Math.floor(new Date(inviteData.date).getTime() / 1000)
      : null;
    const value = ts
      ? message.t("commands.invited.by_at", {
          inviter: inviteData.inviterId,
          ts,
        })
      : message.t("commands.invited.by", { inviter: inviteData.inviterId });

    const embed = client.embedBuilder
      .base(client, `Invitation de ${user.tag}`)
      .setThumbnail(user.displayAvatarURL({ size: 256 }))
      .addFields({ name: "Invitation", value, inline: false });

    await message.reply({ embeds: [embed] }).catch(() => {});
  },
};
