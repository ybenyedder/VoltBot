const { PermissionsBitField } = require("discord.js");
const logger = require("../../utils/logger");
const sanctionUtils = require("../../utils/sanctionUtils");

const fmtNum = (n) => new Intl.NumberFormat("fr-FR").format(n);

module.exports = {
  name: "unbanall",
  description: "Débannit tous les utilisateurs du serveur d'un coup.",
  category: "moderation",
  usage: "+unbanall",
  userPerms: [
    PermissionsBitField.Flags.BanMembers,
    PermissionsBitField.Flags.Administrator,
  ],
  botPerms: [PermissionsBitField.Flags.BanMembers],
  async execute(client, message, args) {
    if (
      !message.member.permissions.has("Administrator") &&
      !(
        process.env.OWNER_ID &&
        process.env.OWNER_ID.split(",")
          .map((id) => id.trim())
          .includes(message.author.id)
      )
    ) {
      return message
        .reply({
          embeds: [client.embedBuilder.error(client, message.t("commands.unbanall.permission_denied"))],
        })
        .catch(() => {});
    }

    const bans = await message.guild.bans.fetch();
    if (bans.size === 0) {
      return message
        .reply({
          embeds: [client.embedBuilder.error(client, message.t("commands.unbanall.no_bans"))],
        })
        .catch(() => {});
    }

    const total = bans.size;
    const start = Date.now();
    const statusMsg = await message
      .reply({
        embeds: [client.embedBuilder.info(client, `0/${fmtNum(total)}`)],
      })
      .catch(() => null);

    let unbannedCount = 0;
    let failed = 0;
    let processed = 0;
    for (const ban of bans.values()) {
      try {
        await message.guild.bans.remove(ban.user, message.t("commands.unbanall.audit_reason"));
        await sanctionUtils.sendSanctionLiftDm(
          client,
          ban.user,
          message.guild,
          "bannissement",
          message.t("commands.unbanall.lift_reason"),
        );
        unbannedCount++;
      } catch (e) {
        failed++;
        // Honor Discord rate-limit retry_after on 429
        if (e && (e.status === 429 || e.code === 429)) {
          const retryMs = Math.min(
            5000,
            Math.max(500, Number(e.retry_after || e.retryAfter || 1) * 1000),
          );
          await new Promise((r) => setTimeout(r, retryMs));
        }
      }
      processed++;
      // Yield every 5 ops to avoid global bucket exhaustion
      if (processed % 5 === 0) {
        await new Promise((r) => setTimeout(r, 120));
      }
      if (statusMsg && total > 20 && processed % 10 === 0) {
        await statusMsg
          .edit({
            embeds: [
              client.embedBuilder.info(
                client,
                `${fmtNum(processed)}/${fmtNum(total)}`,
              ),
            ],
          })
          .catch(() => {});
      }
    }

    logger.log(
      `[UNBANALL] ${unbannedCount} membres ont été débannis par ${message.author.tag}.`,
      "mod",
    );
    const elapsed = Math.max(1, Math.round((Date.now() - start) / 1000));
    const finalEmbed = client.embedBuilder
      .success(client, "​")
      .setDescription(null)
      .setAuthor({ name: message.t("commands.unbanall.mass_unban_title") })
      .addFields(
        { name: message.t("commands.unbanall.field_affected"), value: fmtNum(unbannedCount), inline: true },
        { name: message.t("commands.unbanall.field_failed"), value: fmtNum(failed), inline: true },
        { name: message.t("commands.unbanall.field_duration"), value: `${elapsed} s`, inline: true },
        {
          name: message.t("commands.unbanall.field_moderator"),
          value: `<@${message.author.id}>`,
          inline: true,
        },
      );
    if (statusMsg) {
      await statusMsg
        .edit({ embeds: [finalEmbed] })
        .catch(() =>
          message.channel.send({ embeds: [finalEmbed] }).catch(() => {}),
        );
    } else {
      message.channel.send({ embeds: [finalEmbed] }).catch(() => {});
    }
  },
};
