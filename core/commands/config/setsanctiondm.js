const { PermissionsBitField } = require("discord.js");
const permissions = require("../../utils/permissions");

module.exports = {
  name: "setsanctiondm",
  description: "Définit le message de sanction envoyé en privé (MP).",
  category: "config",
  usage: "+setsanctiondm [on/off/message]",
  userPerms: [PermissionsBitField.Flags.Administrator],
  async execute(client, message, args) {
    if (!permissions.isAdmin(message)) {
      return message
        .reply({
          embeds: [
            client.embedBuilder.error(
              client,
              message.t("commands.setsanctiondm.perm_denied"),
            ),
          ],
        })
        .catch(() => {});
    }

    const gs = client.db.getGuild(message.guild.id) || {};
    const oldEnabled = Boolean(gs.sanctionDm);
    const oldStatus = oldEnabled
      ? message.t("commands.setsanctiondm.status_enabled")
      : message.t("commands.setsanctiondm.status_disabled");
    const oldMsg =
      gs.sanctionDmMessage || message.t("commands.setsanctiondm.default_msg");

    if (!args[0]) {
      const embed = client.embedBuilder
        .info(client, message.t("commands.setsanctiondm.no_argument"))
        .setAuthor({
          name: message.t("commands.setsanctiondm.author"),
          iconURL: client.user.displayAvatarURL(),
        })
        .setDescription(null)
        .addFields(
          {
            name: message.t("commands.setsanctiondm.field_status"),
            value: oldStatus,
            inline: true,
          },
          {
            name: message.t("commands.setsanctiondm.field_message"),
            value: `\`${oldMsg}\``,
            inline: true,
          },
          {
            name: message.t("commands.setsanctiondm.field_variables"),
            value: "`{action}` `{server}` `{reason}`",
            inline: false,
          },
          {
            name: message.t("commands.setsanctiondm.field_usage"),
            value:
              "`+setsanctiondm on`\n`+setsanctiondm off`\n`+setsanctiondm <message>`",
            inline: false,
          },
        );
      return message.reply({ embeds: [embed] }).catch(() => {});
    }

    const option = args[0].toLowerCase();

    if (option === "off") {
      if (!oldEnabled) {
        return message
          .reply({
            embeds: [
              client.embedBuilder.warning(
                client,
                message.t("commands.setsanctiondm.same_value"),
              ),
            ],
          })
          .catch(() => {});
      }
      client.db.updateGuild(message.guild.id, { sanctionDm: 0 });
      const embed = client.embedBuilder
        .success(client, null)
        .setAuthor({
          name: message.t("commands.setsanctiondm.author"),
          iconURL: client.user.displayAvatarURL(),
        })
        .setDescription("```diff\n- " + message.t("commands.setsanctiondm.status_enabled") + "\n+ " + message.t("commands.setsanctiondm.status_disabled") + "\n```");
      return message.reply({ embeds: [embed] }).catch(() => {});
    }

    if (option === "on") {
      if (oldEnabled) {
        return message
          .reply({
            embeds: [
              client.embedBuilder.warning(
                client,
                message.t("commands.setsanctiondm.same_value"),
              ),
            ],
          })
          .catch(() => {});
      }
      client.db.updateGuild(message.guild.id, { sanctionDm: 1 });
      const embed = client.embedBuilder
        .success(client, null)
        .setAuthor({
          name: message.t("commands.setsanctiondm.author"),
          iconURL: client.user.displayAvatarURL(),
        })
        .setDescription("```diff\n- " + message.t("commands.setsanctiondm.status_disabled") + "\n+ " + message.t("commands.setsanctiondm.status_enabled") + "\n```");
      return message.reply({ embeds: [embed] }).catch(() => {});
    }

    const sanctionMessage = args.join(" ");
    if (sanctionMessage === oldMsg && oldEnabled) {
      return message
        .reply({
          embeds: [
            client.embedBuilder.warning(
              client,
              message.t("commands.setsanctiondm.same_value"),
            ),
          ],
        })
        .catch(() => {});
    }

    client.db.updateGuild(message.guild.id, {
      sanctionDm: 1,
      sanctionDmMessage: sanctionMessage,
    });

    const embed = client.embedBuilder
      .success(client, null)
      .setAuthor({
        name: message.t("commands.setsanctiondm.author"),
        iconURL: client.user.displayAvatarURL(),
      })
      .setDescription(null)
      .addFields(
        {
          name: message.t("commands.setsanctiondm.field_before"),
          value: `\`${oldMsg}\``,
          inline: false,
        },
        {
          name: message.t("commands.setsanctiondm.field_after"),
          value: `\`${sanctionMessage}\``,
          inline: false,
        },
      );
    return message.reply({ embeds: [embed] }).catch(() => {});
  },
};
