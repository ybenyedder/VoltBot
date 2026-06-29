module.exports = {
  name: "iduser",
  description: "Récupère l'ID d'un utilisateur",
  category: "utility",
  usage: "iduser",
  async execute(client, message, args) {
    const user =
      message.mentions.users.first() ||
      client.users.cache.get(args[0]) ||
      message.author;

    const createdTs = Math.floor(user.createdTimestamp / 1000);

    const embed = client.embedBuilder
      .base(client, user.tag)
      .setAuthor({
        name: user.tag,
        iconURL: user.displayAvatarURL({ dynamic: true, size: 64 }),
      })
      .setThumbnail(user.displayAvatarURL({ dynamic: true, size: 256 }))
      .addFields(
        { name: "ID", value: `\`${user.id}\``, inline: true },
        { name: message.t("commands.iduser.mention"), value: `<@${user.id}>`, inline: true },
        { name: message.t("commands.iduser.created"), value: `<t:${createdTs}:R>`, inline: true },
      );

    await message.reply({ embeds: [embed] }).catch(() => {});
  },
};
