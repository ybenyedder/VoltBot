const { ActivityType, PresenceUpdateStatus } = require("discord.js");

module.exports = {
  name: "botstatus",
  aliases: ["setstatus"],
  description:
    "Gère le statut (online, dnd...) et l'activité personnalisée de façon indépendante.",
  category: "admin",
  usage: "+botstatus <online|idle|dnd|invisible> OU +botstatus custom <Texte>",
  ownerOnly: true,
  async execute(client, message, args) {
    const sub = args[0]?.toLowerCase();
    const settings = client.db.getBotSettings();

    if (!sub) {
      const embed = client.embedBuilder
        .info(client, message.t("commands.botstatus.current_state"))
        .addFields(
          {
            name: message.t("commands.botstatus.field_status"),
            value: `\`${settings.presenceStatus}\``,
            inline: true,
          },
          {
            name: message.t("commands.botstatus.field_activity"),
            value: `\`${settings.customStatus || message.t("commands.botstatus.none")}\``,
            inline: true,
          },
          {
            name: message.t("commands.botstatus.field_usage"),
            value:
              "`+botstatus <online|idle|dnd|invisible>`\n`+botstatus custom <texte>`",
            inline: false,
          },
        );
      return message.reply({ embeds: [embed] }).catch(() => {});
    }

    // 1. Changement du STATUT de présence
    if (["online", "idle", "dnd", "invisible"].includes(sub)) {
      client.db.updateBotSettings({ presenceStatus: sub });

      client.user.setPresence({
        status: sub === "invisible" ? PresenceUpdateStatus.Invisible : sub,
        activities: settings.customStatus
          ? [{ name: settings.customStatus, type: ActivityType.Custom }]
          : [],
      });

      const embed = client.embedBuilder
        .success(client, message.t("commands.botstatus.status_updated"))
        .addFields(
          { name: message.t("commands.botstatus.field_action"), value: "`presence`", inline: true },
          { name: message.t("commands.botstatus.field_value"), value: `**${sub}**`, inline: true },
          {
            name: message.t("commands.botstatus.field_moderator"),
            value: `<@${message.author.id}>`,
            inline: true,
          },
        );

      return message.reply({ embeds: [embed] }).catch(() => {});
    }

    // 2. Changement de l'ACTIVITÉ (custom)
    if (sub === "custom") {
      const customText = args.slice(1).join(" ");

      client.db.updateBotSettings({ customStatus: customText || "" });

      client.user.setPresence({
        status:
          settings.presenceStatus === "invisible"
            ? PresenceUpdateStatus.Invisible
            : settings.presenceStatus,
        activities: customText
          ? [{ name: customText, type: ActivityType.Custom }]
          : [],
      });

      const embed = client.embedBuilder
        .success(
          client,
          customText ? message.t("commands.botstatus.activity_updated") : message.t("commands.botstatus.activity_reset"),
        )
        .addFields(
          { name: message.t("commands.botstatus.field_action"), value: "`custom`", inline: true },
          {
            name: message.t("commands.botstatus.field_value"),
            value: customText ? `**${customText}**` : message.t("commands.botstatus.none_code"),
            inline: true,
          },
          {
            name: message.t("commands.botstatus.field_moderator"),
            value: `<@${message.author.id}>`,
            inline: true,
          },
        );
      return message.reply({ embeds: [embed] }).catch(() => {});
    }

    return message
      .reply({
        embeds: [
          client.embedBuilder.error(
            client,
            message.t("commands.botstatus.invalid_sub"),
          ),
        ],
      })
      .catch(() => {});
  },
};
