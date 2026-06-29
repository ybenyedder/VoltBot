const { PermissionFlagsBits } = require("discord.js");

module.exports = {
  name: "limite",
  description: "Définit des limites pour les actions de modération",
  category: "moderation",
  usage: "limite",
  userPerms: [PermissionFlagsBits.Administrator],
  async execute(client, message, args) {
    const defaults = { maxWarns: 3, maxMutes: 5, maxKicks: 3, maxBans: 2 };

    if (!args[0]) {
      const limits = client.db.getGuild(message.guild.id, "limits") || defaults;
      const embed = client.embedBuilder
        .base(
          client,
          message.t("commands.limite.title"),
          message.t("commands.limite.description_body"),
        )
        .addFields(
          {
            name: message.t("commands.limite.field_max_warns"),
            value: `${limits.maxWarns}`,
            inline: true,
          },
          { name: message.t("commands.limite.field_max_mutes"), value: `${limits.maxMutes}`, inline: true },
          { name: message.t("commands.limite.field_max_kicks"), value: `${limits.maxKicks}`, inline: true },
          { name: message.t("commands.limite.field_max_bans"), value: `${limits.maxBans}`, inline: true },
          {
            name: message.t("commands.limite.field_usage"),
            value: message.t("commands.limite.usage_value"),
            inline: false,
          },
        );
      return message.reply({ embeds: [embed] }).catch(() => {});
    }

    const type = args[0].toLowerCase();
    const value = parseInt(args[1]);

    if (!value || value < 1 || value > 100) {
      return message
        .reply({
          embeds: [
            client.embedBuilder.error(
              client,
              message.t("commands.limite.invalid_value"),
            ),
          ],
        })
        .catch(() => {});
    }

    const limits = client.db.getGuild(message.guild.id, "limits") || defaults;

    switch (type) {
      case "warns":
        limits.maxWarns = value;
        break;
      case "mutes":
        limits.maxMutes = value;
        break;
      case "kicks":
        limits.maxKicks = value;
        break;
      case "bans":
        limits.maxBans = value;
        break;
      default:
        return message
          .reply({
            embeds: [
              client.embedBuilder.error(
                client,
                message.t("commands.limite.invalid_type"),
              ),
            ],
          })
          .catch(() => {});
    }

    client.db.updateGuild(message.guild.id, { limits: limits });

    await message
      .reply({
        embeds: [
          client.embedBuilder.success(
            client,
            message.t("commands.limite.set_success", { type, value }),
          ),
        ],
      })
      .catch(() => {});
  },
};
