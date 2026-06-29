const { PermissionFlagsBits } = require("discord.js");
const { t } = require("../../utils/i18n");

module.exports = {
  name: "setlang",
  aliases: ["language", "langue"],
  description:
    "Change la langue du bot pour le serveur / Change the bot language for the server",
  category: "config",
  usage: "+setlang [fr/en]",
  userPerms: [PermissionFlagsBits.Administrator],
  botPerms: [],
  async execute(client, message, args) {
    const langInput = args[0] ? args[0].toLowerCase() : null;
    const currentLang =
      client.db.getGuild(message.guild.id, "language") || "fr";

    if (!langInput) {
      const embed = client.embedBuilder
        .info(client, message.t("commands.setlanguage.no_argument"))
        .setAuthor({
          name: message.t("commands.setlanguage.author_lang"),
          iconURL: client.user.displayAvatarURL(),
        })
        .setDescription(null)
        .addFields(
          {
            name: message.t("commands.setlanguage.field_current"),
            value: `\`${currentLang}\``,
            inline: true,
          },
          {
            name: message.t("commands.setlanguage.field_usage"),
            value: "`+setlang fr`\n`+setlang en`",
            inline: true,
          },
        );
      return message.reply({ embeds: [embed] }).catch(() => {});
    }

    if (!["fr", "en"].includes(langInput)) {
      return message
        .reply({
          embeds: [
            client.embedBuilder.error(
              client,
              message.t("commands.setlanguage.invalid_lang"),
            ),
          ],
        })
        .catch(() => {});
    }

    if (currentLang === langInput) {
      return message
        .reply({
          embeds: [
            client.embedBuilder.warning(
              client,
              message.t("commands.setlanguage.same_value"),
            ),
          ],
        })
        .catch(() => {});
    }

    client.db.updateGuild(message.guild.id, { language: langInput });

    const embed = client.embedBuilder
      .success(client, null)
      .setAuthor({
        name: message.t("commands.setlanguage.author_lang"),
        iconURL: client.user.displayAvatarURL(),
      })
      .setDescription(
        "```diff\n- " + currentLang + "\n+ " + langInput + "\n```",
      )
      .addFields({
        name: message.t("commands.setlanguage.field_note"),
        value: t(langInput, "commands.setlang.success"),
        inline: false,
      });
    return message.reply({ embeds: [embed] }).catch(() => {});
  },
};
