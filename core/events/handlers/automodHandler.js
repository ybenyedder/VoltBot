const logger = require("../../utils/logger");
const permissions = require("../../utils/permissions");
const { sendEphemeralReply } = require("../../utils/ephemeralReply");
const { buildMatchers, findBadword } = require("../../utils/badwords");

// Caches simples pour éviter les accès DB et JSON.parse répétitifs
const antiraidCache = new Map();
const settingsCache = new Map();
const badwordsCache = new Map();

// Refresh le cache toutes les 3 minutes
let _cacheRefreshIntervalId = setInterval(() => {
  antiraidCache.clear();
  settingsCache.clear();
  badwordsCache.clear();
}, 180000);
const stopCacheRefresh = () => {
  if (_cacheRefreshIntervalId) {
    clearInterval(_cacheRefreshIntervalId);
    _cacheRefreshIntervalId = null;
  }
};

const handleAutomod = async (message, client, guildSettings) => {
  if (message.author.bot || !message.guild) return false;

  const guildId = message.guild.id;

  // 1. Charger Anti-Raid Config (Caché)
  let antiraid = antiraidCache.get(guildId);
  if (!antiraid) {
    antiraid = client.db.getAntiraidConfig(guildId) || {
      antiSpamPunishment: "mute",
      antiLinkPunishment: "mute",
      antiMassMentionPunishment: "mute",
      antiMassMention: 0,
      spamLimit: 4,
      mentionLimit: 5,
      muteDuration: 300000,
    };
    // Pre-parse les canaux ignorés pour gagner du temps
    const ignoredChannelsJson = Array.isArray(antiraid.antiLinkIgnoredChannels)
      ? JSON.stringify(antiraid.antiLinkIgnoredChannels)
      : (antiraid.antiLinkIgnoredChannels ?? "[]");
    antiraid._ignoredLinks = JSON.parse(
      ignoredChannelsJson === "" ? "[]" : ignoredChannelsJson,
    );
    antiraidCache.set(guildId, antiraid);
  }

  // Whitelist is now checked specifically for each feature below

  // 2. Anti-Liens
  if (
    antiraid.antiLink > 0 &&
    !permissions.isWhitelisted(
      message.author.id,
      guildId,
      client,
      guildSettings,
      "antiLink",
    )
  ) {
    if (!antiraid._ignoredLinks.includes(message.channel.id)) {
      const inviteRegex =
        /(discord\.gg\/[^\s]+|discord\.com\/invite\/[^\s]+|discordapp\.com\/invite\/[^\s]+|dsc\.gg\/[^\s]+|invite\.gg\/[^\s]+)/gi;
      const linkRegex =
        /(https?:\/\/[^\s]+|bit\.ly\/[^\s]+|[a-zA-Z0-9-]+\.[a-z]{2,})/gi;
      const gifUrlExclude =
        /(tenor\.com\/view\/|giphy\.com\/gifs\/|media\.tenor\.com|media\.giphy\.com|\.gif(\?|$|\s))/i;

      const contentForLinkCheck = message.content.replace(
        /(https?:\/\/[^\s]+|[a-zA-Z0-9-]+\.[a-z]{2,}\/[^\s]*)/gi,
        (m) => (gifUrlExclude.test(m) ? "" : m),
      );

      let hasLink = false;
      if (antiraid.antiLinkType === "invites") {
        if (inviteRegex.test(contentForLinkCheck)) hasLink = true;
      } else {
        if (
          inviteRegex.test(contentForLinkCheck) ||
          linkRegex.test(contentForLinkCheck)
        )
          hasLink = true;
      }

      if (hasLink) {
        await message.delete().catch(() => {});
        const actionStr =
          antiraid.antiLinkSanction === 0
            ? message.t("events.automod.deleted")
            : await client.utils.antiraid.processSanction(
                message.member,
                "antiLink",
                message.t("events.automodHandler.reason_link"),
                client,
              );
        message.channel
          .send({
            content: message.t("events.automod.link_blocked", {
              user: message.author,
              action: actionStr,
            }),
          })
          .then((m) => setTimeout(() => m.delete().catch(() => {}), 8000));
        return true;
      }
    }
  }

  // 3. Anti-BadWords
  const antiBadWordsEnabled =
    (antiraid.antiBadWords ?? guildSettings.antiBadWords) > 0;
  if (
    antiBadWordsEnabled &&
    !permissions.isWhitelisted(
      message.author.id,
      guildId,
      client,
      guildSettings,
      "antiBadWords",
    )
  ) {
    let badwords = badwordsCache.get(guildId);
    if (!badwords) {
      const dbWords = client.db.db
        .prepare("SELECT word FROM badwords WHERE guildId = ?")
        .all(guildId);
      badwords = buildMatchers(dbWords);
      badwordsCache.set(guildId, badwords);
    }

    if (badwords.length > 0) {
      const found = findBadword(message.content, badwords);

      if (found) {
        await message.delete().catch(() => {});
        const actionStr = await client.utils.antiraid.processSanction(
          message.member,
          "antiBadWords",
          `Mot interdit : ${found.word}`,
          client,
        );
        message.channel
          .send({
            content: message.t("events.automod.badword_detected", {
              user: message.author,
              action: actionStr,
            }),
          })
          .then((m) => setTimeout(() => m.delete().catch(() => {}), 8000));
        return true;
      }
    }
  }

  // 4. Anti-Spam
  if (
    antiraid.antiSpam > 0 &&
    !permissions.isWhitelisted(
      message.author.id,
      guildId,
      client,
      guildSettings,
      "antiSpam",
    )
  ) {
    if (!client.spamMap) client.spamMap = new Map();
    const userId = message.author.id;
    const now = Date.now();
    const userSpam = client.spamMap.get(`${guildId}_${userId}`) || {
      count: 0,
      lastMessage: now,
      strikes: 0,
      messages: [],
    };

    // Nettoyer messages vieux de plus de 5s
    userSpam.messages = userSpam.messages.filter(
      (m) => now - m.createdTimestamp < 5000,
    );

    if (now - userSpam.lastMessage < 2500) {
      userSpam.count++;
      userSpam.messages.push(message);
    } else {
      userSpam.count = 1;
      userSpam.messages = [message];
    }

    userSpam.lastMessage = now;
    client.spamMap.set(`${guildId}_${userId}`, userSpam);

    if (userSpam.count >= (antiraid.spamLimit || 4)) {
      try {
        if (userSpam.messages.length > 1) {
          await message.channel
            .bulkDelete(userSpam.messages, true)
            .catch(() => {});
        } else {
          await message.delete().catch(() => {});
        }
      } catch (e) {}

      userSpam.strikes++;

      if (userSpam.strikes >= 2 || antiraid.antiSpam === 2) {
        client.spamMap.delete(`${guildId}_${userId}`);
        const actionStr = await client.utils.antiraid.processSanction(
          message.member,
          "antiSpam",
          message.t("events.automodHandler.reason_spam"),
          client,
        );
        message.channel
          .send({
            content: message.t("events.automod.spam_sanctioned", {
              user: message.author,
              action: actionStr,
            }),
          })
          .then((m) => setTimeout(() => m.delete().catch(() => {}), 8000));
        return true;
      } else {
        userSpam.count = 0;
        userSpam.messages = [];
        client.spamMap.set(`${guildId}_${userId}`, userSpam);
        message.channel
          .send({
            content: message.t("events.automod.spam_warning", {
              user: message.author,
            }),
          })
          .then((m) => setTimeout(() => m.delete().catch(() => {}), 5000));
        return true;
      }
    }
  }

  // 5. Anti-GIF
  if (
    antiraid.antiGif > 0 &&
    !permissions.isWhitelisted(
      message.author.id,
      guildId,
      client,
      guildSettings,
      "antiGif",
    )
  ) {
    const gifUrlRegex =
      /(tenor\.com\/view\/|giphy\.com\/gifs\/|media\.tenor\.com|media\.giphy\.com|\.gif(\?|$|\s))/i;
    let isGif = false;

    if (message.attachments && message.attachments.size > 0) {
      for (const att of message.attachments.values()) {
        const name = (att.name || "").toLowerCase();
        const ct = (att.contentType || "").toLowerCase();
        if (name.endsWith(".gif") || ct === "image/gif") {
          isGif = true;
          break;
        }
      }
    }

    if (!isGif && message.embeds && message.embeds.length > 0) {
      for (const emb of message.embeds) {
        if (
          emb.type === "gifv" ||
          (emb.video && /\.gif/i.test(emb.video.url || "")) ||
          (emb.image && /\.gif/i.test(emb.image.url || ""))
        ) {
          isGif = true;
          break;
        }
      }
    }

    if (!isGif && message.content && gifUrlRegex.test(message.content)) {
      isGif = true;
    }

    if (isGif) {
      await message.delete().catch(() => {});
      const punishment = antiraid.antiGifPunishment || "delete";
      let actionStr = message.t("events.automod.deleted");
      if (punishment !== "delete" && punishment !== "none") {
        actionStr = await client.utils.antiraid.processSanction(
          message.member,
          "antiGif",
          message.t("events.automodHandler.reason_gif"),
          client,
        );
      }
      message.channel
        .send({
          content: message.t("events.automod.gif_blocked", {
            user: message.author,
            action: actionStr,
          }),
        })
        .then((m) => setTimeout(() => m.delete().catch(() => {}), 8000));
      return true;
    }
  }

  // 6. Anti-Mass-Mention
  if (
    antiraid.antiMassMention > 0 &&
    !permissions.isWhitelisted(
      message.author.id,
      guildId,
      client,
      guildSettings,
      "antiMassMention",
    )
  ) {
    if (message.mentions.users.size > (antiraid.mentionLimit || 5)) {
      await message.delete().catch(() => {});
      const actionStr = await client.utils.antiraid.processSanction(
        message.member,
        "antiMassMention",
        "Mass-Mention",
        client,
      );
      message.channel
        .send({
          content: message.t("events.automod.massmention_sanctioned", {
            user: message.author,
            action: actionStr,
          }),
        })
        .then((m) => setTimeout(() => m.delete().catch(() => {}), 8000));
      return true;
    }
  }

  return false;
};

const invalidateGuildCache = (guildId) => {
  antiraidCache.delete(guildId);
  settingsCache.delete(guildId);
  badwordsCache.delete(guildId);
};

module.exports = { handleAutomod, invalidateGuildCache, stopCacheRefresh };
