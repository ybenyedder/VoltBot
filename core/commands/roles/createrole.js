const { PermissionsBitField } = require("discord.js");

module.exports = {
  name: "createrole",
  description: "Crée un nouveau rôle sur le serveur.",
  category: "roles",
  usage: "+createrole [Nom] [CouleurHex(optionnel)]",
  userPerms: [PermissionsBitField.Flags.ManageRoles],
  botPerms: [PermissionsBitField.Flags.ManageRoles],
  async execute(client, message, args) {
    if (args.length === 0) {
      return message
        .reply({
          embeds: [client.embedBuilder.error(client, message.t("commands.createrole.name_required"))],
        })
        .catch(() => {});
    }

    const hexRegex = /^#([0-9A-F]{3}){1,2}$/i;
    const lastArg = args[args.length - 1];
    const hasColor = args.length > 1 && hexRegex.test(lastArg);
    const roleName = hasColor ? args.slice(0, -1).join(" ") : args.join(" ");
    const roleColor = hasColor ? lastArg : "#99aab5";

    try {
      const newRole = await message.guild.roles.create({
        name: roleName,
        color: roleColor,
        reason: message.t("commands.createrole.audit_reason", { tag: message.author.tag }),
      });

      const permsCount = newRole.permissions.toArray().length;
      const embed = client.embedBuilder
        .success(client, message.t("commands.createrole.created"))
        .addFields(
          { name: message.t("commands.createrole.field_name"), value: `${newRole}`, inline: true },
          { name: message.t("commands.createrole.field_color"), value: `\`${roleColor}\``, inline: true },
          { name: message.t("commands.createrole.field_permissions"), value: `${permsCount}`, inline: true },
          { name: message.t("commands.createrole.field_id"), value: `\`${newRole.id}\``, inline: true },
        );
      await message.reply({ embeds: [embed] }).catch(() => {});
    } catch (err) {
      await message
        .reply({
          embeds: [client.embedBuilder.error(client, message.t("commands.createrole.not_manageable"))],
        })
        .catch(() => {});
    }
  },
};
