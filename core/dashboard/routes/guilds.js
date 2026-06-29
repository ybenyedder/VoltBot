const express = require("express");
const fs = require("fs");
const path = require("path");
const { PermissionsBitField, ChannelType } = require("discord.js");
const Logger = require("../../utils/logger.js");
const { t } = require("../../utils/i18n");
const {
  invalidateGuildCache,
} = require("../../events/handlers/automodHandler");

// --- BACKUP HELPERS (shared with `+backup` command) ---
const BACKUP_ID_REGEX = /^\d{10,20}$/;
const getBackupDir = () => {
  const instanceDir = process.env.BOT_INSTANCE_CWD || process.cwd();
  return path.join(instanceDir, "data", "backups");
};
const safeBackupPath = (id) => {
  if (!BACKUP_ID_REGEX.test(id)) return null;
  const dir = getBackupDir();
  const full = path.join(dir, `${id}.json`);
  // Defensive: ensure resolved path stays in dir (prevent traversal).
  if (!full.startsWith(path.resolve(dir) + path.sep)) return null;
  return full;
};

async function snapshotGuild(guild, authorId) {
  const data = {
    name: guild.name,
    iconURL: guild.iconURL(),
    roles: [],
    categories: [],
    channels: [],
    everyonePermissions: guild.roles.everyone.permissions.bitfield.toString(),
    createdBy: authorId,
    createdAt: Date.now(),
  };

  const guildRoles = [...guild.roles.cache.values()].sort(
    (a, b) => b.position - a.position,
  );
  guildRoles
    .filter((r) => !r.managed && r.id !== guild.id)
    .forEach((role) => {
      data.roles.push({
        name: role.name,
        color: role.hexColor,
        hoist: role.hoist,
        permissions: role.permissions.bitfield.toString(),
        mentionable: role.mentionable,
      });
    });

  const mapOverwrites = (channel) =>
    channel.permissionOverwrites.cache.map((ov) => {
      let roleName = null;
      if (ov.type === 0) {
        const role = guild.roles.cache.get(ov.id);
        if (role) roleName = role.name;
      }
      return {
        id: ov.id,
        type: ov.type,
        roleName,
        allow: ov.allow.bitfield.toString(),
        deny: ov.deny.bitfield.toString(),
      };
    });

  const categories = guild.channels.cache
    .filter((c) => c.type === ChannelType.GuildCategory)
    .sort((a, b) => a.position - b.position);
  for (const category of categories.values()) {
    const catData = {
      name: category.name,
      permissions: mapOverwrites(category),
      children: [],
    };
    const children = guild.channels.cache
      .filter((c) => c.parentId === category.id)
      .sort((a, b) => a.position - b.position);
    children.forEach((child) => {
      catData.children.push({
        name: child.name,
        type: child.type,
        topic: child.topic,
        nsfw: child.nsfw,
        rateLimitPerUser: child.rateLimitPerUser,
        bitrate: child.bitrate,
        userLimit: child.userLimit,
        permissions: mapOverwrites(child),
      });
    });
    data.categories.push(catData);
  }

  const orphans = guild.channels.cache
    .filter((c) => !c.parentId && c.type !== ChannelType.GuildCategory)
    .sort((a, b) => a.position - b.position);
  orphans.forEach((child) => {
    data.channels.push({
      name: child.name,
      type: child.type,
      topic: child.topic,
      nsfw: child.nsfw,
      rateLimitPerUser: child.rateLimitPerUser,
      bitrate: child.bitrate,
      userLimit: child.userLimit,
      permissions: mapOverwrites(child),
    });
  });

  return data;
}

async function restoreGuild(guild, backupData) {
  const handleRateLimit = async (e) => {
    if (e && (e.status === 429 || e.code === 429)) {
      const retryMs = Math.min(
        5000,
        Math.max(500, Number(e.retry_after || e.retryAfter || 1) * 1000),
      );
      await new Promise((r) => setTimeout(r, retryMs));
    }
  };

  for (const channel of [...guild.channels.cache.values()]) {
    try {
      await channel.delete();
    } catch (e) {
      await handleRateLimit(e);
    }
  }
  for (const role of [...guild.roles.cache.values()]) {
    if (role.managed || role.id === guild.id || role.name === "@everyone")
      continue;
    try {
      await role.delete();
    } catch (e) {
      await handleRateLimit(e);
    }
  }

  const roleMap = new Map();
  for (const r of backupData.roles || []) {
    try {
      const newRole = await guild.roles.create({
        name: r.name,
        colors: r.color,
        hoist: r.hoist,
        permissions: BigInt(r.permissions),
        mentionable: r.mentionable,
      });
      roleMap.set(r.name, newRole.id);
    } catch (e) {
      await handleRateLimit(e);
    }
  }

  if (backupData.everyonePermissions) {
    try {
      await guild.roles.everyone.setPermissions(
        BigInt(backupData.everyonePermissions),
      );
    } catch (e) {}
  }

  const resolveOverwrites = (overwrites) =>
    (overwrites || []).map((ov) => {
      let targetId = ov.id;
      if (ov.type === 0 && ov.roleName) {
        targetId = roleMap.get(ov.roleName) || ov.id;
      }
      return {
        id: targetId,
        allow: BigInt(ov.allow),
        deny: BigInt(ov.deny),
      };
    });

  for (const cat of backupData.categories || []) {
    try {
      const newCat = await guild.channels.create({
        name: cat.name,
        type: ChannelType.GuildCategory,
        permissionOverwrites: resolveOverwrites(cat.permissions),
      });
      for (const child of cat.children || []) {
        try {
          await guild.channels.create({
            name: child.name,
            type: child.type,
            topic: child.topic,
            nsfw: child.nsfw,
            rateLimitPerUser: child.rateLimitPerUser,
            bitrate: child.bitrate,
            userLimit: child.userLimit,
            parent: newCat.id,
            permissionOverwrites: resolveOverwrites(child.permissions),
          });
        } catch (e) {
          await handleRateLimit(e);
        }
      }
    } catch (e) {
      await handleRateLimit(e);
    }
  }

  for (const child of backupData.channels || []) {
    try {
      await guild.channels.create({
        name: child.name,
        type: child.type,
        topic: child.topic,
        nsfw: child.nsfw,
        rateLimitPerUser: child.rateLimitPerUser,
        bitrate: child.bitrate,
        userLimit: child.userLimit,
        permissionOverwrites: resolveOverwrites(child.permissions),
      });
    } catch (e) {
      await handleRateLimit(e);
    }
  }
}

const ANTIRAID_FIELDS = [
  "raidMode",
  "antiBot",
  "antiBotPunishment",
  "antiJoinPunishment",
  "antiMassMention",
  "antiMassMentionPunishment",
  "antiNuke",
  "antiNukePunishment",
  "antiChannel",
  "antiChannelPunishment",
  "antiRole",
  "antiRolePunishment",
  "antiKick",
  "antiKickPunishment",
  "antiBan",
  "antiBanPunishment",
  "antiUnban",
  "antiUnbanPunishment",
  "antiWebhook",
  "antiWebhookPunishment",
  "antiEmote",
  "antiEmotePunishment",
  "antiSticker",
  "antiStickerPunishment",
  "antiGif",
  "antiGifPunishment",
  "antiSoundboard",
  "antiSoundboardPunishment",
  "antiThread",
  "antiThreadPunishment",
  "antiCreateInvite",
  "antiCreateInvitePunishment",
  "antiEditGuild",
  "antiEditGuildPunishment",
  "antiNewAccount",
  "antiNewAccountPunishment",
  "antiLink",
  "antiLinkType",
  "antiLinkSanction",
  "antiLinkPunishment",
  "antiLinkIgnoredChannels",
  "antiRank",
  "antiRankType",
  "antiRankPunishment",
  "antiBadWords",
  "antiBadWordsPunishment",
  "nukeChannelLimit",
  "nukeRoleLimit",
  "nukeBanLimit",
  "nukeUnbanLimit",
  "spamLimit",
  "antiSpam",
  "antiSpamPunishment",
  "mentionLimit",
  "muteDuration",
];

