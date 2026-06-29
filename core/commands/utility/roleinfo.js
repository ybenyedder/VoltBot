const nf = new Intl.NumberFormat("fr-FR");

module.exports = {
  name: "roleinfo",
  description: "Affiche les informations d'un rôle existant.",
  category: "utility",
  usage: "+roleinfo @role",
  async execute(client, message, args) {
    const role =
      message.mentions.roles.first() ||
      message.guild.roles.cache.get(args[0]) ||
      message.guild.roles.cache.find(
        (r) => r.name.toLowerCase() === args.join("").toLowerCase(),
      );

    if (!role) {
      return message
        .reply({
          embeds: [
            client.embedBuilder.warning(
              client,
              message.t("commands.roleinfo.role_not_found"),
            ),
          ],
        })
        .catch(() => {});
    }

    const createdTs = Math.floor(role.createdTimestamp / 1000);
    const permsCount = role.permissions.toArray().length;

    const embed = client.embedBuilder
      .base(client, role.name)
      .setAuthor({
        name: role.name,
        iconURL: role.iconURL?.() || undefined,
      })
      .addFields(
        { name: message.t("commands.roleinfo.field_id"), value: `\`${role.id}\``, inline: true },
        { name: message.t("commands.roleinfo.field_color"), value: `\`${role.hexColor}\``, inline: true },
        {
          name: message.t("commands.roleinfo.field_members"),
          value: `${nf.format(role.members.size)}`,
          inline: true,
        },
        {
          name: message.t("commands.roleinfo.field_position"),
          value: `${role.position}/${message.guild.roles.cache.size}`,
          inline: true,
        },
        { name: message.t("commands.roleinfo.field_permissions"), value: `${permsCount}`, inline: true },
        { name: message.t("commands.roleinfo.field_hoist"), value: role.hoist ? message.t("commands.roleinfo.yes") : message.t("commands.roleinfo.no"), inline: true },
        {
          name: message.t("commands.roleinfo.field_mentionable"),
          value: role.mentionable ? message.t("commands.roleinfo.yes") : message.t("commands.roleinfo.no"),
          inline: true,
        },
        { name: message.t("commands.roleinfo.field_managed"), value: role.managed ? message.t("commands.roleinfo.yes") : message.t("commands.roleinfo.no"), inline: true },
        { name: message.t("commands.roleinfo.field_created"), value: `<t:${createdTs}:R>`, inline: true },
      );

    if (role.iconURL()) embed.setThumbnail(role.iconURL({ size: 256 }));

    await message.reply({ embeds: [embed] }).catch(() => {});
  },
};
