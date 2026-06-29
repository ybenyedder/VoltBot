const { AuditLogEvent } = require("discord.js");
const logger = require("../utils/logger");
const { t } = require("../utils/i18n");

module.exports = {
  name: "messageDelete",
  async execute(message, client) {
    if (message.author?.bot || !message.guild || !message.author) return;

    // Snipe data
    if (!client.snipes) client.snipes = new Map();
    client.snipes.set(message.channel.id, {
      content: message.content,
      author: message.author.tag,
      avatar: message.author.displayAvatarURL(),
      image: message.attachments.first()?.url || null,
      timestamp: Date.now(),
    });

    const guildSettings = client.db.getGuild(message.guild.id);
    const lang = (guildSettings && guildSettings.language) || "fr";
    const logChannelId =
      client.db.resolveLogChannel(message.guild.id, "msglog", "delete") ||
      client.db.resolveLogChannel(message.guild.id, "modlog", "delete");
    if (!logChannelId) return;

    const logsChannel = message.guild.channels.cache.get(logChannelId);
    if (!logsChannel) return;

    let content = message.content;
    if (!content && message.attachments.size > 0)
      content = t(lang, "events.messageDelete.attachments", {
        count: message.attachments.size,
      });
    if (!content && message.embeds.length > 0)
      content = t(lang, "events.messageDelete.embed");

    let executor = null;
    try {
      await new Promise((r) => setTimeout(r, 1000));
      const fetchedLogs = await message.guild
        .fetchAuditLogs({ limit: 1, type: AuditLogEvent.MessageDelete })
        .catch(() => null);
      const log = fetchedLogs?.entries.first();
      if (
        log &&
        log.target.id === message.author.id &&
        log.extra?.channel?.id === message.channel.id &&
        Date.now() - log.createdTimestamp < 8000
      ) {
        executor = log.executor;
      }
    } catch (e) {
      logger.warn(`[MESSAGE_DELETE] Error fetching audit logs: ${e.message}`);
    }

    const safeContent = (
      content || t(lang, "events.messageDelete.empty")
    ).substring(0, 1018);
    const contentBlock = `\`\`\`\n${safeContent}\n\`\`\``;

    const fields = [
      {
        name: t(lang, "events.messageDelete.author"),
        value: `<@${message.author.id}>`,
        inline: true,
      },
      {
        name: t(lang, "events.messageDelete.channel"),
        value: `<#${message.channel.id}>`,
        inline: true,
      },
    ];
    if (executor) {
      fields.push({
        name: t(lang, "events.messageDelete.executor"),
        value: `<@${executor.id}>`,
        inline: true,
      });
    }
    fields.push({
      name: t(lang, "events.messageDelete.content"),
      value: contentBlock,
      inline: false,
    });

    const embed = client.embedBuilder.modLog(
      client,
      t(lang, "events.messageDelete.title"),
      message.author,
      executor || message.author,
      t(lang, "events.messageDelete.reason"),
      fields,
      lang,
    );

    if (message.attachments.size > 0) {
      embed.setImage(message.attachments.first().url);
    }

    await logsChannel.send({ embeds: [embed] }).catch(() => {});
  },
};
