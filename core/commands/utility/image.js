module.exports = {
  name: "image",
  description: "Affiche une image aléatoire ou recherche une image",
  category: "utility",
  usage: "image",
  async execute(client, message, args) {
    if (!args[0]) {
      const randomImages = [
        "https://picsum.photos/800/600",
        "https://source.unsplash.com/800x600/?nature",
        "https://source.unsplash.com/800x600/?city",
        "https://source.unsplash.com/800x600/?technology",
      ];

      const randomImage =
        randomImages[Math.floor(Math.random() * randomImages.length)];

      const embed = client.embedBuilder
        .base(client, message.t("commands.image.random_image"))
        .setImage(randomImage)
        .addFields(
          { name: message.t("commands.image.source"), value: "`Unsplash / Picsum`", inline: true },
          { name: message.t("commands.image.link"), value: `[${message.t("commands.image.open")}](${randomImage})`, inline: true },
        );

      return message.reply({ embeds: [embed] }).catch(() => {});
    }

    const query = args.join(" ");
    const imageUrl = `https://source.unsplash.com/800x600/?${encodeURIComponent(query)}`;

    const embed = client.embedBuilder
      .base(client, query)
      .setImage(imageUrl)
      .addFields(
        { name: message.t("commands.image.query"), value: `\`${query}\``, inline: true },
        { name: message.t("commands.image.source"), value: "`Unsplash`", inline: true },
        { name: message.t("commands.image.link"), value: `[${message.t("commands.image.open")}](${imageUrl})`, inline: true },
      );

    await message.reply({ embeds: [embed] }).catch(() => {});
  },
};
