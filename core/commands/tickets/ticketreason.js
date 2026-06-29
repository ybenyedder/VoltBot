const { PermissionsBitField } = require("discord.js");
const Logger = require("../../utils/logger");

const ON = ["on", "oui", "yes", "true", "1", "enable", "activer"];
const OFF = ["off", "non", "no", "false", "0", "disable", "desactiver", "désactiver"];

module.exports = {
  name: "ticketreason",
  aliases: ["ticketreasons"],
  description:
    "Active/désactive l'obligation d'indiquer une raison à l'ouverture d'un ticket.",
  category: "tickets",
  usage: "+ticketreason <on/off>",
  userPerms: [PermissionsBitField.Flags.Administrator],
  async execute(client, message, args) {
    const arg = args[0] ? args[0].toLowerCase() : null;
    const config = client.db.getTicketConfig(message.guild.id);

    if (!config) {
      return message
        .reply({
          embeds: [
            client.embedBuilder.error(
              client,
              message.t("commands.ticketreason.setup_first"),
            ),
          ],
        })
        .catch(() => {});
    }

    if (!arg || (!ON.includes(arg) && !OFF.includes(arg))) {
      const current = config.requireReason ? "on" : "off";
      const embed = client.embedBuilder
        .info(client, null)
        .setAuthor({
          name: message.t("commands.ticketreason.author_title"),
          iconURL: client.user.displayAvatarURL(),
        })
        .setDescription(null)
        .addFields(
          {
            name: message.t("commands.ticketreason.field_current_state"),
            value: `\`${current}\``,
            inline: true,
          },
          {
            name: message.t("commands.ticketreason.field_usage"),
            value: "`+ticketreason on`\n`+ticketreason off`",
            inline: true,
          },
        );
      return message.reply({ embeds: [embed] }).catch(() => {});
    }

    const enable = ON.includes(arg) ? 1 : 0;

    try {
      client.db.db
        .prepare("UPDATE tickets_config SET requireReason = ? WHERE guildId = ?")
        .run(enable, message.guild.id);
    } catch (e) {
      Logger.error("[TICKETREASON] Erreur:", e);
      return message
        .reply({
          embeds: [
            client.embedBuilder.error(
              client,
              message.t("commands.ticketreason.db_error"),
            ),
          ],
        })
        .catch(() => {});
    }

    const msg = enable
      ? message.t("commands.ticketreason.enabled")
      : message.t("commands.ticketreason.disabled");
    return message
      .reply({ embeds: [client.embedBuilder.success(client, msg)] })
      .catch(() => {});
  },
};
