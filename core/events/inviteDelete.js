const logger = require("../utils/logger");
const { t } = require("../utils/i18n");

module.exports = {
  name: "inviteDelete",
  async execute(invite, client) {
    if (!invite || !invite.guild) return;

    try {
      if (
        client.inviteCache &&
        client.inviteCache[invite.guild.id] &&
        client.inviteCache[invite.guild.id].has(invite.code)
      ) {
        client.inviteCache[invite.guild.id].delete(invite.code);
      }
    } catch (err) {
      logger.error(`[INVITE_DELETE] Erreur cache: ${err.message}`, err);
    }

    // --- LOG : invitations ---
    try {
      const logChannelId = client.db.resolveLogChannel(
        invite.guild.id,
        "invitelog",
        "delete",
      );
      if (!logChannelId) return;
      const ch = invite.guild.channels.cache.get(logChannelId);
      if (!ch) return;
      const gs = client.db.getGuild(invite.guild.id);
      const lang = (gs && gs.language) || "fr";
      const embed = client.embedBuilder
        .base(client, t(lang, "events.inviteDelete.title"))
        .addFields(
          {
            name: t(lang, "events.inviteDelete.code"),
            value: `\`${invite.code}\``,
            inline: true,
          },
          {
            name: t(lang, "events.inviteDelete.channel"),
            value: invite.channel
              ? `<#${invite.channel.id}>`
              : t(lang, "events.inviteDelete.unknown"),
            inline: true,
          },
        );
      await ch.send({ embeds: [embed] }).catch(() => {});
    } catch (err) {
      logger.error(`[INVITE_DELETE] Log erreur: ${err.message}`, err);
    }
  },
};
