const { ActivityType } = require("discord.js");

module.exports = {
  name: "botactivity",
  description: "Change l'activité du bot (playing, watching, listening).",
  category: "admin",
  usage: "+botactivity <playing|watching|listening> <texte...>",
  ownerOnly: true,
  async execute(client, message, args) {
    const typeStr = args.shift()?.toLowerCase();
    const text = args.join(" ");

    const types = {
      playing: { enum: ActivityType.Playing, label: "Playing" },
      watching: { enum: ActivityType.Watching, label: "Watching" },
      listening: { enum: ActivityType.Listening, label: "Listening" },
      competing: { enum: ActivityType.Competing, label: "Competing" },
      custom: { enum: ActivityType.Custom, label: "Custom" },
    };

    if (!types[typeStr] || !text) {
      return message
        .reply({
          embeds: [
            client.embedBuilder.error(
              client,
              message.t("commands.botactivity.invalid_args"),
            ),
          ],
        })
        .catch(() => {});
    }

    client.user.setActivity(text, { type: types[typeStr].enum });
    // Persistance du texte ET du type pour que le rafraîchissement 10 min
    // de clientReady et le dashboard restituent la même activité après reboot.
    try {
      client.db.updateBotSettings({
        customStatus: text,
        activityType: types[typeStr].label,
      });
    } catch (e) {
      client.logger?.error?.("[BOTACTIVITY PERSIST ERROR]", e);
    }

    const embed = client.embedBuilder
      .success(client, message.t("commands.botactivity.updated"))
      .addFields(
        { name: message.t("commands.botactivity.field_action"), value: "`activity`", inline: true },
        { name: message.t("commands.botactivity.field_value"), value: `**${typeStr}** ${text}`, inline: true },
        { name: message.t("commands.botactivity.field_moderator"), value: `<@${message.author.id}>`, inline: true },
      );

    message.reply({ embeds: [embed] }).catch(() => {});
  },
};