function parseJsonArray(value) {
  if (Array.isArray(value)) return value;
  try {
    const parsed = JSON.parse(value || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

const SUGGESTION_STATUS = new Set(["accept", "deny", "consider"]);

function ensureSuggestionTables(client) {
  try {
    client.db.db
      .prepare(
        "CREATE TABLE IF NOT EXISTS suggestions (msgId TEXT PRIMARY KEY, guildId TEXT NOT NULL, userId TEXT NOT NULL, status TEXT)",
      )
      .run();
  } catch (e) {}
  try {
    client.db.db
      .prepare(
        "CREATE TABLE IF NOT EXISTS suggestion_votes (msgId TEXT NOT NULL, userId TEXT NOT NULL, vote TEXT NOT NULL, PRIMARY KEY (msgId, userId))",
      )
      .run();
  } catch (e) {}
}

module.exports = function (client, middlewares, helpers) {
  const router = express.Router();
  const { requireAuth, requireGuildAdmin } = middlewares;
  const { logDashboardAction, DEFAULT_MODULES } = helpers;

  router.get(
    "/:guildId/modules",
    requireAuth,
    requireGuildAdmin,
    (req, res) => {
      try {
        const dbModules = client.db.getGuildModules(req.params.guildId);
        const moduleState = {};
        dbModules.forEach((m) => {
          moduleState[m.moduleName] = m.isEnabled === 1;
        });

        const result = DEFAULT_MODULES.map((name) => ({
          name: name,
          isEnabled: moduleState.hasOwnProperty(name)
            ? moduleState[name]
            : true,
        }));

        res.json(result);
      } catch (error) {
        Logger.error(`[DASHBOARD MODULES ERROR] reqId=${req.reqId}`, error);
        res.status(500).json({
          error: t(req.lang, "dashboard.guilds.modules_fetch_failed"),
          reqId: req.reqId,
        });
      }
    },
  );

  router.get(
    "/:guildId/channels",
    requireAuth,
    requireGuildAdmin,
    (req, res) => {
      const { guildId } = req.params;
      const guild = client.guilds.cache.get(guildId);

      if (!guild)
        return res
          .status(404)
          .json({ error: t(req.lang, "dashboard.guilds.server_not_found") });

      try {
        const channels = guild.channels.cache
          .filter((c) => c.type === 0 || c.type === 4)
          .map((c) => ({
            id: c.id,
            name: c.name,
            type: c.type,
          }))
          .sort((a, b) => a.name.localeCompare(b.name));

        res.json(channels);
      } catch (error) {
        Logger.error(`[DASHBOARD CHANNELS ERROR] reqId=${req.reqId}`, error);
        res.status(500).json({
          error: t(req.lang, "dashboard.guilds.channels_fetch_failed"),
          reqId: req.reqId,
        });
      }
    },
  );

  router.patch(
    "/:guildId/modules/:moduleName",
    requireAuth,
    requireGuildAdmin,
    (req, res) => {
      const { moduleName } = req.params;
      const { isEnabled } = req.body;

      if (typeof isEnabled !== "boolean") {
        return res
          .status(400)
          .json({ error: t(req.lang, "dashboard.guilds.is_enabled_boolean") });
      }

      if (!DEFAULT_MODULES.includes(moduleName)) {
        return res
          .status(404)
          .json({ error: t(req.lang, "dashboard.guilds.module_not_found") });
      }

      try {
        client.db.updateGuildModule(req.params.guildId, moduleName, isEnabled);

        // Filet de sécurité : forcer l'invalidation du cache interne db
        // même si updateGuildModule devait évoluer un jour.
        if (typeof client.db.invalidateModuleCache === "function") {
          client.db.invalidateModuleCache(req.params.guildId);
        }

        if (!client.guildModulesCache.has(req.params.guildId)) {
          client.guildModulesCache.set(req.params.guildId, new Set());
        }

        const guildCache = client.guildModulesCache.get(req.params.guildId);
        if (isEnabled) {
          guildCache.delete(moduleName);
        } else {
          guildCache.add(moduleName);
        }

        logDashboardAction(
          req.params.guildId,
          req.user.id,
          req.user.username,
          "UPDATE_MODULE",
          { module: moduleName, isEnabled },
        );
        res.json({ success: true, module: moduleName, isEnabled });
      } catch (error) {
        Logger.error(
          `[DASHBOARD MODULE UPDATE ERROR] reqId=${req.reqId}`,
          error,
        );
        res.status(500).json({
          error: t(req.lang, "dashboard.guilds.module_update_failed"),
          reqId: req.reqId,
        });
      }
    },
  );

  router.get(
    "/:guildId/settings",
    requireAuth,
    requireGuildAdmin,
    (req, res) => {
      try {
        const settings = client.db.getGuild(req.params.guildId);
        const antiraid = client.db.getAntiraidConfig(req.params.guildId) || {};

        const antiraidSettings = {};
        ANTIRAID_FIELDS.forEach((field) => {
          if (antiraid[field] !== undefined)
            antiraidSettings[field] = antiraid[field];
        });
        antiraidSettings.antiLinkIgnoredChannels = parseJsonArray(
          antiraidSettings.antiLinkIgnoredChannels,
        );

        res.json({
          prefix: settings.prefix || "+",
          modLogsChannel: settings.modLogsChannel || null,
          raidLogsChannel: settings.raidLogsChannel || null,
          msgLogsChannel: settings.msgLogsChannel || null,
          voiceLogsChannel: settings.voiceLogsChannel || null,
          welcomeChannel: settings.welcomeChannel || null,
          goodbyeChannel: settings.goodbyeChannel || null,
          birthdayChannel: settings.birthdayChannel || null,
          levelChannel: settings.levelChannel || null,
          levelMessage:
            settings.levelMessage ||
            "{user}, tu viens de passer niveau **{level}** !",
          welcomeMessage: settings.welcomeMessage || "",
          welcomeTitle: settings.welcomeTitle || "Bienvenue.",
          welcomeGif: settings.welcomeGif || null,
          welcomeTextChannel: settings.welcomeTextChannel || null,
          welcomeTextMessage: settings.welcomeTextMessage || "",
          goodbyeMessage: settings.goodbyeMessage || "",
          welcomeDm: settings.welcomeDm === 1,
          welcomeDmMessage:
            settings.welcomeDmMessage ||
            t(req.lang, "dashboard.guilds.welcome_dm_default"),
          goodbyeDm: settings.goodbyeDm === 1,
          goodbyeDmMessage:
            settings.goodbyeDmMessage ||
            t(req.lang, "dashboard.guilds.goodbye_dm_default"),
          sanctionDm: settings.sanctionDm === 1,
          sanctionDmMessage:
            settings.sanctionDmMessage ||
            t(req.lang, "dashboard.guilds.sanction_dm_default"),
          joinPingChannel: settings.joinPingChannel || null,
          joinPingChannels: (() => {
            const arr = parseJsonArray(settings.joinPingChannels);
            // Union with legacy scalar `joinPingChannel` so the dashboard
            // surfaces whatever the bot command historically wrote.
            if (
              settings.joinPingChannel &&
              !arr.includes(settings.joinPingChannel)
            )
              arr.unshift(settings.joinPingChannel);
            return arr;
          })(),
          joinPingMode: settings.joinPingMode || "ghost",
          language: settings.language || "fr",
          autoRole: settings.autoRole || null,
          modRole: settings.modRole || null,
          suggestChannel: settings.suggestChannel || null,
          dropChannels: parseJsonArray(settings.dropChannels),
          publicChannels: parseJsonArray(settings.publicChannels),
          ...antiraidSettings,
          antiBadWords: antiraid.antiBadWords ?? settings.antiBadWords ?? 0,
        });
      } catch (error) {
        Logger.error(`[DASHBOARD SETTINGS ERROR] reqId=${req.reqId}`, error);
        res.status(500).json({
          error: t(req.lang, "dashboard.guilds.settings_fetch_failed"),
          reqId: req.reqId,
        });
      }
    },
  );

  router.patch(
    "/:guildId/settings",
    requireAuth,
    requireGuildAdmin,
    (req, res) => {
      const updates = req.body;
      const allowedUpdates = [
        "prefix",
        "modLogsChannel",
        "raidLogsChannel",
        "msgLogsChannel",
        "voiceLogsChannel",
        "welcomeChannel",
        "goodbyeChannel",
        "birthdayChannel",
        "welcomeMessage",
        "welcomeTitle",
        "welcomeGif",
        "welcomeTextChannel",
        "welcomeTextMessage",
        "goodbyeMessage",
        "welcomeDm",
        "welcomeDmMessage",
        "goodbyeDm",
        "goodbyeDmMessage",
        "sanctionDm",
        "sanctionDmMessage",
        "autoRole",
        "modRole",
        "dropChannels",
        "publicChannels",
        "levelChannel",
        "levelMessage",
        "joinPingChannels",
        "joinPingMode",
        "language",
        "suggestChannel",
      ];

      const cleanUpdates = {};
      const antiraidUpdates = {};

      allowedUpdates.forEach((key) => {
        if (updates[key] !== undefined) {
          const val =
            typeof updates[key] === "boolean"
              ? updates[key]
                ? 1
                : 0
              : updates[key];
          if (key === "prefix")
            cleanUpdates.prefix = String(updates.prefix || "+").substring(0, 5);
          else cleanUpdates[key] = val;
        }
      });

      // Mirror first joinPingChannels id into the legacy scalar
      // `joinPingChannel` column so the bot command (`+setjoinping`) shows the
      // same value the dashboard configured. The event handler unions both, so
      // mirroring keeps every reader consistent.
      if (cleanUpdates.joinPingChannels !== undefined) {
        const list = Array.isArray(cleanUpdates.joinPingChannels)
          ? cleanUpdates.joinPingChannels
          : parseJsonArray(cleanUpdates.joinPingChannels);
        cleanUpdates.joinPingChannel = list[0] || null;
      }

      ANTIRAID_FIELDS.forEach((key) => {
        if (updates[key] !== undefined) {
          const val =
            typeof updates[key] === "boolean"
              ? updates[key]
                ? 1
                : 0
              : updates[key];
          antiraidUpdates[key] = val;
        }
      });

      try {
        if (Object.keys(cleanUpdates).length > 0) {
          client.db.updateGuild(req.params.guildId, cleanUpdates);
          client.guildSettingsCache.delete(req.params.guildId);
          logDashboardAction(
            req.params.guildId,
            req.user.id,
            req.user.username,
            "UPDATE_GUILD_SETTINGS",
            cleanUpdates,
          );
        }

        if (Object.keys(antiraidUpdates).length > 0) {
          client.db.updateAntiraidConfig(req.params.guildId, antiraidUpdates);
          logDashboardAction(
            req.params.guildId,
            req.user.id,
            req.user.username,
            "UPDATE_ANTIRAID_CONFIG",
            antiraidUpdates,
          );
        }

        // Invalider tous les caches liés à ce serveur
        invalidateGuildCache(req.params.guildId);

        res.json({ success: true });
      } catch (error) {
        Logger.error(`[DASHBOARD UPDATE ERROR] reqId=${req.reqId}`, error);
        res
          .status(500)
          .json({
            error: t(req.lang, "dashboard.guilds.update_failed"),
            reqId: req.reqId,
          });
      }
    },
  );

  router.get(
    "/:guildId/stats-channels",
    requireAuth,
    requireGuildAdmin,
    (req, res) => {
      try {
        const config = client.db.getStatsConfig(req.params.guildId) || {};
        const guildSettings = client.db.getGuild(req.params.guildId);

        res.json({
          config,
          format: guildSettings.statsFormat || "・{emoji}・{name} :",
          membersFormat: guildSettings.statsMembersFormat || null,
          onlineFormat: guildSettings.statsOnlineFormat || null,
          vocalFormat: guildSettings.statsVocalFormat || null,
          topFormat: guildSettings.statsTopFormat || null,
          inviteFormat: guildSettings.statsInviteFormat || null,
        });
      } catch (error) {
        Logger.error(
          `[DASHBOARD STATS CONFIG GET ERROR] reqId=${req.reqId}`,
          error,
        );
        res
          .status(500)
          .json({
            error: t(req.lang, "dashboard.guilds.stats_config_failed"),
            reqId: req.reqId,
          });
      }
    },
  );

  router.patch(
    "/:guildId/stats-channels",
    requireAuth,
    requireGuildAdmin,
    (req, res) => {
      const {
        format,
        membersFormat,
        onlineFormat,
        vocalFormat,
        topFormat,
        inviteFormat,
        config,
      } = req.body;
      try {
        const guildUpdates = {};
        if (format !== undefined) guildUpdates.statsFormat = format;
        if (membersFormat !== undefined)
          guildUpdates.statsMembersFormat = membersFormat;
        if (onlineFormat !== undefined)
          guildUpdates.statsOnlineFormat = onlineFormat;
        if (vocalFormat !== undefined)
          guildUpdates.statsVocalFormat = vocalFormat;
        if (topFormat !== undefined) guildUpdates.statsTopFormat = topFormat;
        if (inviteFormat !== undefined)
          guildUpdates.statsInviteFormat = inviteFormat;

        if (Object.keys(guildUpdates).length > 0) {
          client.db.updateGuild(req.params.guildId, guildUpdates);
          client.guildSettingsCache.delete(req.params.guildId);
          invalidateGuildCache(req.params.guildId);
        }

        if (config) {
          client.db.saveStatsConfig(req.params.guildId, config);
        }

        logDashboardAction(
          req.params.guildId,
          req.user.id,
          req.user.username,
          "UPDATE_STATS_CHANNELS",
          { guildUpdates, config: config || null },
        );
        res.json({ success: true });
      } catch (error) {
        Logger.error(
          `[DASHBOARD STATS CONFIG PATCH ERROR] reqId=${req.reqId}`,
          error,
        );
        res
          .status(500)
          .json({
            error: t(req.lang, "dashboard.guilds.stats_update_failed"),
            reqId: req.reqId,
          });
      }
    },
  );

  router.post(
    "/:guildId/stats-channels/setup",
    requireAuth,
    requireGuildAdmin,
    async (req, res) => {
      try {
        const { inviteCode } = req.body;
        const cmd = client.commands.get("serverstats");
        if (!cmd)
          return res
            .status(501)
            .json({
              error: t(req.lang, "dashboard.guilds.serverstats_cmd_not_found"),
            });

        const mockMessage = {
          guild: req.guild,
          reply: async (msg) => {
            Logger.info(`[STATS SETUP] ${msg}`);
            return { channel: { send: () => {} } };
          },
          channel: {
            send: async (msg) => {
              Logger.info(`[STATS SETUP] ${msg}`);
            },
          },
          member: {
            permissions: new Set(["Administrator"]),
            roles: { highest: { position: 999 } },
          },
          author: { id: req.user.id, tag: req.user.username },
        };

        await cmd.execute(client, mockMessage, [inviteCode]);
        logDashboardAction(
          req.params.guildId,
          req.user.id,
          req.user.username,
          "STATS_CHANNELS_SETUP",
          { inviteCode: inviteCode || null },
        );
        res.json({ success: true });
      } catch (error) {
        Logger.error(`[STATS SETUP ERROR] reqId=${req.reqId}`, error);
        res.status(500).json({
          error: t(req.lang, "dashboard.guilds.stats_setup_failed"),
          reqId: req.reqId,
        });
      }
    },
  );

  router.get("/:guildId/roles", requireAuth, requireGuildAdmin, (req, res) => {
    try {
      const roles = req.guild.roles.cache
        .filter((r) => r.name !== "@everyone" && !r.managed)
        .map((r) => ({ id: r.id, name: r.name, color: r.hexColor }))
        .sort((a, b) => a.name.localeCompare(b.name));
      res.json(roles);
    } catch (error) {
      Logger.error(`[DASHBOARD ROLES GET ERROR] reqId=${req.reqId}`, error);
      res.status(500).json({
        error: t(req.lang, "dashboard.guilds.roles_fetch_failed"),
        reqId: req.reqId,
      });
    }
  });

  router.get(
    "/:guildId/permissions",
    requireAuth,
    requireGuildAdmin,
    (req, res) => {
      try {
        const perms = client.db.db
          .prepare(
            "SELECT roleId, commandName FROM role_permissions WHERE guildId = ?",
          )
          .all(req.params.guildId);
        const availableCommands = Array.from(client.commands.keys());
        res.json({ permissions: perms, availableCommands });
      } catch (error) {
        Logger.error(
          `[DASHBOARD PERMISSIONS GET ERROR] reqId=${req.reqId}`,
          error,
        );
        res
          .status(500)
          .json({
            error: t(req.lang, "dashboard.guilds.permissions_fetch_failed"),
            reqId: req.reqId,
          });
      }
    },
  );

  router.post(
    "/:guildId/permissions",
    requireAuth,
    requireGuildAdmin,
    (req, res) => {
      const { roleId, commandName, action } = req.body;
      if (typeof roleId !== "string" || !/^\d{17,20}$/.test(roleId.trim())) {
        return res
          .status(400)
          .json({ error: t(req.lang, "dashboard.guilds.role_id_invalid") });
      }
      // Restrict to plausible command identifiers: alnum + `_` + `-`, 1-32
      // chars. Matches CUSTOM_CMD_NAME_REGEX shape; native command names also
      // fit this class.
      if (
        typeof commandName !== "string" ||
        !/^[a-zA-Z0-9_-]{1,32}$/.test(commandName.trim())
      ) {
        return res
          .status(400)
          .json({ error: t(req.lang, "dashboard.guilds.command_name_invalid") });
      }
      if (!["add", "remove"].includes(action)) {
        return res
          .status(400)
          .json({ error: t(req.lang, "dashboard.guilds.action_invalid") });
      }
      try {
        if (action === "add") {
          client.db.db
            .prepare(
              "INSERT OR IGNORE INTO role_permissions (guildId, roleId, commandName) VALUES (?, ?, ?)",
            )
            .run(req.params.guildId, roleId, commandName);
        } else {
          client.db.db
            .prepare(
              "DELETE FROM role_permissions WHERE guildId = ? AND roleId = ? AND commandName = ?",
            )
            .run(req.params.guildId, roleId, commandName);
        }
        logDashboardAction(
          req.params.guildId,
          req.user.id,
          req.user.username,
          action === "add"
            ? "ROLE_PERMISSION_GRANT"
            : "ROLE_PERMISSION_REVOKE",
          { roleId, commandName },
        );
        res.json({ success: true });
      } catch (error) {
        Logger.error(
          `[DASHBOARD PERMISSIONS ERROR] reqId=${req.reqId}`,
          error,
        );
        res.status(500).json({
          error: t(req.lang, "dashboard.guilds.permissions_update_failed"),
          reqId: req.reqId,
        });
      }
    },
  );

  router.get(
    "/:guildId/stats",
    requireAuth,
    requireGuildAdmin,
    async (req, res) => {
      const { guildId } = req.params;
      const guild = client.guilds.cache.get(guildId);

      if (!guild)
        return res
          .status(404)
          .json({ error: t(req.lang, "dashboard.guilds.server_not_found") });

      try {
        const topCommands = client.db.getTopCommands(guildId, 5);
        const historicalStats = client.db.getHistoricalStats(guildId, 7);
        const levelDistribution = client.db.getMemberLevelDistribution(guildId);

        const warnings = client.db.db
          .prepare("SELECT COUNT(*) as count FROM warnings WHERE guildId = ?")
          .get(guildId);

        res.json({
          guild: {
            name: guild.name,
            memberCount: guild.memberCount,
            icon: guild.iconURL(),
            ping: client.ws.ping,
            ownerTag:
              client.users.cache.get(guild.ownerId)?.tag || "Owner Inconnu",
          },
          topCommands: topCommands,
          history: historicalStats,
          levelDistribution: levelDistribution,
          moderationCount: warnings?.count || 0,
        });
      } catch (error) {
        Logger.error(`[DASHBOARD STATS ERROR] reqId=${req.reqId}`, error);
        res.status(500).json({
          error: t(req.lang, "dashboard.guilds.stats_fetch_failed"),
          reqId: req.reqId,
        });
      }
    },
  );

  router.get(
    "/:guildId/members/search",
    requireAuth,
    requireGuildAdmin,
    async (req, res) => {
      const { guildId } = req.params;
      const { q } = req.query;

      if (!q || q.length < 2) return res.json([]);

      const guild = client.guilds.cache.get(guildId);
      if (!guild)
        return res
          .status(404)
          .json({ error: t(req.lang, "dashboard.guilds.server_not_found") });

      try {
        await guild.members.fetch();

        const query = q.toLowerCase();
        const members = guild.members.cache
          .filter(
            (m) =>
              !m.user.bot &&
              (m.user.username.toLowerCase().includes(query) ||
                m.id === query ||
                (m.nickname && m.nickname.toLowerCase().includes(query))),
          )
          .first(10);

        const results = members.map((m) => ({
          id: m.user.id,
          username: m.user.username,
          avatar: m.user.displayAvatarURL({ dynamic: true }),
        }));

        res.json(results);
      } catch (error) {
        Logger.error(
          `[DASHBOARD MEMBER SEARCH ERROR] reqId=${req.reqId}`,
          error,
        );
        res.status(500).json({
          error: t(req.lang, "dashboard.guilds.member_search_failed"),
          reqId: req.reqId,
        });
      }
    },
  );

  router.post(
    "/:guildId/logs/setup",
    requireAuth,
    requireGuildAdmin,
    async (req, res) => {
      const guild = req.guild;
      if (!guild)
        return res
          .status(404)
          .json({ error: t(req.lang, "dashboard.guilds.guild_not_found") });

      const { categoryName, channels: customChannels } = req.body;

      try {
        const category = await guild.channels.create({
          name: categoryName || "LOGS (AUTO-SETUP)",
          type: 4,
          permissionOverwrites: [
            {
              id: guild.roles.everyone.id,
              deny: [PermissionsBitField.Flags.ViewChannel],
            },
          ],
        });

        const createLog = async (name, defaultName) => {
          const c = await guild.channels.create({
            name: name || defaultName,
            type: 0,
            parent: category.id,
          });
          return c.id;
        };

        const modLogId = await createLog(customChannels?.mod, "mod-logs");
        const raidLogId = await createLog(customChannels?.raid, "raid-logs");
        const msgLogId = await createLog(customChannels?.msg, "msg-logs");
        const voiceLogId = await createLog(customChannels?.voice, "voice-logs");

        const updates = {
          modLogsChannel: modLogId,
          raidLogsChannel: raidLogId,
          msgLogsChannel: msgLogId,
          voiceLogsChannel: voiceLogId,
        };
        client.db.updateGuild(guild.id, updates);
        client.guildSettingsCache.delete(guild.id);
        invalidateGuildCache(guild.id);

        logDashboardAction(
          guild.id,
          req.user.id,
          req.user.username,
          "LOGS_SETUP",
          { categoryName: categoryName || null, updates },
        );
        res.json({ success: true, updates });
      } catch (error) {
        Logger.error(
          `[DASHBOARD LOGS SETUP ERROR] reqId=${req.reqId}`,
          error,
        );
        res.status(500).json({
          error: t(req.lang, "dashboard.guilds.logs_setup_failed"),
          reqId: req.reqId,
        });
      }
    },
  );

  router.get(
    "/:guildId/audit-logs",
    requireAuth,
    requireGuildAdmin,
    (req, res) => {
      try {
        // Pagination + optional filters (action / userId / since)
        const limit = Math.min(
          200,
          Math.max(1, parseInt(req.query.limit, 10) || 50),
        );
        const offset = Math.max(0, parseInt(req.query.offset, 10) || 0);
        const { action, userId, since } = req.query;

        const where = ["guildId = ?"];
        const args = [req.params.guildId];
        if (typeof action === "string" && action.trim()) {
          where.push("action = ?");
          args.push(action.trim());
        }
        if (typeof userId === "string" && /^\d{17,20}$/.test(userId.trim())) {
          where.push("userId = ?");
          args.push(userId.trim());
        }
        const sinceNum = parseInt(since, 10);
        if (!isNaN(sinceNum) && sinceNum > 0) {
          where.push("timestamp >= ?");
          args.push(sinceNum);
        }

        const baseSql = `FROM dashboard_audit_logs WHERE ${where.join(" AND ")}`;
        const total = client.db.db
          .prepare(`SELECT COUNT(*) AS c ${baseSql}`)
          .get(...args).c;
        const logs = client.db.db
          .prepare(
            `SELECT * ${baseSql} ORDER BY timestamp DESC LIMIT ? OFFSET ?`,
          )
          .all(...args, limit, offset);
        res.json({ logs, total, limit, offset });
      } catch (error) {
        Logger.error(
          `[DASHBOARD AUDIT LOGS GET ERROR] reqId=${req.reqId}`,
          error,
        );
        res.status(500).json({
          error: t(req.lang, "dashboard.guilds.audit_logs_fetch_failed"),
          reqId: req.reqId,
        });
      }
    },
  );

  router.get(
    "/:guildId/badwords",
    requireAuth,
    requireGuildAdmin,
    (req, res) => {
      try {
        const words = client.db
          .getBadwords(req.params.guildId)
          .map((row) => row.word);
        res.json(words);
      } catch (error) {
        Logger.error(
          `[DASHBOARD BADWORDS GET ERROR] reqId=${req.reqId}`,
          error,
        );
        res.status(500).json({
          error: t(req.lang, "dashboard.guilds.badwords_fetch_failed"),
          reqId: req.reqId,
        });
      }
    },
  );

  router.post(
    "/:guildId/badwords",
    requireAuth,
    requireGuildAdmin,
    (req, res) => {
      const word = String(req.body.word || "")
        .trim()
        .toLowerCase();
      if (!word)
        return res
          .status(400)
          .json({ error: t(req.lang, "dashboard.guilds.word_invalid") });

      try {
        client.db.addBadword(req.params.guildId, word);
        invalidateGuildCache(req.params.guildId);
        if (client.invalidateGuildConfig)
          client.invalidateGuildConfig(req.params.guildId);
        logDashboardAction(
          req.params.guildId,
          req.user.id,
          req.user.username,
          "BADWORD_ADD",
          { word },
        );
        res.json({ success: true, word });
      } catch (error) {
        Logger.error(
          `[DASHBOARD BADWORDS ADD ERROR] reqId=${req.reqId}`,
          error,
        );
        res
          .status(500)
          .json({
            error: t(req.lang, "dashboard.guilds.badword_add_failed"),
            reqId: req.reqId,
          });
      }
    },
  );

  router.delete(
    "/:guildId/badwords/:word",
    requireAuth,
    requireGuildAdmin,
    (req, res) => {
      const word = decodeURIComponent(req.params.word || "")
        .trim()
        .toLowerCase();
      if (!word)
        return res
          .status(400)
          .json({ error: t(req.lang, "dashboard.guilds.word_invalid") });

      try {
        client.db.removeBadword(req.params.guildId, word);
        invalidateGuildCache(req.params.guildId);
        if (client.invalidateGuildConfig)
          client.invalidateGuildConfig(req.params.guildId);
        logDashboardAction(
          req.params.guildId,
          req.user.id,
          req.user.username,
          "BADWORD_REMOVE",
          { word },
        );
        res.json({ success: true });
      } catch (error) {
        Logger.error(
          `[DASHBOARD BADWORDS DELETE ERROR] reqId=${req.reqId}`,
          error,
        );
        res
          .status(500)
          .json({
            error: t(req.lang, "dashboard.guilds.badword_remove_failed"),
            reqId: req.reqId,
          });
      }
    },
  );

  router.get(
    "/:guildId/giveaways",
    requireAuth,
    requireGuildAdmin,
    (req, res) => {
      try {
        const giveaways = client.db.db
          .prepare(
            "SELECT * FROM giveaways WHERE guildId = ? ORDER BY endsAt DESC",
          )
          .all(req.params.guildId);
        res.json(
          giveaways.map((giveaway) => ({
            ...giveaway,
            requirements: parseJsonArray(giveaway.requirements),
            winners: parseJsonArray(giveaway.winners),
          })),
        );
      } catch (error) {
        Logger.error(
          `[DASHBOARD GIVEAWAYS GET ERROR] reqId=${req.reqId}`,
          error,
        );
        res.status(500).json({
          error: t(req.lang, "dashboard.guilds.giveaways_fetch_failed"),
          reqId: req.reqId,
        });
      }
    },
  );

  router.post(
    "/:guildId/giveaways",
    requireAuth,
    requireGuildAdmin,
    async (req, res) => {
      const { prize, winnersCount, duration, channelId, requirements } =
        req.body;
      if (typeof channelId !== "string" || !channelId.trim()) {
        return res
          .status(400)
          .json({ error: t(req.lang, "dashboard.guilds.channel_id_invalid") });
      }
      if (
        winnersCount !== undefined &&
        (isNaN(parseInt(winnersCount, 10)) || parseInt(winnersCount, 10) < 1)
      ) {
        return res
          .status(400)
          .json({ error: t(req.lang, "dashboard.guilds.winners_count_invalid") });
      }
      if (duration !== undefined && isNaN(parseInt(duration, 10))) {
        return res
          .status(400)
          .json({ error: t(req.lang, "dashboard.guilds.duration_invalid") });
      }
      const guild = req.guild;
      const channel = guild.channels.cache.get(channelId);

      if (!channel)
        return res
          .status(404)
          .json({ error: t(req.lang, "dashboard.guilds.channel_not_found") });
      if (!prize || !String(prize).trim())
        return res
          .status(400)
          .json({ error: t(req.lang, "dashboard.guilds.prize_invalid") });

      try {
        const giveawayUtils = require("../../utils/giveaways");
        const result = await giveawayUtils.createGiveaway(client, {
          channel,
          guild,
          prize,
          winnersCount,
          durationMs: Math.max(1, parseInt(duration) || 60) * 60 * 1000,
          hostId: req.user.id,
          requirements: Array.isArray(requirements) ? requirements : [],
        });

        logDashboardAction(
          req.params.guildId,
          req.user.id,
          req.user.username,
          "GIVEAWAY_CREATE",
          {
            messageId: result.message.id,
            prize,
            winnersCount: parseInt(winnersCount, 10) || 1,
            channelId,
            durationMinutes: parseInt(duration, 10) || 60,
            requirements: Array.isArray(requirements) ? requirements : [],
          },
        );
        res.json({ success: true, messageId: result.message.id });
      } catch (error) {
        Logger.error(
          `[DASHBOARD GIVEAWAY CREATE ERROR] reqId=${req.reqId}`,
          error,
        );
        res.status(500).json({
          error: t(req.lang, "dashboard.guilds.giveaway_create_failed"),
          reqId: req.reqId,
        });
      }
    },
  );

  router.get(
    "/:guildId/suggestions",
    requireAuth,
    requireGuildAdmin,
    (req, res) => {
      const { guildId } = req.params;
      try {
        ensureSuggestionTables(client);
        const settings = client.db.getGuild(guildId);
        let rows = [];
        try {
          rows = client.db.db
            .prepare(
              "SELECT msgId, guildId, userId, status FROM suggestions WHERE guildId = ? ORDER BY rowid DESC LIMIT 200",
            )
            .all(guildId);
        } catch (e) {
          rows = [];
        }

        const tallyStmt = client.db.db.prepare(
          "SELECT vote, COUNT(*) AS c FROM suggestion_votes WHERE msgId = ? GROUP BY vote",
        );

        const suggestions = rows.map((row) => {
          const counts = { up: 0, down: 0, mid: 0 };
          try {
            for (const r of tallyStmt.all(row.msgId)) {
              if (counts[r.vote] !== undefined) counts[r.vote] = r.c;
            }
          } catch (e) {}
          return {
            msgId: row.msgId,
            guildId: row.guildId,
            userId: row.userId,
            status: row.status || null,
            votes: counts,
          };
        });

        res.json({
          suggestChannel: settings.suggestChannel || null,
          suggestions,
        });
      } catch (error) {
        Logger.error(
          `[DASHBOARD SUGGESTIONS GET ERROR] reqId=${req.reqId}`,
          error,
        );
        res.status(500).json({
          error: t(req.lang, "dashboard.guilds.suggestions_fetch_failed"),
          reqId: req.reqId,
        });
      }
    },
  );

  router.patch(
    "/:guildId/suggestions/channel",
    requireAuth,
    requireGuildAdmin,
    (req, res) => {
      const { channelId } = req.body;
      const value =
        channelId === null || channelId === ""
          ? null
          : typeof channelId === "string"
            ? channelId.trim()
            : null;

      if (value !== null && !/^\d{5,30}$/.test(value)) {
        return res
          .status(400)
          .json({ error: t(req.lang, "dashboard.guilds.channel_id_invalid") });
      }

      try {
        client.db.updateGuild(req.params.guildId, { suggestChannel: value });
        if (client.guildSettingsCache)
          client.guildSettingsCache.delete(req.params.guildId);
        invalidateGuildCache(req.params.guildId);
        logDashboardAction(
          req.params.guildId,
          req.user.id,
          req.user.username,
          "UPDATE_SUGGEST_CHANNEL",
          { suggestChannel: value },
        );
        res.json({ success: true, suggestChannel: value });
      } catch (error) {
        Logger.error(
          `[DASHBOARD SUGGESTIONS CHANNEL ERROR] reqId=${req.reqId}`,
          error,
        );
        res.status(500).json({
          error: t(req.lang, "dashboard.guilds.suggest_channel_update_failed"),
          reqId: req.reqId,
        });
      }
    },
  );

  router.patch(
    "/:guildId/suggestions/:msgId/status",
    requireAuth,
    requireGuildAdmin,
    (req, res) => {
      const { msgId } = req.params;
      const status = String(req.body.status || "").toLowerCase();

      if (!SUGGESTION_STATUS.has(status)) {
        return res.status(400).json({
          error: t(req.lang, "dashboard.guilds.status_invalid"),
        });
      }

      try {
        ensureSuggestionTables(client);
        const row = client.db.db
          .prepare(
            "SELECT msgId FROM suggestions WHERE msgId = ? AND guildId = ?",
          )
          .get(msgId, req.params.guildId);
        if (!row) {
          return res
            .status(404)
            .json({
              error: t(req.lang, "dashboard.guilds.suggestion_not_found"),
            });
        }
        client.db.db
          .prepare(
            "UPDATE suggestions SET status = ? WHERE msgId = ? AND guildId = ?",
          )
          .run(status, msgId, req.params.guildId);
        logDashboardAction(
          req.params.guildId,
          req.user.id,
          req.user.username,
          "UPDATE_SUGGESTION_STATUS",
          { msgId, status },
        );
        res.json({ success: true, msgId, status });
      } catch (error) {
        Logger.error(
          `[DASHBOARD SUGGESTIONS STATUS ERROR] reqId=${req.reqId}`,
          error,
        );
        res.status(500).json({
          error: t(req.lang, "dashboard.guilds.suggestion_status_update_failed"),
          reqId: req.reqId,
        });
      }
    },
  );

  // -------- Invites: counts per user --------
  const parseInvitesBlob = (raw) => {
    const base = { regular: 0, bonus: 0, leaves: 0, fake: 0, total: 0 };
    if (!raw) return base;
    if (typeof raw === "object" && !Array.isArray(raw))
      return { ...base, ...raw };
    if (typeof raw === "string") {
      try {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === "object") return { ...base, ...parsed };
      } catch (e) {}
    }
    return base;
  };

  const recomputeTotal = (inv) =>
    (inv.regular || 0) +
    (inv.bonus || 0) -
    (inv.leaves || 0) -
    (inv.fake || 0);

  router.get(
    "/:guildId/invites",
    requireAuth,
    requireGuildAdmin,
    (req, res) => {
      try {
        const rows = client.db.getAllInviteData(req.params.guildId) || [];
        const data = rows.map((row) => {
          const inv = {
            regular: row.regular || 0,
            bonus: row.bonus || 0,
            leaves: row.leaves || 0,
            fake: row.fake || 0,
          };
          inv.total = recomputeTotal(inv);
          return { userId: row.userId, tag: row.tag || null, ...inv };
        });
        res.json(data);
      } catch (error) {
        Logger.error(
          `[DASHBOARD INVITES LIST ERROR] reqId=${req.reqId}`,
          error,
        );
        res
          .status(500)
          .json({
            error: t(req.lang, "dashboard.guilds.invites_fetch_failed"),
            reqId: req.reqId,
          });
      }
    },
  );

  router.get(
    "/:guildId/invites/:userId",
    requireAuth,
    requireGuildAdmin,
    (req, res) => {
      try {
        const inv = parseInvitesBlob(
          client.db.getUser(req.params.userId, req.params.guildId, "invites"),
        );
        const inviteData =
          client.db.getUser(
            req.params.userId,
            req.params.guildId,
            "inviteData",
          ) || null;
        inv.total = recomputeTotal(inv);
        res.json({ userId: req.params.userId, ...inv, inviteData });
      } catch (error) {
        Logger.error(
          `[DASHBOARD INVITES GET ERROR] reqId=${req.reqId}`,
          error,
        );
        res
          .status(500)
          .json({
            error: t(req.lang, "dashboard.guilds.invites_fetch_failed"),
            reqId: req.reqId,
          });
      }
    },
  );

  router.patch(
    "/:guildId/invites/:userId",
    requireAuth,
    requireGuildAdmin,
    (req, res) => {
      const { regular, bonus, leaves, fake } = req.body || {};
      const sanitize = (v) => {
        if (v === undefined || v === null) return undefined;
        const n = parseInt(v, 10);
        if (isNaN(n) || n < 0) return undefined;
        return n;
      };
      const updates = {
        regular: sanitize(regular),
        bonus: sanitize(bonus),
        leaves: sanitize(leaves),
        fake: sanitize(fake),
      };

      try {
        const current = parseInvitesBlob(
          client.db.getUser(req.params.userId, req.params.guildId, "invites"),
        );
        ["regular", "bonus", "leaves", "fake"].forEach((k) => {
          if (updates[k] !== undefined) current[k] = updates[k];
        });
        current.total = recomputeTotal(current);
        client.db.updateUser(
          req.params.userId,
          req.params.guildId,
          "invites",
          current,
        );
        logDashboardAction(
          req.params.guildId,
          req.user.id,
          req.user.username,
          "UPDATE_USER_INVITES",
          { userId: req.params.userId, ...current },
        );
        res.json({ success: true, userId: req.params.userId, ...current });
      } catch (error) {
        Logger.error(
          `[DASHBOARD INVITES PATCH ERROR] reqId=${req.reqId}`,
          error,
        );
        res
          .status(500)
          .json({
            error: t(req.lang, "dashboard.guilds.invites_update_failed"),
            reqId: req.reqId,
          });
      }
    },
  );

  router.post(
    "/:guildId/invites/:userId/clear",
    requireAuth,
    requireGuildAdmin,
    (req, res) => {
      try {
        const cleared = { regular: 0, bonus: 0, leaves: 0, fake: 0, total: 0 };
        client.db.updateUser(
          req.params.userId,
          req.params.guildId,
          "invites",
          cleared,
        );
        logDashboardAction(
          req.params.guildId,
          req.user.id,
          req.user.username,
          "CLEAR_USER_INVITES",
          { userId: req.params.userId },
        );
        res.json({ success: true, userId: req.params.userId, ...cleared });
      } catch (error) {
        Logger.error(
          `[DASHBOARD INVITES CLEAR ERROR] reqId=${req.reqId}`,
          error,
        );
        res
          .status(500)
          .json({
            error: t(req.lang, "dashboard.guilds.invites_reset_failed"),
            reqId: req.reqId,
          });
      }
    },
  );

  // -------- Invite lock per guild --------
  const normalizeLockStatus = (raw) => {
    if (raw && typeof raw === "object" && !Array.isArray(raw)) return raw;
    if (typeof raw === "number") return { enabled: raw === 1 };
    if (typeof raw === "string") {
      try {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === "object" && !Array.isArray(parsed))
          return parsed;
      } catch (e) {}
    }
    return {};
  };

  router.get(
    "/:guildId/invite-lock",
    requireAuth,
    requireGuildAdmin,
    (req, res) => {
      try {
        const lock = normalizeLockStatus(
          client.db.getGuild(req.params.guildId, "lockInvite"),
        );
        res.json({
          enabled: !!lock.enabled,
          reason: lock.reason || null,
          by: lock.by || null,
          at: lock.at || null,
        });
      } catch (error) {
        Logger.error(
          `[DASHBOARD INVITE LOCK GET ERROR] reqId=${req.reqId}`,
          error,
        );
        res
          .status(500)
          .json({
            error: t(req.lang, "dashboard.guilds.invite_lock_fetch_failed"),
            reqId: req.reqId,
          });
      }
    },
  );

  router.patch(
    "/:guildId/invite-lock",
    requireAuth,
    requireGuildAdmin,
    (req, res) => {
      const { enabled, reason } = req.body || {};
      try {
        const current = normalizeLockStatus(
          client.db.getGuild(req.params.guildId, "lockInvite"),
        );
        if (typeof enabled === "boolean") current.enabled = enabled;
        if (typeof reason === "string") current.reason = reason;
        current.by = req.user.id;
        current.at = new Date().toISOString();
        client.db.updateGuild(req.params.guildId, { lockInvite: current });
        if (client.guildSettingsCache)
          client.guildSettingsCache.delete(req.params.guildId);
        invalidateGuildCache(req.params.guildId);
        logDashboardAction(
          req.params.guildId,
          req.user.id,
          req.user.username,
          "UPDATE_INVITE_LOCK",
          current,
        );
        res.json({ success: true, ...current });
      } catch (error) {
        Logger.error(
          `[DASHBOARD INVITE LOCK PATCH ERROR] reqId=${req.reqId}`,
          error,
        );
        res
          .status(500)
          .json({
            error: t(req.lang, "dashboard.guilds.invite_lock_update_failed"),
            reqId: req.reqId,
          });
      }
    },
  );

  // ===================== BACKUPS =====================

  router.get(
    "/:guildId/backups",
    requireAuth,
    requireGuildAdmin,
    (req, res) => {
      try {
        const dir = getBackupDir();
        if (!fs.existsSync(dir)) return res.json([]);
        const files = fs.readdirSync(dir).filter((f) => f.endsWith(".json"));
        const entries = files
          .map((f) => {
            const id = f.replace(".json", "");
            if (!BACKUP_ID_REGEX.test(id)) return null;
            const full = path.join(dir, f);
            let size = 0;
            let createdBy = null;
            let createdAt = null;
            let name = null;
            let counts = { roles: 0, categories: 0, channels: 0 };
            try {
              size = fs.statSync(full).size;
            } catch (e) {}
            try {
              const raw = JSON.parse(fs.readFileSync(full, "utf8"));
              createdBy = raw.createdBy || null;
              createdAt = raw.createdAt || parseInt(id, 10) || null;
              name = raw.name || null;
              counts = {
                roles: (raw.roles || []).length,
                categories: (raw.categories || []).length,
                channels:
                  (raw.channels || []).length +
                  (raw.categories || []).reduce(
                    (a, b) => a + (b.children || []).length,
                    0,
                  ),
              };
            } catch (e) {}
            return { id, size, createdBy, createdAt, name, counts };
          })
          .filter(Boolean)
          .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
        res.json(entries);
      } catch (error) {
        Logger.error(
          `[DASHBOARD BACKUPS LIST ERROR] reqId=${req.reqId}`,
          error,
        );
        res.status(500).json({
          error: t(req.lang, "dashboard.guilds.backups_fetch_failed"),
          reqId: req.reqId,
        });
      }
    },
  );

  router.post(
    "/:guildId/backups",
    requireAuth,
    requireGuildAdmin,
    async (req, res) => {
      try {
        const guild = req.guild;
        const backupData = await snapshotGuild(guild, req.user.id);
        const backupId = Date.now().toString();
        const dir = getBackupDir();
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        const full = path.join(dir, `${backupId}.json`);
        fs.writeFileSync(full, JSON.stringify(backupData, null, 2));

        const totalChannels =
          backupData.channels.length +
          backupData.categories.reduce((a, b) => a + b.children.length, 0);

        logDashboardAction(
          req.params.guildId,
          req.user.id,
          req.user.username,
          "BACKUP_CREATE",
          {
            backupId,
            roles: backupData.roles.length,
            categories: backupData.categories.length,
            channels: totalChannels,
          },
        );
        res.json({
          success: true,
          backupId,
          counts: {
            roles: backupData.roles.length,
            categories: backupData.categories.length,
            channels: totalChannels,
          },
        });
      } catch (error) {
        Logger.error(
          `[DASHBOARD BACKUP CREATE ERROR] reqId=${req.reqId}`,
          error,
        );
        res
          .status(500)
          .json({
            error: t(req.lang, "dashboard.guilds.backup_create_failed"),
            reqId: req.reqId,
          });
      }
    },
  );

  router.post(
    "/:guildId/backups/:id/restore",
    requireAuth,
    requireGuildAdmin,
    async (req, res) => {
      const { id } = req.params;
      const full = safeBackupPath(id);
      if (!full) {
        return res
          .status(400)
          .json({ error: t(req.lang, "dashboard.guilds.id_invalid") });
      }
      if (!fs.existsSync(full)) {
        return res
          .status(404)
          .json({ error: t(req.lang, "dashboard.guilds.backup_not_found") });
      }
      let backupData;
      try {
        backupData = JSON.parse(fs.readFileSync(full, "utf8"));
      } catch (e) {
        return res
          .status(409)
          .json({ error: t(req.lang, "dashboard.guilds.backup_corrupted") });
      }
      // Audit BEFORE running the destructive op so we capture the intent
      // even if Discord rate-limits or interrupts the restore midway.
      Logger.warn(
        `[DASHBOARD BACKUP RESTORE] guild=${req.params.guildId} backup=${id} initiator=${req.user.id} (${req.user.username})`,
      );
      logDashboardAction(
        req.params.guildId,
        req.user.id,
        req.user.username,
        "BACKUP_RESTORE",
        {
          backupId: id,
          roles: (backupData.roles || []).length,
          categories: (backupData.categories || []).length,
          channels:
            (backupData.channels || []).length +
            (backupData.categories || []).reduce(
              (a, b) => a + (b.children || []).length,
              0,
            ),
        },
      );

      try {
        // Run async; respond immediately because restore can take minutes.
        restoreGuild(req.guild, backupData).catch((err) => {
          Logger.error(
            `[DASHBOARD BACKUP RESTORE RUNTIME ERROR] reqId=${req.reqId}`,
            err,
          );
        });
        res.status(200).json({ success: true, backupId: id, started: true });
      } catch (error) {
        Logger.error(
          `[DASHBOARD BACKUP RESTORE ERROR] reqId=${req.reqId}`,
          error,
        );
        res.status(500).json({
          error: t(req.lang, "dashboard.guilds.backup_restore_failed"),
          reqId: req.reqId,
        });
      }
    },
  );

  router.delete(
    "/:guildId/backups/:id",
    requireAuth,
    requireGuildAdmin,
    (req, res) => {
      const { id } = req.params;
      const full = safeBackupPath(id);
      if (!full) {
        return res
          .status(400)
          .json({ error: t(req.lang, "dashboard.guilds.id_invalid") });
      }
      if (!fs.existsSync(full)) {
        return res
          .status(404)
          .json({ error: t(req.lang, "dashboard.guilds.backup_not_found") });
      }
      try {
        fs.unlinkSync(full);
        logDashboardAction(
          req.params.guildId,
          req.user.id,
          req.user.username,
          "BACKUP_DELETE",
          { backupId: id },
        );
        res.json({ success: true });
      } catch (error) {
        Logger.error(
          `[DASHBOARD BACKUP DELETE ERROR] reqId=${req.reqId}`,
          error,
        );
        res.status(500).json({
          error: t(req.lang, "dashboard.guilds.backup_delete_failed"),
          reqId: req.reqId,
        });
      }
    },
  );

  // ===================== CUSTOM COMMANDS =====================

  const CUSTOM_CMD_NAME_REGEX = /^[a-z0-9_-]{1,32}$/;

  router.get(
    "/:guildId/custom-commands",
    requireAuth,
    requireGuildAdmin,
    (req, res) => {
      try {
        const rows = client.db.getCustomCommands(req.params.guildId) || [];
        res.json(
          rows.map((r) => ({
            id: r.id,
            name: r.name,
            response: r.response,
          })),
        );
      } catch (error) {
        Logger.error(
          `[DASHBOARD CUSTOM CMD LIST ERROR] reqId=${req.reqId}`,
          error,
        );
        res.status(500).json({
          error: t(req.lang, "dashboard.guilds.custom_cmds_fetch_failed"),
          reqId: req.reqId,
        });
      }
    },
  );

  router.post(
    "/:guildId/custom-commands",
    requireAuth,
    requireGuildAdmin,
    (req, res) => {
      const name = String(req.body.name || "")
        .trim()
        .toLowerCase();
      const response = String(req.body.response || "").trim();
      if (!CUSTOM_CMD_NAME_REGEX.test(name)) {
        return res.status(400).json({
          error: t(req.lang, "dashboard.guilds.custom_cmd_name_invalid"),
        });
      }
      if (!response || response.length > 2000) {
        return res
          .status(400)
          .json({ error: t(req.lang, "dashboard.guilds.response_invalid") });
      }
      if (client.commands.has(name) || client.aliases?.has(name)) {
        return res
          .status(409)
          .json({ error: t(req.lang, "dashboard.guilds.name_reserved") });
      }
      try {
        const existing = client.db.getCustomCommand(req.params.guildId, name);
        if (existing) {
          return res
            .status(409)
            .json({ error: t(req.lang, "dashboard.guilds.command_exists") });
        }
        client.db.addCustomCommand(req.params.guildId, name, response);
        logDashboardAction(
          req.params.guildId,
          req.user.id,
          req.user.username,
          "CUSTOM_CMD_ADD",
          { name, length: response.length },
        );
        res.json({ success: true, name, response });
      } catch (error) {
        Logger.error(
          `[DASHBOARD CUSTOM CMD ADD ERROR] reqId=${req.reqId}`,
          error,
        );
        res.status(500).json({
          error: t(req.lang, "dashboard.guilds.custom_cmd_create_failed"),
          reqId: req.reqId,
        });
      }
    },
  );

  router.patch(
    "/:guildId/custom-commands/:name",
    requireAuth,
    requireGuildAdmin,
    (req, res) => {
      const name = String(req.params.name || "")
        .trim()
        .toLowerCase();
      const response = String(req.body.response || "").trim();
      if (!CUSTOM_CMD_NAME_REGEX.test(name)) {
        return res
          .status(400)
          .json({ error: t(req.lang, "dashboard.guilds.name_invalid") });
      }
      if (!response || response.length > 2000) {
        return res
          .status(400)
          .json({ error: t(req.lang, "dashboard.guilds.response_invalid") });
      }
      try {
        const existing = client.db.getCustomCommand(req.params.guildId, name);
        if (!existing) {
          return res
            .status(404)
            .json({ error: t(req.lang, "dashboard.guilds.command_not_found") });
        }
        client.db.addCustomCommand(req.params.guildId, name, response);
        logDashboardAction(
          req.params.guildId,
          req.user.id,
          req.user.username,
          "CUSTOM_CMD_EDIT",
          { name, length: response.length },
        );
        res.json({ success: true, name, response });
      } catch (error) {
        Logger.error(
          `[DASHBOARD CUSTOM CMD EDIT ERROR] reqId=${req.reqId}`,
          error,
        );
        res.status(500).json({
          error: t(req.lang, "dashboard.guilds.custom_cmd_edit_failed"),
          reqId: req.reqId,
        });
      }
    },
  );

  router.delete(
    "/:guildId/custom-commands/:name",
    requireAuth,
    requireGuildAdmin,
    (req, res) => {
      const name = String(req.params.name || "")
        .trim()
        .toLowerCase();
      if (!CUSTOM_CMD_NAME_REGEX.test(name)) {
        return res
          .status(400)
          .json({ error: t(req.lang, "dashboard.guilds.name_invalid") });
      }
      try {
        const existing = client.db.getCustomCommand(req.params.guildId, name);
        if (!existing) {
          return res
            .status(404)
            .json({ error: t(req.lang, "dashboard.guilds.command_not_found") });
        }
        client.db.deleteCustomCommand(req.params.guildId, name);
        logDashboardAction(
          req.params.guildId,
          req.user.id,
          req.user.username,
          "CUSTOM_CMD_DELETE",
          { name },
        );
        res.json({ success: true });
      } catch (error) {
        Logger.error(
          `[DASHBOARD CUSTOM CMD DELETE ERROR] reqId=${req.reqId}`,
          error,
        );
        res.status(500).json({
          error: t(req.lang, "dashboard.guilds.custom_cmd_delete_failed"),
          reqId: req.reqId,
        });
      }
    },
  );

  // ===================== VERIFY CONFIG =====================

  const SNOWFLAKE_REGEX = /^\d{17,20}$/;

  router.get(
    "/:guildId/verify-config",
    requireAuth,
    requireGuildAdmin,
    (req, res) => {
      try {
        const row = client.db.getVerifyConfig(req.params.guildId) || {};
        res.json({
          roleId: row.roleId || null,
          channelId: row.channelId || null,
        });
      } catch (error) {
        Logger.error(`[DASHBOARD VERIFY GET ERROR] reqId=${req.reqId}`, error);
        res.status(500).json({
          error: t(req.lang, "dashboard.guilds.verify_config_fetch_failed"),
          reqId: req.reqId,
        });
      }
    },
  );

  router.patch(
    "/:guildId/verify-config",
    requireAuth,
    requireGuildAdmin,
    (req, res) => {
      const { roleId, channelId } = req.body || {};
      const normalize = (v) => {
        if (v === null || v === undefined || v === "") return null;
        if (typeof v !== "string") return undefined;
        const t = v.trim();
        return SNOWFLAKE_REGEX.test(t) ? t : undefined;
      };
      const rId = normalize(roleId);
      const cId = normalize(channelId);
      if (roleId !== undefined && rId === undefined) {
        return res
          .status(400)
          .json({ error: t(req.lang, "dashboard.guilds.role_id_invalid") });
      }
      if (channelId !== undefined && cId === undefined) {
        return res
          .status(400)
          .json({ error: t(req.lang, "dashboard.guilds.channel_id_invalid") });
      }
      try {
        const current = client.db.getVerifyConfig(req.params.guildId) || {};
        const finalRole = roleId !== undefined ? rId : current.roleId || null;
        const finalChannel =
          channelId !== undefined ? cId : current.channelId || null;
        client.db.db
          .prepare(
            "INSERT OR REPLACE INTO verify_config (guildId, roleId, channelId) VALUES (?, ?, ?)",
          )
          .run(req.params.guildId, finalRole, finalChannel);
        invalidateGuildCache(req.params.guildId);
        if (client.invalidateGuildConfig)
          client.invalidateGuildConfig(req.params.guildId);
        logDashboardAction(
          req.params.guildId,
          req.user.id,
          req.user.username,
          "UPDATE_VERIFY_CONFIG",
          { roleId: finalRole, channelId: finalChannel },
        );
        res.json({
          success: true,
          roleId: finalRole,
          channelId: finalChannel,
        });
      } catch (error) {
        Logger.error(
          `[DASHBOARD VERIFY PATCH ERROR] reqId=${req.reqId}`,
          error,
        );
        res.status(500).json({
          error: t(req.lang, "dashboard.guilds.verify_config_update_failed"),
          reqId: req.reqId,
        });
      }
    },
  );

  // ===================== FIVEM =====================

  // Same regex as `+fivem` to keep dashboard parity. Allows IPv4 or hostname,
  // optional :port.
  const FIVEM_REGEX =
    /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)(?::\d{1,5})?$|^([a-zA-Z0-9-]+\.)+[a-zA-Z]{2,}(?::\d{1,5})?$/;

  router.get("/:guildId/fivem", requireAuth, requireGuildAdmin, (req, res) => {
    try {
      const gs = client.db.getGuild(req.params.guildId) || {};
      res.json({ fivemIP: gs.fivemIP || null });
    } catch (error) {
      Logger.error(`[DASHBOARD FIVEM GET ERROR] reqId=${req.reqId}`, error);
      res
        .status(500)
        .json({
          error: t(req.lang, "dashboard.guilds.fivem_fetch_failed"),
          reqId: req.reqId,
        });
    }
  });

  router.patch(
    "/:guildId/fivem",
    requireAuth,
    requireGuildAdmin,
    (req, res) => {
      const { fivemIP } = req.body || {};
      let value;
      if (fivemIP === null || fivemIP === "" || fivemIP === undefined) {
        value = null;
      } else if (typeof fivemIP === "string") {
        const trimmed = fivemIP.trim();
        if (trimmed.length > 253) {
          return res
            .status(400)
            .json({ error: t(req.lang, "dashboard.guilds.ip_too_long") });
        }
        if (!FIVEM_REGEX.test(trimmed)) {
          return res.status(400).json({
            error: t(req.lang, "dashboard.guilds.fivem_format_invalid"),
          });
        }
        value = trimmed.includes(":") ? trimmed : `${trimmed}:30120`;
      } else {
        return res
          .status(400)
          .json({ error: t(req.lang, "dashboard.guilds.fivem_ip_invalid") });
      }
      try {
        client.db.updateGuild(req.params.guildId, { fivemIP: value });
        if (client.guildSettingsCache)
          client.guildSettingsCache.delete(req.params.guildId);
        invalidateGuildCache(req.params.guildId);
        if (client.invalidateGuildConfig)
          client.invalidateGuildConfig(req.params.guildId);
        logDashboardAction(
          req.params.guildId,
          req.user.id,
          req.user.username,
          "UPDATE_FIVEM",
          { fivemIP: value },
        );
        res.json({ success: true, fivemIP: value });
      } catch (error) {
        Logger.error(`[DASHBOARD FIVEM PATCH ERROR] reqId=${req.reqId}`, error);
        res
          .status(500)
          .json({
            error: t(req.lang, "dashboard.guilds.fivem_update_failed"),
            reqId: req.reqId,
          });
      }
    },
  );

  // ===================== CAPTCHA =====================

  router.get(
    "/:guildId/captcha",
    requireAuth,
    requireGuildAdmin,
    (req, res) => {
      try {
        const raw = client.db.getGuild(req.params.guildId, "captcha");
        const captcha =
          raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {};
        res.json({
          enabled: !!captcha.enabled,
          role: captcha.role || null,
          channel: captcha.channel || null,
        });
      } catch (error) {
        Logger.error(
          `[DASHBOARD CAPTCHA GET ERROR] reqId=${req.reqId}`,
          error,
        );
        res
          .status(500)
          .json({
            error: t(req.lang, "dashboard.guilds.captcha_fetch_failed"),
            reqId: req.reqId,
          });
      }
    },
  );

  router.patch(
    "/:guildId/captcha",
    requireAuth,
    requireGuildAdmin,
    (req, res) => {
      const { enabled, role, channel } = req.body || {};
      const normalizeId = (v) => {
        if (v === null || v === "" || v === undefined) return null;
        if (typeof v !== "string") return undefined;
        const t = v.trim();
        return SNOWFLAKE_REGEX.test(t) ? t : undefined;
      };
      if (enabled !== undefined && typeof enabled !== "boolean") {
        return res
          .status(400)
          .json({ error: t(req.lang, "dashboard.guilds.enabled_boolean") });
      }
      const r = role !== undefined ? normalizeId(role) : undefined;
      const c = channel !== undefined ? normalizeId(channel) : undefined;
      if (role !== undefined && r === undefined) {
        return res
          .status(400)
          .json({ error: t(req.lang, "dashboard.guilds.role_id_invalid") });
      }
      if (channel !== undefined && c === undefined) {
        return res
          .status(400)
          .json({ error: t(req.lang, "dashboard.guilds.channel_id_invalid") });
      }
      try {
        const raw = client.db.getGuild(req.params.guildId, "captcha");
        const current =
          raw && typeof raw === "object" && !Array.isArray(raw)
            ? raw
            : { enabled: false, role: null, channel: null };
        const next = {
          enabled: enabled !== undefined ? !!enabled : !!current.enabled,
          role: role !== undefined ? r : current.role || null,
          channel: channel !== undefined ? c : current.channel || null,
        };
        client.db.updateGuild(req.params.guildId, { captcha: next });
        if (client.guildSettingsCache)
          client.guildSettingsCache.delete(req.params.guildId);
        invalidateGuildCache(req.params.guildId);
        if (client.invalidateGuildConfig)
          client.invalidateGuildConfig(req.params.guildId);
        logDashboardAction(
          req.params.guildId,
          req.user.id,
          req.user.username,
          "UPDATE_CAPTCHA",
          next,
        );
        res.json({ success: true, ...next });
      } catch (error) {
        Logger.error(
          `[DASHBOARD CAPTCHA PATCH ERROR] reqId=${req.reqId}`,
          error,
        );
        res
          .status(500)
          .json({
            error: t(req.lang, "dashboard.guilds.captcha_update_failed"),
            reqId: req.reqId,
          });
      }
    },
  );

  // ===================== MUTE PRESETS =====================

  const MUTE_PRESET_NAME_REGEX = /^[a-z0-9_-]{2,20}$/;

  router.get(
    "/:guildId/mute-presets",
    requireAuth,
    requireGuildAdmin,
    (req, res) => {
      try {
        const settings = client.db.getGuild(req.params.guildId) || {};
        const presets = client.db.getMutePresets(req.params.guildId) || [];
        res.json({
          enabled: !!settings.mutePresetsEnabled,
          presets,
        });
      } catch (error) {
        Logger.error("[DASHBOARD MUTE PRESETS GET ERROR]", error);
        res
          .status(500)
          .json({ error: t(req.lang, "dashboard.guilds.presets_fetch_failed") });
      }
    },
  );

  router.post(
    "/:guildId/mute-presets",
    requireAuth,
    requireGuildAdmin,
    (req, res) => {
      const name = String(req.body.name || "")
        .trim()
        .toLowerCase();
      const durationSeconds = parseInt(req.body.durationSeconds, 10);
      const reason = req.body.reason ? String(req.body.reason).trim() : null;

      if (!MUTE_PRESET_NAME_REGEX.test(name)) {
        return res.status(400).json({
          error: t(req.lang, "dashboard.guilds.preset_name_invalid"),
        });
      }
      if (
        isNaN(durationSeconds) ||
        durationSeconds < 5 ||
        durationSeconds > 2419200
      ) {
        return res
          .status(400)
          .json({ error: t(req.lang, "dashboard.guilds.preset_duration_invalid") });
      }
      if (reason && reason.length > 400) {
        return res
          .status(400)
          .json({ error: t(req.lang, "dashboard.guilds.reason_too_long") });
      }

      try {
        client.db.addMutePreset(
          req.params.guildId,
          name,
          durationSeconds,
          reason,
        );
        logDashboardAction(
          req.params.guildId,
          req.user.id,
          req.user.username,
          "MUTE_PRESET_ADD",
          { name, durationSeconds, reason },
        );
        res.json({ success: true, name, durationSeconds, reason });
      } catch (error) {
        Logger.error("[DASHBOARD MUTE PRESET ADD ERROR]", error);
        res
          .status(500)
          .json({ error: t(req.lang, "dashboard.guilds.preset_add_failed") });
      }
    },
  );

  router.delete(
    "/:guildId/mute-presets/:name",
    requireAuth,
    requireGuildAdmin,
    (req, res) => {
      const name = String(req.params.name || "")
        .trim()
        .toLowerCase();
      if (!MUTE_PRESET_NAME_REGEX.test(name)) {
        return res
          .status(400)
          .json({ error: t(req.lang, "dashboard.guilds.name_invalid") });
      }
      try {
        const ok = client.db.delMutePreset(req.params.guildId, name);
        if (!ok) {
          return res
            .status(404)
            .json({ error: t(req.lang, "dashboard.guilds.preset_not_found") });
        }
        logDashboardAction(
          req.params.guildId,
          req.user.id,
          req.user.username,
          "MUTE_PRESET_DELETE",
          { name },
        );
        res.json({ success: true });
      } catch (error) {
        Logger.error("[DASHBOARD MUTE PRESET DELETE ERROR]", error);
        res
          .status(500)
          .json({ error: t(req.lang, "dashboard.guilds.preset_delete_failed") });
      }
    },
  );

  router.patch(
    "/:guildId/mute-presets",
    requireAuth,
    requireGuildAdmin,
    (req, res) => {
      const { enabled } = req.body || {};
      if (typeof enabled !== "boolean") {
        return res
          .status(400)
          .json({ error: t(req.lang, "dashboard.guilds.enabled_boolean") });
      }
      try {
        client.db.updateGuild(req.params.guildId, {
          mutePresetsEnabled: enabled ? 1 : 0,
        });
        if (client.guildSettingsCache)
          client.guildSettingsCache.delete(req.params.guildId);
        invalidateGuildCache(req.params.guildId);
        logDashboardAction(
          req.params.guildId,
          req.user.id,
          req.user.username,
          "UPDATE_MUTE_PRESETS_ENABLED",
          { enabled },
        );
        res.json({ success: true, enabled });
      } catch (error) {
        Logger.error("[DASHBOARD MUTE PRESETS TOGGLE ERROR]", error);
        res
          .status(500)
          .json({ error: t(req.lang, "dashboard.guilds.presets_update_failed") });
      }
    },
  );

  return router;
};
