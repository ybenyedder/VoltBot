module.exports = {
  name: "banner",
  aliases: ["banniere", "profilebanner", "userbanner"],
  description: "Affiche la bannière de profil d'un utilisateur.",
  category: "utility",
  usage: "+banner [@user]",
  async execute(client, message, args) {
    const target =
      message.mentions.users.first() ||
      client.users.cache.get(args[0]) ||
      message.author;

    const user = await client.users
      .fetch(target.id, { force: true })
      .catch(() => null);

    if (!user || !user.banner) {
      return message
        .reply({
          embeds: [
            client.embedBuilder.warning(
              client,
              message.t("commands.banner.no_banner", { username: target.username }),
            ),
          ],
        })
        .catch(() => {});
    }

    const png = user.bannerURL({ extension: "png", size: 1024 });
    const webp = user.bannerURL({ extension: "webp", size: 1024 });
    const jpg = user.bannerURL({ extension: "jpg", size: 1024 });
    const hero = user.bannerURL({ dynamic: true, size: 1024 });

    const embed = client.embedBuilder
      .premium(client, user.username, `<@${user.id}>`)
      .setAuthor({
        name: user.username,
        iconURL: user.displayAvatarURL({ dynamic: true, size: 64 }),
      })
      .setThumbnail(null)
      .setImage(hero)
      .addFields(
        { name: "ID", value: `\`${user.id}\``, inline: true },
        { name: "PNG", value: `[\`png\`](${png})`, inline: true },
        { name: "WEBP", value: `[\`webp\`](${webp})`, inline: true },
        { name: "JPG", value: `[\`jpg\`](${jpg})`, inline: true },
      );

    await message.reply({ embeds: [embed] }).catch(() => {});
  },
};
