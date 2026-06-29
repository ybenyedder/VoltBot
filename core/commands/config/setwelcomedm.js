const { PermissionsBitField } = require("discord.js");
const permissions = require("../../utils/permissions");

const DEFAULT_MSG = "Bienvenue sur **{server}**.";

module.exports = {
  name: "setwelcomedm",
  description: "Définit le message de bienvenue envoyé en privé (MP).",
  category: "config",
  usage: "+setwelcomedm [on/off/message]",
  userPerms: [PermissionsBitField.Flags.Administrator],
  async execute(client, message, args) {
    if (!permissions.isAdmin(message)) {
      return message
        .reply({
          embeds: [
            client.embedBuilder.error(
              client,
              message.t("commands.setwelcomedm.perm_denied"),
            ),
          ],
        })
        .catch(() => {});
    }

    const gs = client.db.getGuild(message.guild.id) || {};
    const oldEnabled = Boolean(gs.welcomeDm);
    const oldStatus = oldEnabled
      ? message.t("commands.setwelcomedm.enabled")
      : message.t("commands.setwelcomedm.disabled");
    const oldMsg = gs.welcomeDmMessage || DEFAULT_MSG;

    if (!args[0]) {
      const embed = client.embedBuilder
        .info(client, message.t("commands.setwelcomedm.no_argument"))
        .setAuthor({
          name: message.t("commands.setwelcomedm.author"),
          iconURL: client.user.displayAvatarURL(),
        })
        .setDescription(null)
        .addFields(
          { name: message.t("commands.setwelcomedm.field_status"), value: oldStatus, inline: true },
          { name: message.t("commands.setwelcomedm.field_message"), value: `\`${oldMsg}\``, inline: true },
          {
            name: message.t("commands.setwelcomedm.field_variables"),
            value: "`{user}` `{server}` `{membercount}`",
            inline: false,
          },
          {
            name: message.t("commands.setwelcomedm.field_usage"),
            value:
              "`+setwelcomedm on`\n`+setwelcomedm off`\n`+setwelcomedm <message>`",
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
                message.t("commands.setwelcomedm.same_value"),
              ),
            ],
          })
          .catch(() => {});
      }
      client.db.updateGuild(message.guild.id, { welcomeDm: 0 });
      const embed = client.embedBuilder
        .success(client, null)
        .setAuthor({
          name: message.t("commands.setwelcomedm.author"),
          iconURL: client.user.displayAvatarURL(),
        })
        .setDescription(
          "```diff\n- " +
            message.t("commands.setwelcomedm.enabled") +
            "\n+ " +
            message.t("commands.setwelcomedm.disabled") +
            "\n```",
        );
      return message.reply({ embeds: [embed] }).catch(() => {});
    }

    if (option === "on") {
      if (oldEnabled) {
        return message
          .reply({
            embeds: [
              client.embedBuilder.warning(
                client,
                message.t("commands.setwelcomedm.same_value"),
              ),
            ],
          })
          .catch(() => {});
      }
      client.db.updateGuild(message.guild.id, { welcomeDm: 1 });
      const embed = client.embedBuilder
        .success(client, null)
        .setAuthor({
          name: message.t("commands.setwelcomedm.author"),
          iconURL: client.user.displayAvatarURL(),
        })
        .setDescription(
          "```diff\n- " +
            message.t("commands.setwelcomedm.disabled") +
            "\n+ " +
            message.t("commands.setwelcomedm.enabled") +
            "\n```",
        );
      return message.reply({ embeds: [embed] }).catch(() => {});
    }

    const welcomeMessage = args.join(" ");
    if (welcomeMessage === oldMsg && oldEnabled) {
      return message
        .reply({
          embeds: [
            client.embedBuilder.warning(
              client,
              message.t("commands.setwelcomedm.same_value"),
            ),
          ],
        })
        .catch(() => {});
    }

    client.db.updateGuild(message.guild.id, {
      welcomeDm: 1,
      welcomeDmMessage: welcomeMessage,
    });

    const embed = client.embedBuilder
      .success(client, null)
      .setAuthor({
        name: message.t("commands.setwelcomedm.author"),
        iconURL: client.user.displayAvatarURL(),
      })
      .setDescription(null)
      .addFields(
        { name: message.t("commands.setwelcomedm.field_before"), value: `\`${oldMsg}\``, inline: false },
        { name: message.t("commands.setwelcomedm.field_after"), value: `\`${welcomeMessage}\``, inline: false },
      );
    return message.reply({ embeds: [embed] }).catch(() => {});
  },
};
