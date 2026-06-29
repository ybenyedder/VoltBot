const { PermissionsBitField } = require("discord.js");
const permissions = require("../../utils/permissions");

module.exports = {
  name: "setautorole",
  description: "Définit un rôle donné automatiquement à chaque nouveau membre.",
  category: "config",
  usage: "+setautorole [@Role]",
  userPerms: [PermissionsBitField.Flags.Administrator],
  async execute(client, message, args) {
    if (
      !message.member.permissions.has("Administrator") &&
      !permissions.isPrimaryOwner(message.author.id)
    ) {
      return message
        .reply({
          embeds: [
            client.embedBuilder.error(
              client,
              message.t("commands.setautorole.perm_denied"),
            ),
          ],
        })
        .catch(() => {});
    }

    const gs = client.db.getGuild(message.guild.id) || {};
    const oldRoleId = gs.autoRole || null;
    const oldDisplay = oldRoleId ? `<@&${oldRoleId}>` : message.t("commands.setautorole.none");

    if (!args[0]) {
      const embed = client.embedBuilder
        .info(client, message.t("commands.setautorole.no_arg"))
        .setAuthor({
          name: message.t("commands.setautorole.title"),
          iconURL: client.user.displayAvatarURL(),
        })
        .setDescription(null)
        .addFields(
          { name: message.t("commands.setautorole.current"), value: oldDisplay, inline: true },
          {
            name: message.t("commands.setautorole.usage"),
            value: "`+setautorole @Role`\n`+setautorole off`",
            inline: true,
          },
        );
      return message.reply({ embeds: [embed] }).catch(() => {});
    }

    if (args[0].toLowerCase() === "off") {
      if (!oldRoleId) {
        return message
          .reply({
            embeds: [
              client.embedBuilder.warning(
                client,
                message.t("commands.setautorole.same_value"),
              ),
            ],
          })
          .catch(() => {});
      }
      client.db.updateGuild(message.guild.id, { autoRole: null });
      const embed = client.embedBuilder
        .success(client, null)
        .setAuthor({
          name: message.t("commands.setautorole.title"),
          iconURL: client.user.displayAvatarURL(),
        })
        .setDescription(
          "```diff\n- " +
            (oldRoleId ? `@&${oldRoleId}` : message.t("commands.setautorole.none")) +
            "\n+ " + message.t("commands.setautorole.none") + "\n```",
        );
      return message.reply({ embeds: [embed] }).catch(() => {});
    }

    const role =
      message.mentions.roles.first() || message.guild.roles.cache.get(args[0]);
    if (!role) {
      return message
        .reply({
          embeds: [
            client.embedBuilder.error(
              client,
              message.t("commands.setautorole.invalid_role"),
            ),
          ],
        })
        .catch(() => {});
    }

    if (oldRoleId === role.id) {
      return message
        .reply({
          embeds: [
            client.embedBuilder.warning(
              client,
              message.t("commands.setautorole.same_value"),
            ),
          ],
        })
        .catch(() => {});
    }

    client.db.updateGuild(message.guild.id, { autoRole: role.id });
    const embed = client.embedBuilder
      .success(client, null)
      .setAuthor({
        name: message.t("commands.setautorole.title"),
        iconURL: client.user.displayAvatarURL(),
      })
      .setDescription(null)
      .addFields(
        { name: message.t("commands.setautorole.before"), value: oldDisplay, inline: true },
        { name: message.t("commands.setautorole.after"), value: `<@&${role.id}>`, inline: true },
      );
    return message.reply({ embeds: [embed] }).catch(() => {});
  },
};
