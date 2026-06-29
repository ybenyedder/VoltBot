const { AttachmentBuilder } = require("discord.js");
const { findBadword } = require("../utils/badwords");
const { t } = require("../utils/i18n");

module.exports = {
  name: "messageUpdate",
  async execute(oldMessage, newMessage, client) {
    if (!oldMessage.author || oldMessage.author.bot || !oldMessage.guild)
      return;
    if (oldMessage.content === newMessage.content) return;

    // EditSnipe data
    if (!client.editSnipes) client.editSnipes = new Map();
    client.editSnipes.set(oldMessage.channel.id, {
      oldContent: oldMessage.content,
      newContent: newMessage.content,
      author: oldMessage.author.tag,
      avatar: oldMessage.author.displayAvatarURL(),
      timestamp: Date.now(),
    });

    const guildSettings = client.db.getGuild(oldMessage.guild.id);
    const lang = guildSettings.language || "fr";
    const logChannelId =
      client.db.resolveLogChannel(oldMessage.guild.id, "msglog", "update") ||
      client.db.resolveLogChannel(oldMessage.guild.id, "modlog", "update");

    const permissions = require("../utils/permissions");
    const antiraid = client.utils.antiraid;

    // --- AUTOMODÉRATION (LOGIQUE STRICTE SUR ÉDITION) ---
    let antiraidConfig = {
      antiSpamPunishment: "mute",
      antiLinkPunishment: "mute",
      antiMassMentionPunishment: "mute",
      antiMassMention: 0,
      spamLimit: 4,
      mentionLimit: 5,
      muteDuration: 300000,
    };

    try {
      const dbConfig = client.db.getAntiraidConfig(newMessage.guild.id);
      if (dbConfig) antiraidConfig = { ...antiraidConfig, ...dbConfig };
    } catch (e) {
      client.logger.error(
        `[MESSAGE_UPDATE] Error fetching antiraid config for guild ${newMessage.guild.id}: ${e.message}`,
      );
    }

    const mentionThreshold = antiraidConfig.mentionLimit || 5;
    // Exemption are now checked per-feature below
    if (true) {
      // 1. Anti-Liens
      if (
        antiraidConfig.antiLink > 0 &&
        !permissions.isWhitelisted(
          newMessage.author.id,
          newMessage.guild.id,
          client,
          guildSettings,
          "antiLink",
        )
      ) {
        let ignoredLinks = [];
        try {
          ignoredLinks = JSON.parse(
            antiraidConfig.antiLinkIgnoredChannels || "[]",
          );
          if (!Array.isArray(ignoredLinks)) ignoredLinks = [];
        } catch {
          ignoredLinks = [];
        }
        if (!ignoredLinks.includes(newMessage.channel.id)) {
          const inviteRegex =
            /(discord\.gg\/[^\s]+|discord\.com\/invite\/[^\s]+|discordapp\.com\/invite\/[^\s]+|dsc\.gg\/[^\s]+|invite\.gg\/[^\s]+)/gi;
          const linkRegex =
            /(https?:\/\/[^\s]+|bit\.ly\/[^\s]+|[a-zA-Z0-9-]+\.[a-z]{2,}\/(invite|[^\s]*https?))/gi;

          let hasLink = false;
          if (antiraidConfig.antiLinkType === "invites") {
            if (inviteRegex.test(newMessage.content)) hasLink = true;
          } else {
            if (
              inviteRegex.test(newMessage.content) ||
              linkRegex.test(newMessage.content)
            )
              hasLink = true;
          }

          if (hasLink) {
            newMessage.delete().catch(() => {});
            const actionStr =
              antiraidConfig.antiLinkSanction === 0
                ? t(lang, "events.messageUpdate.action_deleted")
                : await antiraid.processSanction(
                    newMessage.member,
                    "antiLink",
                    t(lang, "events.messageUpdate.reason_unauthorized_link"),
                    client,
                  );
            return newMessage.channel
              .send({
                content: t(lang, "events.messageUpdate.antilink_sanction", {
                  user: newMessage.author,
                  action: actionStr,
                }),
              })
              .then((m) => setTimeout(() => m.delete().catch(() => {}), 8000));
          }
        }
      }

      // 2. Anti-Mots-Interdits
      const antiBadWordsEnabled =
        (antiraidConfig.antiBadWords ?? guildSettings.antiBadWords) > 0;
      if (
        antiBadWordsEnabled &&
        !permissions.isWhitelisted(
          newMessage.author.id,
          newMessage.guild.id,
          client,
          guildSettings,
          "antiBadWords",
        )
      ) {
        try {
          const words = client.db.db
            .prepare("SELECT word FROM badwords WHERE guildId = ?")
            .all(newMessage.guild.id);
          if (words && words.length > 0) {
            const found = findBadword(newMessage.content, words);

            if (found) {
              newMessage.delete().catch(() => {});
              const actionStr = await antiraid.processSanction(
                newMessage.member,
                "antiBadWords",
                t(lang, "events.messageUpdate.reason_banned_word", {
                  word: found.word,
                }),
                client,
              );
              return newMessage.channel
                .send({
                  content: t(lang, "events.messageUpdate.antibadword_sanction", {
                    user: newMessage.author,
                    action: actionStr,
                  }),
                })
                .then((m) =>
                  setTimeout(() => m.delete().catch(() => {}), 8000),
                );
            }
          }
        } catch (e) {
          client.logger.error(
            `[MESSAGE_UPDATE] Error processing anti-bad-words for guild ${newMessage.guild.id}: ${e.message}`,
          );
        }
      }

      // 3. Anti-Mass-Mention
      if (
        antiraidConfig.antiMassMention > 0 &&
        !permissions.isWhitelisted(
          newMessage.author.id,
          newMessage.guild.id,
          client,
          guildSettings,
          "antiMassMention",
        )
      ) {
        if (newMessage.mentions.users.size > mentionThreshold) {
          newMessage.delete().catch(() => {});
          const actionStr = await antiraid.processSanction(
            newMessage.member,
            "antiMassMention",
            t(lang, "events.messageUpdate.reason_mass_mention"),
            client,
          );
          return newMessage.channel
            .send({
              content: t(lang, "events.messageUpdate.antimassmention_sanction", {
                user: newMessage.author,
                action: actionStr,
              }),
            })
            .then((m) => setTimeout(() => m.delete().catch(() => {}), 8000));
        }
      }
    }

    if (!logChannelId) return;
    const logsChannel = oldMessage.guild.channels.cache.get(logChannelId);
    if (!logsChannel) return;

    const FIELD_LIMIT = 1024;
    const FENCE_OVERHEAD = 12; // ```diff\n…\n```

    const rawOld = oldMessage.content || "";
    const rawNew = newMessage.content || "";

    const oldTooLong = rawOld.length > FIELD_LIMIT - FENCE_OVERHEAD;
    const newTooLong = rawNew.length > FIELD_LIMIT - FENCE_OVERHEAD;

    // Diff combiné prioritaire si tout tient dans un seul champ
    const emptyLabel = t(lang, "events.messageUpdate.empty");
    const diffBody = `- ${rawOld || emptyLabel}\n+ ${rawNew || emptyLabel}`;
    const diffFits = diffBody.length <= FIELD_LIMIT - FENCE_OVERHEAD;

    const fields = [
      {
        name: t(lang, "events.messageUpdate.field_author"),
        value: `<@${oldMessage.author.id}>`,
        inline: true,
      },
      {
        name: t(lang, "events.messageUpdate.field_channel"),
        value: `<#${oldMessage.channel.id}>`,
        inline: true,
      },
      {
        name: t(lang, "events.messageUpdate.field_link"),
        value: `[${t(lang, "events.messageUpdate.link_label")}](${newMessage.url})`,
        inline: true,
      },
    ];

    if (diffFits && !oldTooLong && !newTooLong) {
      fields.push({
        name: t(lang, "events.messageUpdate.field_diff"),
        value: `\`\`\`diff\n${diffBody}\n\`\`\``,
        inline: false,
      });
    } else {
      const safeOld = (rawOld || emptyLabel).substring(
        0,
        FIELD_LIMIT - FENCE_OVERHEAD,
      );
      const safeNew = (rawNew || emptyLabel).substring(
        0,
        FIELD_LIMIT - FENCE_OVERHEAD,
      );
      fields.push(
        {
          name: t(lang, "events.messageUpdate.field_before"),
          value: `\`\`\`\n${safeOld}\n\`\`\``,
          inline: false,
        },
        {
          name: t(lang, "events.messageUpdate.field_after"),
          value: `\`\`\`\n${safeNew}\n\`\`\``,
          inline: false,
        },
      );
    }

    const embed = client.embedBuilder.modLog(
      client,
      t(lang, "events.messageUpdate.modlog_action"),
      oldMessage.author,
      oldMessage.author,
      t(lang, "events.messageUpdate.modlog_reason"),
      fields,
      lang,
    );

    const files = [];
    if (oldTooLong || newTooLong) {
      const full = `--- ${t(lang, "events.messageUpdate.attachment_before")} ---\n${rawOld}\n\n--- ${t(lang, "events.messageUpdate.attachment_after")} ---\n${rawNew}`;
      files.push(
        new AttachmentBuilder(Buffer.from(full, "utf8"), {
          name: `edit-${oldMessage.id}.txt`,
        }),
      );
    }

    await logsChannel.send({ embeds: [embed], files }).catch(() => {});
  },
};
