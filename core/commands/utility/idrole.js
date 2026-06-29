const nf = new Intl.NumberFormat("fr-FR");

module.exports = {
  name: "idrole",
  description: "Récupère l'ID d'un rôle",
  category: "utility",
  usage: "idrole",
  async execute(client, message, args) {
    if (!args[0]) {
      return message
        .reply({
          embeds: [
            client.embedBuilder.warning(
              client,
              message.t("commands.idrole.mention_role"),
            ),
          ],
        })
        .catch(() => {});
    }

    const role =
      message.mentions.roles.first() ||
      message.guild.roles.cache.get(args[0]) ||
      message.guild.roles.cache.find(
        (r) => r.name.toLowerCase() === args.join("").toLowerCase(),
      );

    if (!role) {
      return message
        .reply({
          embeds: [client.embedBuilder.warning(client, message.t("commands.idrole.role_not_found"))],
        })
        .catch(() => {});
    }

    const embed = client.embedBuilder
      .base(client, role.name)
      .addFields(
        { name: "ID", value: `\`${role.id}\``, inline: true },
        { name: message.t("commands.idrole.mention"), value: `<@&${role.id}>`, inline: true },
        { name: message.t("commands.idrole.color"), value: `\`${role.hexColor}\``, inline: true },
        {
          name: message.t("commands.idrole.members"),
          value: `${nf.format(role.members.size)}`,
          inline: true,
        },
        { name: message.t("commands.idrole.position"), value: `${role.position}`, inline: true },
      );

    await message.reply({ embeds: [embed] }).catch(() => {});
  },
};
