const { PermissionsBitField } = require("discord.js");
const permissions = require("../../utils/permissions");

module.exports = {
  name: "setprefix",
  description: "Modifie le préfixe du bot pour ce serveur.",
  category: "config",
  usage: "+setprefix [nouveau préfixe]",
  userPerms: [PermissionsBitField.Flags.Administrator],
  async execute(client, message, args) {
    if (!permissions.isAdmin(message)) {
      return message
        .reply({
          embeds: [
            client.embedBuilder.error(
              client,
              message.t("commands.setprefix.perm_denied"),
            ),
          ],
        })
        .catch(() => {});
    }

    const gs = client.db.getGuild(message.guild.id) || {};
    const oldPrefix = gs.prefix || client.config.prefix;
    const newPrefix = args[0];

    if (!newPrefix) {
      const embed = client.embedBuilder
        .info(client, message.t("commands.setprefix.no_argument"))
        .setAuthor({
          name: message.t("commands.setprefix.author"),
          iconURL: client.user.displayAvatarURL(),
        })
        .setDescription(null)
        .addFields(
          {
            name: message.t("commands.setprefix.field_current"),
            value: `\`${oldPrefix}\``,
            inline: true,
          },
          {
            name: message.t("commands.setprefix.field_usage"),
            value: message.t("commands.setprefix.usage_value"),
            inline: true,
          },
        );
      return message.reply({ embeds: [embed] }).catch(() => {});
    }

    if (newPrefix.length > 5) {
      return message
        .reply({
          embeds: [
            client.embedBuilder.error(
              client,
              message.t("commands.setprefix.too_long"),
            ),
          ],
        })
        .catch(() => {});
    }

    if (oldPrefix === newPrefix) {
      return message
        .reply({
          embeds: [
            client.embedBuilder.warning(
              client,
              message.t("commands.setprefix.same_value"),
            ),
          ],
        })
        .catch(() => {});
    }

    client.db.updateGuild(message.guild.id, { prefix: newPrefix });
    const embed = client.embedBuilder
      .success(client, null)
      .setAuthor({
        name: message.t("commands.setprefix.author"),
        iconURL: client.user.displayAvatarURL(),
      })
      .setDescription("```diff\n- " + oldPrefix + "\n+ " + newPrefix + "\n```");
    return message.reply({ embeds: [embed] }).catch(() => {});
  },
};
