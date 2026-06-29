const {
  PermissionsBitField,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require("discord.js");

module.exports = {
  name: "setstatstext",
  aliases: ["setstatsformat", "statstext"],
  description:
    "Définit le format du texte avant les statistiques des salons vocaux.",
  category: "config",
  usage: "+setstatstext <type> <format>",
  userPerms: [PermissionsBitField.Flags.Administrator],
  async execute(client, message, args) {
    const subcommands = [
      "members",
      "online",
      "vocal",
      "top",
      "invite",
      "reset",
    ];
    const type = args[0]?.toLowerCase();

    if (!type || !subcommands.includes(type)) {
      const embed = client.embedBuilder
        .info(client, message.t("commands.setstatstext.no_argument"))
        .setAuthor({
          name: message.t("commands.setstatstext.author"),
          iconURL: client.user.displayAvatarURL(),
        })
        .setDescription(null)
        .addFields(
          {
            name: message.t("commands.setstatstext.field_types"),
            value: "`members` `online` `vocal` `top` `invite` `reset`",
            inline: false,
          },
          {
            name: message.t("commands.setstatstext.field_variables"),
            value: "`{emoji}` `{name}`",
            inline: false,
          },
          {
            name: message.t("commands.setstatstext.field_usage"),
            value: "`+setstatstext <type> <format>`",
            inline: false,
          },
        );
      return message.reply({ embeds: [embed] }).catch(() => {});
    }

    const gs = client.db.getGuild(message.guild.id) || {};

    if (type === "reset") {
      const anySet =
        gs.statsFormat ||
        gs.statsMembersFormat ||
        gs.statsOnlineFormat ||
        gs.statsVocalFormat ||
        gs.statsTopFormat ||
        gs.statsInviteFormat;
      if (!anySet) {
        return message
          .reply({
            embeds: [
              client.embedBuilder.warning(
                client,
                message.t("commands.setstatstext.same_value"),
              ),
            ],
          })
          .catch(() => {});
      }
      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`statstext_reset_confirm_${message.id}`)
          .setLabel(message.t("commands.setstatstext.btn_confirm"))
          .setStyle(ButtonStyle.Danger),
        new ButtonBuilder()
          .setCustomId(`statstext_reset_cancel_${message.id}`)
          .setLabel(message.t("commands.setstatstext.btn_cancel"))
          .setStyle(ButtonStyle.Secondary),
      );
      const prompt = await message
        .reply({
          embeds: [
            client.embedBuilder
              .warning(client, null)
              .setAuthor({
                name: message.t("commands.setstatstext.author"),
                iconURL: client.user.displayAvatarURL(),
              })
              .setDescription(message.t("commands.setstatstext.reset_confirm_desc")),
          ],
          components: [row],
        })
        .catch(() => null);
      if (!prompt) return;

      const collector = prompt.createMessageComponentCollector({
        filter: (i) => i.user.id === message.author.id,
        time: 120000,
        max: 1,
      });

      collector.on("collect", async (i) => {
        const disabled = new ActionRowBuilder().addComponents(
          ...row.components.map((b) => ButtonBuilder.from(b).setDisabled(true)),
        );
        if (i.customId.startsWith("statstext_reset_confirm_")) {
          client.db.updateGuild(message.guild.id, {
            statsFormat: null,
            statsMembersFormat: null,
            statsOnlineFormat: null,
            statsVocalFormat: null,
            statsTopFormat: null,
            statsInviteFormat: null,
          });
          const embed = client.embedBuilder
            .success(client, null)
            .setAuthor({
              name: message.t("commands.setstatstext.author"),
              iconURL: client.user.displayAvatarURL(),
            })
            .setDescription(
              "```diff\n- " +
                message.t("commands.setstatstext.diff_custom_formats") +
                "\n+ " +
                message.t("commands.setstatstext.diff_default") +
                "\n```",
            );
          await i
            .update({ embeds: [embed], components: [disabled] })
            .catch(() => {});
        } else {
          await i
            .update({
              embeds: [client.embedBuilder.info(client, message.t("commands.setstatstext.action_cancelled"))],
              components: [disabled],
            })
            .catch(() => {});
        }
      });

      collector.on("end", async (_, reason) => {
        if (reason === "time") {
          const disabled = new ActionRowBuilder().addComponents(
            ...row.components.map((b) =>
              ButtonBuilder.from(b).setDisabled(true),
            ),
          );
          await prompt.edit({ components: [disabled] }).catch(() => {});
        }
      });
      return;
    }

    const format = args.slice(1).join(" ");
    if (!format)
      return message
        .reply({
          embeds: [
            client.embedBuilder.error(
              client,
              message.t("commands.setstatstext.format_missing", { type }),
            ),
          ],
        })
        .catch(() => {});

    const dbKey = `stats${type.charAt(0).toUpperCase() + type.slice(1)}Format`;
    const oldFormat = gs[dbKey] || message.t("commands.setstatstext.value_default");

    if (oldFormat === format) {
      return message
        .reply({
          embeds: [
            client.embedBuilder.warning(
              client,
              message.t("commands.setstatstext.same_value"),
            ),
          ],
        })
        .catch(() => {});
    }

    client.db.updateGuild(message.guild.id, { [dbKey]: format });

    const preview = `${format.replace("{emoji}", "").replace("{name}", type)} 100`;
    const embed = client.embedBuilder
      .success(client, null)
      .setAuthor({
        name: message.t("commands.setstatstext.author_stats_type", { type }),
        iconURL: client.user.displayAvatarURL(),
      })
      .setDescription(null)
      .addFields(
        { name: message.t("commands.setstatstext.field_before"), value: `\`${oldFormat}\``, inline: false },
        { name: message.t("commands.setstatstext.field_after"), value: `\`${format}\``, inline: false },
        { name: message.t("commands.setstatstext.field_preview"), value: `\`${preview}\``, inline: false },
      );
    return message.reply({ embeds: [embed] }).catch(() => {});
  },
};
