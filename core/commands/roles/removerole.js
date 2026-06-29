const { PermissionsBitField } = require("discord.js");
const permissions = require("../../utils/permissions");

module.exports = {
  name: "removerole",
  description: "Retire un rôle à un membre.",
  category: "roles",
  usage: "+removerole @user @role",
  userPerms: [PermissionsBitField.Flags.ManageRoles],
  botPerms: [PermissionsBitField.Flags.ManageRoles],
  async execute(client, message, args) {
    if (!permissions.isModerator(message, client)) {
      return message
        .reply({
          embeds: [client.embedBuilder.error(client, message.t("commands.removerole.permission_denied"))],
        })
        .then((m) => setTimeout(() => m.delete().catch(() => {}), 5000))
        .catch(() => {});
    }

    const target =
      message.mentions.members.first() ||
      message.guild.members.cache.get(args[0]);
    if (!target)
      return message
        .reply({
          embeds: [
            client.embedBuilder.error(
              client,
              message.t("commands.removerole.target_not_found"),
            ),
          ],
        })
        .catch(() => {});

    const role =
      message.mentions.roles.first() || message.guild.roles.cache.get(args[1]);
    if (!role)
      return message
        .reply({
          embeds: [client.embedBuilder.error(client, message.t("commands.removerole.role_not_found"))],
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
            client.embedBuilder.error(client, message.t("commands.removerole.role_higher_than_you")),
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
              message.t("commands.removerole.role_higher_than_bot"),
            ),
          ],
        })
        .catch(() => {});
    }

    if (!target.roles.cache.has(role.id)) {
      return message
        .reply({
          embeds: [client.embedBuilder.warning(client, message.t("commands.removerole.role_not_assigned"))],
        })
        .catch(() => {});
    }

    try {
      await target.roles.remove(role, message.t("commands.removerole.audit_reason", { tag: message.author.tag }));
      const embed = client.embedBuilder
        .success(client, message.t("commands.removerole.role_removed"))
        .addFields(
          { name: message.t("commands.removerole.field_target"), value: `${target}`, inline: true },
          { name: message.t("commands.removerole.field_role"), value: `${role}`, inline: true },
          { name: message.t("commands.removerole.field_action"), value: message.t("commands.removerole.action_value"), inline: true },
          { name: message.t("commands.removerole.field_moderator"), value: `${message.author}`, inline: true },
        );
      await message.reply({ embeds: [embed] }).catch(() => {});
    } catch (err) {
      await message
        .reply({
          embeds: [client.embedBuilder.error(client, message.t("commands.removerole.not_manageable"))],
        })
        .catch(() => {});
    }
  },
};
