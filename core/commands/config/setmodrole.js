const { PermissionsBitField } = require("discord.js");
const permissions = require("../../utils/permissions");

module.exports = {
  name: "setmodrole",
  description: "Définit le rôle Modération global du bot.",
  category: "config",
  usage: "+setmodrole [@role|off]",
  userPerms: [PermissionsBitField.Flags.Administrator],
  async execute(client, message, args) {
    if (!permissions.isAdmin(message)) {
      return message
        .reply({
          embeds: [
            client.embedBuilder.error(
              client,
              message.t("commands.setmodrole.perm_denied"),
            ),
          ],
        })
        .catch(() => {});
    }

    const gs = client.db.getGuild(message.guild.id) || {};
    const oldId = gs.modRole || null;
    const oldDisplay = oldId
      ? `<@&${oldId}>`
      : message.t("commands.setmodrole.none");

    if (!args[0]) {
      const embed = client.embedBuilder
        .info(client, message.t("commands.setmodrole.no_argument"))
        .setAuthor({
          name: message.t("commands.setmodrole.author"),
          iconURL: client.user.displayAvatarURL(),
        })
        .setDescription(null)
        .addFields(
          {
            name: message.t("commands.setmodrole.field_current"),
            value: oldDisplay,
            inline: true,
          },
          {
            name: message.t("commands.setmodrole.field_usage"),
            value: "`+setmodrole @Role`\n`+setmodrole off`",
            inline: true,
          },
        );
      return message.reply({ embeds: [embed] }).catch(() => {});
    }

    if (args[0].toLowerCase() === "off") {
      if (!oldId) {
        return message
          .reply({
            embeds: [
              client.embedBuilder.warning(
                client,
                message.t("commands.setmodrole.same_value"),
              ),
            ],
          })
          .catch(() => {});
      }
      client.db.updateGuild(message.guild.id, { modRole: null });
      const embed = client.embedBuilder
        .success(client, null)
        .setAuthor({
          name: message.t("commands.setmodrole.author"),
          iconURL: client.user.displayAvatarURL(),
        })
        .setDescription("```diff\n- @&" + oldId + "\n+ Aucun\n```");
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
              message.t("commands.setmodrole.invalid_role"),
            ),
          ],
        })
        .catch(() => {});
    }

    if (oldId === role.id) {
      return message
        .reply({
          embeds: [
            client.embedBuilder.warning(
              client,
              message.t("commands.setmodrole.same_value"),
            ),
          ],
        })
        .catch(() => {});
    }

    client.db.updateGuild(message.guild.id, { modRole: role.id });
    const embed = client.embedBuilder
      .success(client, null)
      .setAuthor({
        name: message.t("commands.setmodrole.author"),
        iconURL: client.user.displayAvatarURL(),
      })
      .setDescription(null)
      .addFields(
        {
          name: message.t("commands.setmodrole.field_before"),
          value: oldDisplay,
          inline: true,
        },
        {
          name: message.t("commands.setmodrole.field_after"),
          value: `<@&${role.id}>`,
          inline: true,
        },
      );
    return message.reply({ embeds: [embed] }).catch(() => {});
  },
};
