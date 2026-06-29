const { PermissionFlagsBits } = require("discord.js");
const { t } = require("./i18n");

// Verbes d'action passés par les commandes de modération -> traduction EN.
// Repli sur le verbe français brut si inconnu.
const ACTION_EN = {
  modérer: "moderate",
  expulser: "kick",
  bannir: "ban",
  "mute temporairement": "temporarily mute",
  "bannir temporairement": "temporarily ban",
  timeout: "timeout",
  avertir: "warn",
};
const localizeAction = (action, lang) =>
  lang === "en" ? ACTION_EN[action] || action : action;

module.exports = {
  isAdmin: (message, client) => {
    if (module.exports.isBotOwner(client, message.author.id)) return true;
    if (message.author.id === message.guild.ownerId) return true;
    return message.member.permissions.has(PermissionFlagsBits.Administrator);
  },
  isOwner: (message) => {
    return module.exports.isPrimaryOwner(message.author.id);
  },
  isPrimaryOwner: (userId) => {
    return (
      process.env.OWNER_ID &&
      process.env.OWNER_ID.split(",")
        .map((id) => id.trim())
        .includes(userId)
    );
  },
  isBotOwner: (client, userId) => {
    const isPrimary = module.exports.isPrimaryOwner(userId);
    const isSecondary =
      client && client.db && client.db.isBotOwner
        ? client.db.isBotOwner(userId)
        : false;
    return isPrimary || isSecondary;
  },
  isWhitelisted: (
    userId,
    guildId,
    client,
    guildSettings = null,
    action = null,
  ) => {
    if (module.exports.isPrimaryOwner(userId)) {
      return true;
    }

    if (client && client.db && client.db.getAntiraidWhitelistUser) {
      const granularBypasses = client.db.getAntiraidWhitelistUser(
        guildId,
        userId,
      );
      if (granularBypasses && Array.isArray(granularBypasses)) {
        if (granularBypasses.includes("*")) return true;
        if (action && granularBypasses.includes(action)) return true;
        return false;
      }
    }

    let guildData = guildSettings;
    if (!guildData && client && client.db && client.db.getGuild) {
      guildData = client.db.getGuild(guildId);
    }

    if (!guildData) {
      return false;
    }

    try {
      const whitelist = guildData.whitelist
        ? typeof guildData.whitelist === "string"
          ? JSON.parse(guildData.whitelist)
          : guildData.whitelist
        : [];
      if (Array.isArray(whitelist) && whitelist.includes(userId)) {
        return true;
      }
    } catch (_) {}

    try {
      const bypass = guildData.bypass
        ? typeof guildData.bypass === "string"
          ? JSON.parse(guildData.bypass)
          : guildData.bypass
        : [];
      if (Array.isArray(bypass) && bypass.includes(userId)) {
        return true;
      }
    } catch (_) {}

    return false;
  },

  isModerator: (message, client) => {
    if (module.exports.isBotOwner(client, message.author.id)) return true;
    if (message.author.id === message.guild.ownerId) return true;
    if (message.member.permissions.has(PermissionFlagsBits.Administrator))
      return true;

    const guildSettings = client.db.getGuild(message.guild.id);
    if (guildSettings && guildSettings.modRole) {
      if (message.member.roles.cache.has(guildSettings.modRole)) return true;
    }

    return (
      message.member.permissions.has(PermissionFlagsBits.ModerateMembers) ||
      message.member.permissions.has(PermissionFlagsBits.ManageMessages)
    );
  },

  checkHierarchy: (message, member, client, action = "modérer") => {
    const lang = message.lang || "fr";
    const act = localizeAction(action, lang);

    if (member.id === message.guild.ownerId) {
      return t(lang, "utils.permissions.cannot_action_owner", { action: act });
    }

    if (member.id === message.author.id) {
      return t(lang, "utils.permissions.cannot_action_self", { action: act });
    }

    if (member.id === client.user.id) {
      return t(lang, "utils.permissions.cannot_action_self_bot", { action: act });
    }

    if (module.exports.isBotOwner(client, message.author.id)) {
      const botRole = message.guild.members.me.roles.highest;
      const targetRole = member.roles.highest;
      if (botRole.position <= targetRole.position) {
        return t(lang, "utils.permissions.bot_role_below_owner", {
          botPos: botRole.position,
          targetName: targetRole.name,
          targetPos: targetRole.position,
        });
      }
      return null;
    }

    const executorRole = message.member.roles.highest;
    const targetRole = member.roles.highest;

    if (
      executorRole.position <= targetRole.position &&
      message.author.id !== message.guild.ownerId
    ) {
      return t(lang, "utils.permissions.executor_role_below", {
        execName: executorRole.name,
        execPos: executorRole.position,
        targetName: targetRole.name,
        targetPos: targetRole.position,
      });
    }

    const botRole = message.guild.members.me.roles.highest;
    if (botRole.position <= targetRole.position) {
      return t(lang, "utils.permissions.bot_role_below", {
        botName: botRole.name,
        botPos: botRole.position,
        targetName: targetRole.name,
        targetPos: targetRole.position,
      });
    }

    return null;
  },

  diagnoseKickable: (guild, member, lang = "fr") => {
    const me = guild.members.me;
    if (!me) return t(lang, "utils.permissions.diag_bot_not_found");
    if (member.user.id === guild.ownerId)
      return t(lang, "utils.permissions.diag_target_owner");
    if (member.user.id === me.id) return t(lang, "utils.permissions.diag_target_bot");
    if (!me.permissions.has(PermissionFlagsBits.KickMembers))
      return t(lang, "utils.permissions.diag_no_kick_perm");
    const botPos = me.roles.highest.position;
    const targetPos = member.roles.highest.position;
    if (botPos <= targetPos)
      return t(lang, "utils.permissions.diag_role_below", {
        botRole: me.roles.highest.name,
        botPos,
        targetRole: member.roles.highest.name,
        targetPos,
      });
    return t(lang, "utils.permissions.diag_unknown");
  },

  diagnoseBannable: (guild, member, lang = "fr") => {
    const me = guild.members.me;
    if (!me) return t(lang, "utils.permissions.diag_bot_not_found");
    if (member.user.id === guild.ownerId)
      return t(lang, "utils.permissions.diag_target_owner");
    if (member.user.id === me.id) return t(lang, "utils.permissions.diag_target_bot");
    if (!me.permissions.has(PermissionFlagsBits.BanMembers))
      return t(lang, "utils.permissions.diag_no_ban_perm");
    const botPos = me.roles.highest.position;
    const targetPos = member.roles.highest.position;
    if (botPos <= targetPos)
      return t(lang, "utils.permissions.diag_role_below", {
        botRole: me.roles.highest.name,
        botPos,
        targetRole: member.roles.highest.name,
        targetPos,
      });
    return t(lang, "utils.permissions.diag_unknown");
  },

  diagnoseModeratable: (guild, member, lang = "fr") => {
    const me = guild.members.me;
    if (!me) return t(lang, "utils.permissions.diag_bot_not_found");
    if (member.user.id === guild.ownerId)
      return t(lang, "utils.permissions.diag_target_owner");
    if (member.user.id === me.id) return t(lang, "utils.permissions.diag_target_bot");
    if (!me.permissions.has(PermissionFlagsBits.ModerateMembers))
      return t(lang, "utils.permissions.diag_no_moderate_perm");
    if (member.permissions.has(PermissionFlagsBits.Administrator))
      return t(lang, "utils.permissions.diag_target_admin");
    const botPos = me.roles.highest.position;
    const targetPos = member.roles.highest.position;
    if (botPos <= targetPos)
      return t(lang, "utils.permissions.diag_role_below", {
        botRole: me.roles.highest.name,
        botPos,
        targetRole: member.roles.highest.name,
        targetPos,
      });
    return t(lang, "utils.permissions.diag_unknown");
  },
};
