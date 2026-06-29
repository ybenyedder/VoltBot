const { PermissionFlagsBits } = require("discord.js");

const fmtNum = (n) => new Intl.NumberFormat("fr-FR").format(n);

module.exports = {
  name: "sanctions",
  description: "Gère les sanctions du serveur.",
  category: "moderation",
  usage: "+sanctions [clear @membre / clearall]",
  userPerms: [PermissionFlagsBits.ManageMessages],
  async execute(client, message, args) {
    if (args[0] === "clearall") {
      if (!message.member.permissions.has(PermissionFlagsBits.Administrator))
        return message
          .reply({
            embeds: [
              client.embedBuilder.error(
                client,
                message.t("commands.sanctions.perm_denied"),
              ),
            ],
          })
          .catch(() => {});

      client.db.db
        .prepare("DELETE FROM warnings WHERE guildId = ?")
        .run(message.guild.id);
      return message
        .reply({
          embeds: [
            client.embedBuilder.success(
              client,
              message.t("commands.sanctions.all_cleared"),
            ),
          ],
        })
        .catch(() => {});
    }

    // Sous-commande clear <membre>
    if (args[0] === "clear" && args[1]) {
      const target =
        message.mentions.users.first() || client.users.cache.get(args[1]);
      if (!target)
        return message
          .reply({
            embeds: [
              client.embedBuilder.error(
                client,
                message.t("commands.sanctions.target_not_found"),
              ),
            ],
          })
          .catch(() => {});

      client.db.clearWarnings(target.id, message.guild.id);
      return message
        .reply({
          embeds: [
            client.embedBuilder
              .success(client, "​")
              .setDescription(null)
              .setAuthor({ name: message.t("commands.sanctions.warns_cleared_title") })
              .addFields(
                { name: message.t("commands.sanctions.field_target"), value: `<@${target.id}>`, inline: true },
                {
                  name: message.t("commands.sanctions.field_moderator"),
                  value: `<@${message.author.id}>`,
                  inline: true,
                },
              ),
          ],
        })
        .catch(() => {});
    }

    const user =
      message.mentions.users.first() ||
      client.users.cache.get(args[0]) ||
      message.author;

    const warnings = client.db.getWarns(user.id, message.guild.id);
    const totalInfractions = warnings.length;

    const sanctionLevels = [
      { level: 1, count: 1, sanction: message.t("commands.sanctions.level_warn") },
      { level: 2, count: 3, sanction: message.t("commands.sanctions.level_mute_1h") },
      { level: 3, count: 5, sanction: message.t("commands.sanctions.level_mute_24h") },
      { level: 4, count: 7, sanction: message.t("commands.sanctions.level_kick") },
      { level: 5, count: 10, sanction: message.t("commands.sanctions.level_ban_7d") },
      { level: 6, count: 15, sanction: message.t("commands.sanctions.level_ban_perm") },
    ];

    const currentLevel = sanctionLevels
      .filter((level) => totalInfractions >= level.count)
      .pop() || { level: 0, sanction: message.t("commands.sanctions.level_none") };
    const nextLevel = sanctionLevels.find(
      (level) => totalInfractions < level.count,
    );

    const embed = client.embedBuilder
      .base(client, message.t("commands.sanctions.embed_title", { tag: user.tag }), null)
      .setThumbnail(
        user.displayAvatarURL ? user.displayAvatarURL({ size: 256 }) : null,
      )
      .addFields(
        { name: message.t("commands.sanctions.field_target"), value: `<@${user.id}>`, inline: true },
        { name: message.t("commands.sanctions.field_total"), value: fmtNum(totalInfractions), inline: true },
        {
          name: message.t("commands.sanctions.field_level"),
          value: `**${currentLevel.level}** — ${currentLevel.sanction}`,
          inline: true,
        },
        {
          name: message.t("commands.sanctions.field_next"),
          value: nextLevel
            ? message.t("commands.sanctions.next_value", { level: nextLevel.level, count: fmtNum(nextLevel.count) })
            : message.t("commands.sanctions.max_reached"),
          inline: true,
        },
      );

    const recentWarns = warnings.slice(-5).reverse();
    if (recentWarns.length) {
      recentWarns.forEach((w) => {
        const ts = Math.floor(new Date(w.timestamp).getTime() / 1000);
        embed.addFields({
          name: `#${w.id}`,
          value: `<t:${ts}:R>\n${w.reason}`,
          inline: false,
        });
      });
    }

    embed.addFields({
      name: message.t("commands.sanctions.field_scale"),
      value: sanctionLevels
        .map(
          (l) => message.t("commands.sanctions.scale_line", { level: l.level, count: fmtNum(l.count), sanction: l.sanction }),
        )
        .join("\n"),
      inline: false,
    });

    await message.reply({ embeds: [embed] }).catch(() => {});
  },
};
