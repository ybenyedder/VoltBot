const { PermissionFlagsBits } = require("discord.js");

module.exports = {
  name: "creationlimit",
  description: "Définit une limite de création de contenu",
  category: "antiraid",
  usage: "creationlimit",
  userPerms: [PermissionFlagsBits.Administrator],
  async execute(client, message, args) {
    const defaults = { channels: 3, roles: 3, emojis: 5, time: 10000 };
    const limits =
      client.db.getGuild(message.guild.id, "creationlimit") || defaults;
    const p = client.config.prefix;

    if (!args[0]) {
      const embed = client.embedBuilder
        .base(client, message.t("commands.creationlimit.embed_title"))
        .setDescription(null)
        .addFields(
          {
            name: message.t("commands.creationlimit.field_channels"),
            value: `\`${limits.channels}\` / \`${limits.time / 1000}s\``,
            inline: true,
          },
          {
            name: message.t("commands.creationlimit.field_roles"),
            value: `\`${limits.roles}\` / \`${limits.time / 1000}s\``,
            inline: true,
          },
          {
            name: message.t("commands.creationlimit.field_emojis"),
            value: `\`${limits.emojis}\` / \`${limits.time / 1000}s\``,
            inline: true,
          },
          {
            name: message.t("commands.creationlimit.field_description"),
            value: message.t("commands.creationlimit.description_value"),
            inline: false,
          },
          {
            name: message.t("commands.creationlimit.field_commands"),
            value: `\`${p}creationlimit channels <n>\` \`${p}creationlimit roles <n>\` \`${p}creationlimit emojis <n>\` \`${p}creationlimit time <s>\``,
            inline: false,
          },
        );
      return message.reply({ embeds: [embed] }).catch(() => {});
    }

    const type = args[0].toLowerCase();
    const value = parseInt(args[1]);

    if (!value || value < 1) {
      return message
        .reply({
          embeds: [
            client.embedBuilder.error(
              client,
              message.t("commands.creationlimit.invalid_value"),
            ),
          ],
        })
        .catch(() => {});
    }

    if (["channels", "roles", "emojis"].includes(type)) {
      limits[type] = value;
      client.db.updateGuild(message.guild.id, { creationlimit: limits });
      return message
        .reply({
          embeds: [
            client.embedBuilder.success(
              client,
              message.t("commands.creationlimit.limit_set", {
                type,
                value,
                time: limits.time / 1000,
              }),
            ),
          ],
        })
        .catch(() => {});
    }

    if (type === "time") {
      limits.time = value * 1000;
      client.db.updateGuild(message.guild.id, { creationlimit: limits });
      return message
        .reply({
          embeds: [
            client.embedBuilder.success(
              client,
              message.t("commands.creationlimit.window_set", { value }),
            ),
          ],
        })
        .catch(() => {});
    }

    message
      .reply({
        embeds: [
          client.embedBuilder.error(
            client,
            message.t("commands.creationlimit.unknown_type"),
          ),
        ],
      })
      .catch(() => {});
  },
};
