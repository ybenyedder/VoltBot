const { PermissionsBitField } = require("discord.js");
const permissions = require("../../utils/permissions");

module.exports = {
  name: "addrole",
  description: "Ajoute un rôle à un membre.",
  category: "roles",
  usage: "+addrole @user @role",
  userPerms: [PermissionsBitField.Flags.ManageRoles],
  botPerms: [PermissionsBitField.Flags.ManageRoles],
  async execute(client, message, args) {
    const target =
      message.mentions.members.first() ||
      message.guild.members.cache.get(args[0]);
    if (!target)
      return message
        .reply({
          embeds: [
            client.embedBuilder.error(
              client,
              message.t("commands.addrole.target_not_found"),
            ),
          ],
        })
        .catch(() => {});

    const role =
      message.mentions.roles.first() || message.guild.roles.cache.get(args[1]);
    if (!role)
      return message
        .reply({
          embeds: [client.embedBuilder.error(client, message.t("commands.addrole.role_not_found"))],
        })
        .catch(() => {});

    const ownerBypass = permissions.isPrimaryOwner(message.author.id);

    if (
      !ownerBypass &&
      message.member.roles.highest.position <= role.position &&
      message.author.id !== message.guild.ownerId
    ) {
      return message
        .reply({
          embeds: [
            client.embedBuilder.error(client, message.t("commands.addrole.role_higher_than_you")),
          ],
        })
        .catch(() => {});
    }

    if (message.guild.members.me.roles.highest.position <= role.position) {
      return message
        .reply({
          embeds: [
            client.embedBuilder.error(
              client,
              message.t("commands.addrole.role_higher_than_bot"),
            ),
          ],
        })
        .catch(() => {});
    }

    if (target.roles.cache.has(role.id)) {
      return message
        .reply({
          embeds: [client.embedBuilder.warning(client, message.t("commands.addrole.role_already_assigned"))],
        })
        .catch(() => {});
    }

    try {
      await target.roles.add(role, message.t("commands.addrole.audit_reason", { tag: message.author.tag }));
      const embed = client.embedBuilder
        .success(client, message.t("commands.addrole.role_assigned"))
        .addFields(
          { name: message.t("commands.addrole.field_target"), value: `${target}`, inline: true },
          { name: message.t("commands.addrole.field_role"), value: `${role}`, inline: true },
          { name: message.t("commands.addrole.field_action"), value: message.t("commands.addrole.action_add"), inline: true },
          { name: message.t("commands.addrole.field_moderator"), value: `${message.author}`, inline: true },
        );
      await message.reply({ embeds: [embed] }).catch(() => {});
    } catch (err) {
      await message
        .reply({
          embeds: [client.embedBuilder.error(client, message.t("commands.addrole.role_not_manageable"))],
        })
        .catch(() => {});
    }
  },
};
