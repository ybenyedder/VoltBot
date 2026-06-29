const logger = require("../utils/logger");
const { t } = require("../utils/i18n");

module.exports = {
  name: "inviteCreate",
  async execute(invite, client) {
    if (!invite || !invite.guild) return;

    try {
      if (!client.inviteCache) client.inviteCache = {};
      if (!client.inviteCache[invite.guild.id]) {
        client.inviteCache[invite.guild.id] = new Map();
      }

      client.inviteCache[invite.guild.id].set(invite.code, {
        code: invite.code,
        uses: invite.uses || 0,
        inviterId: invite.inviter ? invite.inviter.id : null,
        maxUses: invite.maxUses || 0,
        createdTimestamp: invite.createdTimestamp || Date.now(),
      });
    } catch (err) {
      logger.error(`[INVITE_CREATE] Erreur cache: ${err.message}`, err);
    }

    // --- LOG : invitations ---
    try {
      const logChannelId = client.db.resolveLogChannel(
        invite.guild.id,
        "invitelog",
        "create",
      );
      if (!logChannelId) return;
      const ch = invite.guild.channels.cache.get(logChannelId);
      if (!ch) return;
      const gs = client.db.getGuild(invite.guild.id);
      const lang = (gs && gs.language) || "fr";
      const embed = client.embedBuilder
        .base(client, t(lang, "events.inviteCreate.title"))
        .addFields(
          {
            name: t(lang, "events.inviteCreate.code"),
            value: `\`${invite.code}\``,
            inline: true,
          },
          {
            name: t(lang, "events.inviteCreate.channel"),
            value: invite.channel
              ? `<#${invite.channel.id}>`
              : t(lang, "events.inviteCreate.unknown"),
            inline: true,
          },
          {
            name: t(lang, "events.inviteCreate.author"),
            value: invite.inviter
              ? `<@${invite.inviter.id}>`
              : t(lang, "events.inviteCreate.unknown"),
            inline: true,
          },
          {
            name: t(lang, "events.inviteCreate.max_uses"),
            value: `\`${invite.maxUses || "∞"}\``,
            inline: true,
          },
          {
            name: t(lang, "events.inviteCreate.expiration"),
            value: invite.expiresTimestamp
              ? `<t:${Math.floor(invite.expiresTimestamp / 1000)}:R>`
              : t(lang, "events.inviteCreate.never"),
            inline: true,
          },
        );
      await ch.send({ embeds: [embed] }).catch(() => {});
    } catch (err) {
      logger.error(`[INVITE_CREATE] Log erreur: ${err.message}`, err);
    }
  },
};
