const { t } = require("./i18n");

module.exports = {
  sendSanctionDm: async (client, target, guild, action, reason) => {
    try {
      const guildSettings = client.db.getGuild(guild.id);
      if (!guildSettings || !guildSettings.sanctionDm) return;

      const lang = guildSettings.language || "fr";
      const finalReason = reason || t(lang, "utils.sanctionUtils.no_reason");

      // Custom template configured — keep plain-text behaviour for backwards compatibility.
      if (guildSettings.sanctionDmMessage) {
        const dmMsg = guildSettings.sanctionDmMessage
          .replace(/{action}/g, action)
          .replace(/{server}/g, guild.name)
          .replace(/{reason}/g, finalReason);
        await target.send(dmMsg).catch(() => {});
        return;
      }

      // Default: premium embed.
      if (
        client.embedBuilder &&
        typeof client.embedBuilder.premium === "function"
      ) {
        const embed = client.embedBuilder
          .premium(
            client,
            t(lang, "utils.sanctionUtils.sanction_title", { action }),
            t(lang, "events.sanction_default", {
              action,
              server: guild.name,
            }),
            guild.iconURL?.({ dynamic: true }) || null,
          )
          .addFields({
            name: t(lang, "utils.sanctionUtils.reason_field"),
            value: `\`\`\`${finalReason}\`\`\``,
            inline: false,
          });
        await target.send({ embeds: [embed] }).catch(() => {});
        return;
      }

      // Fallback if embedBuilder unavailable.
      await target
        .send(
          t(lang, "events.sanction_fallback", {
            action,
            server: guild.name,
            reason: finalReason,
          }),
        )
        .catch(() => {});
    } catch (_) {
      // DM fermés ou erreur réseau — silencieux.
    }
  },

  sendSanctionLiftDm: async (client, target, guild, action, reason) => {
    try {
      const guildSettings = client.db.getGuild(guild.id);
      if (!guildSettings || !guildSettings.sanctionDm || !target) return;

      const lang = guildSettings.language || "fr";
      const finalReason = reason || t(lang, "utils.sanctionUtils.lift_default_reason");

      if (
        client.embedBuilder &&
        typeof client.embedBuilder.premium === "function"
      ) {
        const embed = client.embedBuilder
          .premium(
            client,
            t(lang, "utils.sanctionUtils.sanction_lift_title", { action }),
            t(lang, "events.sanction_lift_default", {
              action,
              server: guild.name,
            }),
            guild.iconURL?.({ dynamic: true }) || null,
          )
          .addFields({
            name: t(lang, "utils.sanctionUtils.reason_field"),
            value: `\`\`\`${finalReason}\`\`\``,
            inline: false,
          });
        await target.send({ embeds: [embed] }).catch(() => {});
        return;
      }

      await target
        .send(
          t(lang, "events.sanction_lift_fallback", {
            action,
            server: guild.name,
            reason: finalReason,
          }),
        )
        .catch(() => {});
    } catch (_) {
      // DM fermés ou erreur réseau — silencieux.
    }
  },
};
