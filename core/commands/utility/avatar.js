module.exports = {
  name: "avatar",
  aliases: ["av", "pp", "pdp"],
  description: "Affiche l'avatar (photo de profil) d'un utilisateur.",
  category: "utility",
  usage: "+avatar [@user]",
  async execute(client, message, args) {
    const target =
      message.mentions.users.first() ||
      client.users.cache.get(args[0]) ||
      message.author;

    const png = target.displayAvatarURL({ extension: "png", size: 1024 });
    const webp = target.displayAvatarURL({ extension: "webp", size: 1024 });
    const jpg = target.displayAvatarURL({ extension: "jpg", size: 1024 });
    const hero = target.displayAvatarURL({ dynamic: true, size: 1024 });

    const embed = client.embedBuilder
      .premium(client, target.username, `<@${target.id}>`)
      .setAuthor({
        name: target.username,
        iconURL: target.displayAvatarURL({ dynamic: true, size: 64 }),
      })
      .setThumbnail(null)
      .setImage(hero)
      .addFields(
        { name: "ID", value: `\`${target.id}\``, inline: true },
        { name: "PNG", value: `[\`png\`](${png})`, inline: true },
        { name: "WEBP", value: `[\`webp\`](${webp})`, inline: true },
        { name: "JPG", value: `[\`jpg\`](${jpg})`, inline: true },
      );

    await message.reply({ embeds: [embed] }).catch(() => {});
  },
};
