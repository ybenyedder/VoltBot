const Database = require("better-sqlite3");
const path = require("path");
const Logger = require("./logger");

const instanceDir = process.env.BOT_INSTANCE_CWD || process.cwd();
const dataDir = path.join(instanceDir, "data");
if (!require("fs").existsSync(dataDir)) {
  require("fs").mkdirSync(dataDir, { recursive: true });
}

const db = new Database(path.join(dataDir, "bot.db"));

// Cache interne pour isModuleEnabled — invalidé par updateGuildModule.
// Garantit que les toggles dashboard prennent effet immédiatement sans
// imposer une lecture DB à chaque message/event.
const moduleStatusCache = new Map();

// --- SQLite pragmas (tuning) -------------------------------------------------
// journal_mode=WAL: concurrent readers + single writer, no reader blocking.
db.pragma("journal_mode = WAL");
// foreign_keys=ON: enforce FK constraints (off by default in SQLite).
db.pragma("foreign_keys = ON");
// cache_size=10000: ~40 MB page cache (negative = KiB; positive = pages).
db.pragma("cache_size = 10000");
// temp_store=memory: keep temp B-trees / sorters in RAM, not on disk.
db.pragma("temp_store = memory");
// synchronous=NORMAL: safe with WAL, ~2-3x faster writes vs FULL; only risk
// is losing the last txn on power loss (not corruption).
db.pragma("synchronous = NORMAL");
// mmap_size=30000000: memory-map up to ~30 MB of the DB for faster reads
// on Linux (zero-copy from page cache).
db.pragma("mmap_size = 30000000");
// wal_autocheckpoint=1000: checkpoint WAL every ~4 MB to keep it bounded
// and avoid long stalls during manual TRUNCATE checkpoints.
db.pragma("wal_autocheckpoint = 1000");
// busy_timeout=5000: wait up to 5s on lock contention instead of throwing
// SQLITE_BUSY immediately (common during concurrent writes).
db.pragma("busy_timeout = 5000");
// optimize: refresh query planner stats; cheap on startup, recommended
// by SQLite docs before close / periodically.
db.pragma("optimize");
// ----------------------------------------------------------------------------

db.prepare(
  `
 CREATE TABLE IF NOT EXISTS users (
 userId TEXT,
 guildId TEXT,
 xp INTEGER DEFAULT 0,
 level INTEGER DEFAULT 0,
 coins INTEGER DEFAULT 0,
 bank INTEGER DEFAULT 0,
 dailyTimestamp INTEGER DEFAULT 0,
 workTimestamp INTEGER DEFAULT 0,
 PRIMARY KEY (userId, guildId)
 )
`,
).run();

db.prepare(
  `
 CREATE TABLE IF NOT EXISTS guilds (
 guildId TEXT PRIMARY KEY,
 prefix TEXT DEFAULT'+',
 modLogsChannel TEXT,
 welcomeChannel TEXT,
 goodbyeChannel TEXT,
 levelChannel TEXT,
 modRole TEXT,
 welcomeMessage TEXT DEFAULT'Bienvenue {user} sur **{server}**. Nous sommes {membercount} membres.',
 goodbyeMessage TEXT DEFAULT'{user} a quitté le serveur.',
 antiSpam INTEGER DEFAULT 0,
 antiLink INTEGER DEFAULT 0,
 antiBadWords INTEGER DEFAULT 0,
 autoRole TEXT
 )
`,
).run();

db.prepare(
  `
 CREATE TABLE IF NOT EXISTS guild_modules (
 guildId TEXT,
 moduleName TEXT,
 isEnabled INTEGER DEFAULT 1,
 PRIMARY KEY (guildId, moduleName)
 )
`,
).run();

const columnsToAdd = [
  { name: "raidLogsChannel", type: "TEXT" },
  { name: "msgLogsChannel", type: "TEXT" },
  { name: "voiceLogsChannel", type: "TEXT" },
  { name: "captcha", type: "TEXT" },
  { name: "statsFormat", type: "TEXT" },
  { name: "fivemIP", type: "TEXT" },
  { name: "automod", type: "TEXT" },
  { name: "antiban", type: "INTEGER DEFAULT 0" },
  { name: "antibot", type: "INTEGER DEFAULT 0" },
  { name: "antichannel", type: "INTEGER DEFAULT 0" },
  { name: "antijoin", type: "INTEGER DEFAULT 0" },
  { name: "bypass", type: 'TEXT DEFAULT "[]"' },
  { name: "creationlimit", type: "TEXT" },
  { name: "ndd", type: "TEXT" },
  { name: "whitelist", type: 'TEXT DEFAULT "[]"' },
  { name: "statsMembersFormat", type: "TEXT" },
  { name: "statsOnlineFormat", type: "TEXT" },
  { name: "statsVocalFormat", type: "TEXT" },
  { name: "statsTopFormat", type: "TEXT" },
  { name: "statsInviteFormat", type: "TEXT" },
  { name: "autoRole", type: "TEXT" },
  { name: "statusRole", type: "TEXT" },
  {
    name: "statusRoleTriggers",
    type: 'TEXT DEFAULT\'["/nocoin",".gg/nocoin"]\'',
  },
  { name: "joinPingChannel", type: "TEXT" },
  { name: "joinPingChannels", type: "TEXT DEFAULT'[]'" },
  { name: "suggestChannel", type: "TEXT" },
  { name: "lockInvite", type: "INTEGER DEFAULT 0" },
  { name: "unlockName", type: "INTEGER DEFAULT 0" },
  { name: "autoDelete", type: "INTEGER DEFAULT 0" },
  { name: "publicChannels", type: "TEXT DEFAULT'[]'" },
  { name: "dropChannels", type: "TEXT DEFAULT'[]'" },
  { name: "dropsEnabled", type: "INTEGER DEFAULT 1" },
  { name: "starboardChannel", type: "TEXT" },
  { name: "starboardCount", type: "INTEGER DEFAULT 3" },
  { name: "currencyName", type: "TEXT DEFAULT'Coins'" },
  { name: "currencyEmoji", type: "TEXT DEFAULT''" },
  { name: "minWork", type: "INTEGER DEFAULT 50" },
  { name: "maxWork", type: "INTEGER DEFAULT 200" },
  { name: "minDaily", type: "INTEGER DEFAULT 200" },
  { name: "maxDaily", type: "INTEGER DEFAULT 1000" },
  {
    name: "casinoConfig",
    type: 'TEXT DEFAULT\'{"rewards":[],"settings":{}}\'',
  }, // Roles & weights for casino
  { name: "avisChannel", type: "TEXT" },
  { name: "welcomeDm", type: "INTEGER DEFAULT 0" },
  {
    name: "welcomeDmMessage",
    type: 'TEXT DEFAULT "Bienvenue {user} sur **{server}**."',
  },
  { name: "sanctionDm", type: "INTEGER DEFAULT 0" },
  {
    name: "sanctionDmMessage",
    type: 'TEXT DEFAULT "Vous avez été {action} sur **{server}** pour la raison: {reason}"',
  },
  { name: "joinPingMode", type: "TEXT DEFAULT'ghost'" },
  { name: "birthdayChannel", type: "TEXT" },
  { name: "welcomeImage", type: "TEXT" },
  { name: "goodbyeImage", type: "TEXT" },
  { name: "goodbyeDm", type: "INTEGER DEFAULT 0" },
  {
    name: "goodbyeDmMessage",
    type: "TEXT DEFAULT'Tu as quitté **{server}**. À bientôt peut-être ! '",
  },
  { name: "language", type: "TEXT DEFAULT'fr'" },
  { name: "welcomeTitle", type: "TEXT DEFAULT'Bienvenue.'" },
  { name: "welcomeGif", type: "TEXT" },
  {
    name: "levelMessage",
    type: "TEXT DEFAULT'{user}, tu viens de passer niveau **{level}** !'",
  },
  { name: "welcomeTextChannel", type: "TEXT" },
  { name: "welcomeTextMessage", type: "TEXT" },
  { name: "mutePresetsEnabled", type: "INTEGER DEFAULT 0" },
  { name: "reports", type: 'TEXT DEFAULT "[]"' },
  { name: "limits", type: 'TEXT DEFAULT "{}"' },
  { name: "banEdits", type: 'TEXT DEFAULT "[]"' },
  { name: "tempMutes", type: 'TEXT DEFAULT "[]"' },
];

try {
  const tableInfo = db.prepare("PRAGMA table_info(guilds)").all();
  const existingCols = tableInfo.map((c) => c.name.toLowerCase());

  for (const col of columnsToAdd) {
    if (!existingCols.includes(col.name.toLowerCase())) {
      db.prepare(`ALTER TABLE guilds ADD COLUMN ${col.name} ${col.type}`).run();
      Logger.info(`[DATABASE] Colonne'${col.name}'ajoutée à la table guilds.`);
    }
  }
} catch (e) {
  Logger.error(
    "[DATABASE] Erreur lors de la migration de la table guilds :",
    e,
  );
}

db.prepare(
  `
 CREATE TABLE IF NOT EXISTS warnings (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 userId TEXT,
 guildId TEXT,
 reason TEXT,
 moderatorId TEXT,
 timestamp INTEGER DEFAULT (strftime('%s','now'))
 )
`,
).run();

db.prepare(
  `
 CREATE TABLE IF NOT EXISTS afk (
 userId TEXT,
 guildId TEXT,
 reason TEXT,
 timestamp INTEGER DEFAULT (strftime('%s','now')),
 PRIMARY KEY (userId, guildId)
 )
`,
).run();

db.prepare(
  `
 CREATE TABLE IF NOT EXISTS inventory (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 userId TEXT,
 guildId TEXT,
 item TEXT,
 amount INTEGER DEFAULT 1
 )
`,
).run();

// Migration pour la table inventory si nécessaire
try {
  const tableInfo = db.prepare("PRAGMA table_info(inventory)").all();
  if (tableInfo.some((c) => c.name === "itemId")) {
    // Migration vers le nouveau format
    db.transaction(() => {
      db.prepare("ALTER TABLE inventory RENAME TO inventory_old").run();
      db.prepare(
        `
 CREATE TABLE inventory (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 userId TEXT,
 guildId TEXT,
 item TEXT,
 amount INTEGER DEFAULT 1
 )
 `,
      ).run();
      db.prepare(
        "INSERT INTO inventory (userId, guildId, item, amount) SELECT userId, guildId, itemId, quantity FROM inventory_old",
      ).run();
      db.prepare("DROP TABLE inventory_old").run();
    })();
    Logger.info(
      "[DATABASE] Migration de la table inventory effectuée avec succès.",
    );
  }
} catch (e) {
  Logger.error(
    "[DATABASE] Erreur lors de la migration de la table inventory:",
    e,
  );
}

db.prepare(
  `
 CREATE TABLE IF NOT EXISTS tickets (
 channelId TEXT PRIMARY KEY,
 guildId TEXT,
 userId TEXT,
 status TEXT DEFAULT'open',
 createdAt INTEGER DEFAULT (strftime('%s','now'))
 )
`,
).run();

db.prepare(
  `
 CREATE TABLE IF NOT EXISTS custom_commands (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 guildId TEXT,
 name TEXT,
 response TEXT,
 UNIQUE(guildId, name)
 )
`,
).run();

db.prepare(
  `
 CREATE TABLE IF NOT EXISTS globals (
 key TEXT PRIMARY KEY,
 value TEXT
 )
`,
).run();

db.prepare(
  `
 CREATE TABLE IF NOT EXISTS mute_presets (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 guildId TEXT NOT NULL,
 name TEXT NOT NULL,
 durationSeconds INTEGER NOT NULL,
 reason TEXT,
 createdAt INTEGER DEFAULT (strftime('%s','now')),
 UNIQUE(guildId, name)
 )
`,
).run();

db.prepare(
  `
 CREATE TABLE IF NOT EXISTS autoreact_channels (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 guildId TEXT NOT NULL,
 channelId TEXT NOT NULL,
 emojis TEXT NOT NULL,
 createdBy TEXT,
 createdAt INTEGER DEFAULT (strftime('%s','now')),
 UNIQUE(guildId, channelId)
 )
`,
).run();

db.prepare(
  `
 CREATE TABLE IF NOT EXISTS reaction_roles (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 guildId TEXT NOT NULL,
 messageId TEXT NOT NULL,
 channelId TEXT NOT NULL,
 emoji TEXT NOT NULL,
 roleId TEXT NOT NULL,
 createdBy TEXT,
 createdAt INTEGER DEFAULT (strftime('%s','now')),
 UNIQUE(messageId, emoji)
 )
`,
).run();

db.prepare(
  `
 CREATE TABLE IF NOT EXISTS button_roles (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 guildId TEXT NOT NULL,
 messageId TEXT NOT NULL,
 channelId TEXT NOT NULL,
 customId TEXT NOT NULL,
 label TEXT NOT NULL,
 style TEXT DEFAULT 'Secondary',
 roleId TEXT NOT NULL,
 createdBy TEXT,
 createdAt INTEGER DEFAULT (strftime('%s','now')),
 UNIQUE(messageId, customId)
 )
`,
).run();

db.prepare(
  `
 CREATE TABLE IF NOT EXISTS self_roles (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 guildId TEXT NOT NULL,
 category TEXT NOT NULL,
 label TEXT NOT NULL,
 roleId TEXT NOT NULL,
 emoji TEXT,
 createdBy TEXT,
 createdAt INTEGER DEFAULT (strftime('%s','now')),
 UNIQUE(guildId, roleId)
 )
`,
).run();

db.prepare(
  `
 CREATE TABLE IF NOT EXISTS log_settings (
 guildId TEXT NOT NULL,
 type TEXT NOT NULL,
 enabled INTEGER DEFAULT 0,
 channelId TEXT,
 events TEXT,
 PRIMARY KEY (guildId, type)
 )
`,
).run();

db.prepare(
  `
 CREATE TABLE IF NOT EXISTS badwords (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 guildId TEXT,
 word TEXT,
 UNIQUE(guildId, word)
 )
`,
).run();

db.prepare(
  `
 CREATE TABLE IF NOT EXISTS temporaries (
 id TEXT PRIMARY KEY,
 type TEXT,
 data TEXT,
 expiresAt INTEGER
 )
`,
).run();

db.prepare(
  `
 CREATE TABLE IF NOT EXISTS level_roles (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 guildId TEXT,
 level INTEGER,
 roleId TEXT,
 UNIQUE(guildId, level)
 )
`,
).run();

db.prepare(
  `
 CREATE TABLE IF NOT EXISTS antiraid_config (
 guildId TEXT PRIMARY KEY,
 raidMode INTEGER DEFAULT 0,
 antiBot INTEGER DEFAULT 0,
 antiBotPunishment TEXT DEFAULT'kick',
 antiJoinPunishment TEXT DEFAULT'kick',
 antiMassMention INTEGER DEFAULT 1,
 antiMassMentionPunishment TEXT DEFAULT'mute',
 antiGhostPing INTEGER DEFAULT 0,
 antiGhostPingPunishment TEXT DEFAULT'warn',
 antiNuke INTEGER DEFAULT 1,
 antiNukePunishment TEXT DEFAULT'ban',
 antiChannel INTEGER DEFAULT 1,
 antiChannelPunishment TEXT DEFAULT'strip',
 antiRole INTEGER DEFAULT 1,
 antiRolePunishment TEXT DEFAULT'strip',
 antiKick INTEGER DEFAULT 0,
 antiKickPunishment TEXT DEFAULT'ban',
 antiBan INTEGER DEFAULT 0,
 antiBanPunishment TEXT DEFAULT'ban',
 antiUnban INTEGER DEFAULT 0,
 antiUnbanPunishment TEXT DEFAULT'ban',
 antiWebhook INTEGER DEFAULT 0,
 antiWebhookPunishment TEXT DEFAULT'ban',
 antiEmote INTEGER DEFAULT 0,
 antiEmotePunishment TEXT DEFAULT'strip',
 antiSticker INTEGER DEFAULT 0,
 antiStickerPunishment TEXT DEFAULT'strip',
 antiGif INTEGER DEFAULT 0,
 antiGifPunishment TEXT DEFAULT'delete',
 antiSoundboard INTEGER DEFAULT 0,
 antiSoundboardPunishment TEXT DEFAULT'strip',
 antiThread INTEGER DEFAULT 0,
 antiThreadPunishment TEXT DEFAULT'strip',
 antiCreateInvite INTEGER DEFAULT 0,
 antiCreateInvitePunishment TEXT DEFAULT'strip',
 antiEditGuild INTEGER DEFAULT 0,
 antiEditGuildPunishment TEXT DEFAULT'strip',
 antiNewAccount INTEGER DEFAULT 0,
 antiNewAccountPunishment TEXT DEFAULT'kick',
 antiLink INTEGER DEFAULT 0,
 antiLinkType TEXT DEFAULT'all',
 antiLinkSanction INTEGER DEFAULT 1,
 antiLinkPunishment TEXT DEFAULT'delete',
 antiLinkIgnoredChannels TEXT DEFAULT'[]',
 antiRank INTEGER DEFAULT 0,
 antiRankType TEXT DEFAULT'danger',
 antiRankPunishment TEXT DEFAULT'strip',
 antiBadWords INTEGER DEFAULT 0,
 antiBadWordsPunishment TEXT DEFAULT'delete',
 nukeChannelLimit INTEGER DEFAULT 3,
 nukeRoleLimit INTEGER DEFAULT 3,
 nukeBanLimit INTEGER DEFAULT 3,
 nukeUnbanLimit INTEGER DEFAULT 3,
 spamLimit INTEGER DEFAULT 5,
 antiSpam INTEGER DEFAULT 0,
 antiSpamPunishment TEXT DEFAULT'mute',
 mentionLimit INTEGER DEFAULT 5,
 muteDuration INTEGER DEFAULT 300000
 )
`,
).run();

db.prepare(
  `
 CREATE TABLE IF NOT EXISTS tempvc_config (
 guildId TEXT PRIMARY KEY,
 categoryId TEXT,
 hubId TEXT,
 panelChannelId TEXT
 )
`,
).run();

db.prepare(
  `
 CREATE TABLE IF NOT EXISTS tempvc_channels (
 channelId TEXT PRIMARY KEY,
 guildId TEXT,
 ownerId TEXT
 )
`,
).run();

db.prepare(
  `
 CREATE TABLE IF NOT EXISTS economy_shop (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 guildId TEXT,
 name TEXT,
 description TEXT,
 price INTEGER,
 roleId TEXT,
 itemType TEXT DEFAULT'role'
 )
`,
).run();

db.prepare(
  `
 CREATE TABLE IF NOT EXISTS lettres (
 id TEXT PRIMARY KEY,
 content TEXT
 )
`,
).run();

db.prepare(
  `
 CREATE TABLE IF NOT EXISTS dashboard_access_logs (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 userId TEXT,
 username TEXT,
 ip TEXT,
 userAgent TEXT,
 status TEXT, --'success','failed'
 timestamp INTEGER DEFAULT (strftime('%s','now'))
 )
`,
).run();

db.prepare(
  `
 CREATE TABLE IF NOT EXISTS dashboard_audit_logs (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 guildId TEXT,
 userId TEXT,
 username TEXT,
 action TEXT, -- e.g.,'UPDATE_PREFIX','TOGGLE_ANTIRAID'
 details TEXT, -- JSON string with old/new values
 timestamp INTEGER DEFAULT (strftime('%s','now'))
 )
`,
).run();

db.prepare(
  `
 CREATE TABLE IF NOT EXISTS giveaways (
 messageId TEXT PRIMARY KEY,
 channelId TEXT,
 guildId TEXT,
 prize TEXT,
 winnersCount INTEGER DEFAULT 1,
 endsAt INTEGER,
 hostId TEXT,
 requirements TEXT DEFAULT'[]', -- JSON string of role IDs
 winners TEXT DEFAULT'[]',
 participantsCount INTEGER DEFAULT 0,
 endedAt INTEGER,
 status TEXT DEFAULT'active', --'active','ended','cancelled'
 ended INTEGER DEFAULT 0
 )
`,
).run();

db.prepare(
  `
 CREATE TABLE IF NOT EXISTS giveaway_entries (
 messageId TEXT,
 userId TEXT,
 guildId TEXT,
 joinedAt INTEGER DEFAULT (strftime('%s','now')),
 PRIMARY KEY (messageId, userId)
 )
`,
).run();

db.prepare(
  `
 CREATE TABLE IF NOT EXISTS stats_channels (
 guildId TEXT PRIMARY KEY,
 categoryId TEXT,
 membersId TEXT,
 topId TEXT,
 onlineId TEXT,
 vocalId TEXT,
 inviteId TEXT,
 inviteCode TEXT
 )
`,
).run();

db.prepare(
  `
 CREATE TABLE IF NOT EXISTS birthdays (
 userId TEXT,
 guildId TEXT,
 day INTEGER,
 month INTEGER,
 PRIMARY KEY (userId, guildId)
 )
`,
).run();

db.prepare(
  `
 CREATE TABLE IF NOT EXISTS role_permissions (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 guildId TEXT,
 roleId TEXT,
 commandName TEXT,
 UNIQUE(guildId, roleId, commandName)
 )
`,
).run();

db.prepare(
  `
 CREATE TABLE IF NOT EXISTS bot_settings (
 id INTEGER PRIMARY KEY CHECK (id = 1),
 presenceStatus TEXT DEFAULT'online',
 customStatus TEXT DEFAULT'',
 themeColor TEXT DEFAULT'#2B2D31'
 )
`,
).run();

db.prepare(
  `
 CREATE TABLE IF NOT EXISTS verify_config (
 guildId TEXT PRIMARY KEY,
 roleId TEXT,
 channelId TEXT
 )
`,
).run();

db.prepare(
  `
 CREATE TABLE IF NOT EXISTS tickets_config (
 guildId TEXT PRIMARY KEY,
 categoryId TEXT,
 roleId TEXT,
 logsChannelId TEXT
 )
`,
).run();

db.prepare(
  `
 CREATE TABLE IF NOT EXISTS ticket_options (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 guildId TEXT,
 title TEXT,
 emoji TEXT,
 roleId TEXT,
 description TEXT
 )
`,
).run();

db.prepare(
  `
 CREATE TABLE IF NOT EXISTS voicemaster_config (
 guildId TEXT PRIMARY KEY,
 categoryId TEXT,
 hubId TEXT,
 panelChannelId TEXT
 )
`,
).run();

db.prepare(
  `
 CREATE TABLE IF NOT EXISTS voicemaster_channels (
 channelId TEXT PRIMARY KEY,
 guildId TEXT,
 ownerId TEXT
 )
`,
).run();

db.prepare(
  `
 CREATE TABLE IF NOT EXISTS private_voice_channels (
 channelId TEXT PRIMARY KEY,
 guildId TEXT,
 ownerId TEXT,
 locked INTEGER DEFAULT 0,
 data TEXT DEFAULT'{}'
 )
`,
).run();

db.prepare(
  `
 CREATE TABLE IF NOT EXISTS dog_states (
 userId TEXT,
 guildId TEXT,
 masterId TEXT,
 timestamp INTEGER DEFAULT (strftime('%s','now')),
 PRIMARY KEY (userId, guildId)
 )
`,
).run();

try {
  db.prepare(
    "INSERT OR IGNORE INTO bot_settings (id, presenceStatus, customStatus, themeColor) VALUES (1,'online','','#2B2D31')",
  ).run();
} catch (e) {
  Logger.error(
    "[DATABASE] Erreur lors de l'initialisation de bot_settings :",
    e,
  );
}

db.prepare(
  "CREATE INDEX IF NOT EXISTS idx_users_guild ON users (guildId)",
).run();
db.prepare(
  "CREATE INDEX IF NOT EXISTS idx_users_userId ON users (userId)",
).run();
db.prepare(
  "CREATE INDEX IF NOT EXISTS idx_warnings_user_guild ON warnings (userId, guildId)",
).run();
db.prepare(
  "CREATE INDEX IF NOT EXISTS idx_inventory_user_guild ON inventory (userId, guildId)",
).run();
db.prepare(
  "CREATE INDEX IF NOT EXISTS idx_tickets_guild_user ON tickets (guildId, userId)",
).run();
db.prepare(
  "CREATE INDEX IF NOT EXISTS idx_custom_commands_guild ON custom_commands (guildId, name)",
).run();
db.prepare(
  "CREATE INDEX IF NOT EXISTS idx_temporaries_type ON temporaries (type)",
).run();
db.prepare(
  "CREATE INDEX IF NOT EXISTS idx_level_roles_guild ON level_roles (guildId, level)",
).run();
db.prepare(
  "CREATE INDEX IF NOT EXISTS idx_role_perms_guild_role ON role_permissions (guildId, roleId)",
).run();
db.prepare(
  "CREATE INDEX IF NOT EXISTS idx_mute_presets_guild ON mute_presets (guildId)",
).run();
db.prepare(
  "CREATE INDEX IF NOT EXISTS idx_reaction_roles_message ON reaction_roles (messageId)",
).run();
db.prepare(
  "CREATE INDEX IF NOT EXISTS idx_reaction_roles_guild ON reaction_roles (guildId)",
).run();
db.prepare(
  "CREATE INDEX IF NOT EXISTS idx_button_roles_message ON button_roles (messageId)",
).run();
db.prepare(
  "CREATE INDEX IF NOT EXISTS idx_button_roles_customid ON button_roles (customId)",
).run();
db.prepare(
  "CREATE INDEX IF NOT EXISTS idx_button_roles_guild ON button_roles (guildId)",
).run();
db.prepare(
  "CREATE INDEX IF NOT EXISTS idx_self_roles_guild ON self_roles (guildId)",
).run();
db.prepare(
  "CREATE INDEX IF NOT EXISTS idx_temporaries_expires ON temporaries (expiresAt)",
).run();
db.prepare(
  "CREATE INDEX IF NOT EXISTS idx_giveaway_entries_message ON giveaway_entries (messageId)",
).run();
db.prepare(
  "CREATE INDEX IF NOT EXISTS idx_badwords_guild ON badwords (guildId)",
).run();
db.prepare(
  "CREATE INDEX IF NOT EXISTS idx_economy_shop_guild ON economy_shop (guildId)",
).run();
db.prepare(
  "CREATE INDEX IF NOT EXISTS idx_giveaways_ended ON giveaways (ended)",
).run();

db.prepare(
  `
 CREATE TABLE IF NOT EXISTS bot_owners (
 userId TEXT PRIMARY KEY,
 addedAt INTEGER DEFAULT (strftime('%s','now'))
 )
`,
).run();

db.prepare(
  `
 CREATE TABLE IF NOT EXISTS speed_phrases (
 phrase TEXT PRIMARY KEY,
 name TEXT
 )
`,
).run();

db.prepare(
  `
 CREATE TABLE IF NOT EXISTS antiraid_whitelist (
 guildId TEXT,
 userId TEXT,
 bypasses TEXT DEFAULT'["*"]',
 PRIMARY KEY(guildId, userId)
 )
`,
).run();

db.prepare(
  `
  CREATE TABLE IF NOT EXISTS vanity_snipers (
    guildId TEXT PRIMARY KEY,
    vanityCode TEXT NOT NULL,
    channelId TEXT,
    userId TEXT,
    status TEXT DEFAULT 'active',
    checksCount INTEGER DEFAULT 0,
    createdAt INTEGER,
    lastCheck INTEGER,
    lastError TEXT
  )
`,
).run();

const migrations = {
  users: [
    { name: "invites", type: "TEXT" },
    { name: "inviteData", type: "TEXT" },
    { name: "bonusInvites", type: "INTEGER DEFAULT 0" },
    { name: "equippedColor", type: "TEXT" },
    { name: "equippedBadge", type: "TEXT" },
    { name: "equippedRole", type: "TEXT" },
    { name: "equippedSuccess", type: "TEXT" },
    { name: "casinoDraws", type: "INTEGER DEFAULT 0" },
    { name: "savedRoles", type: "TEXT" },
    { name: "notes", type: 'TEXT DEFAULT "[]"' },
    { name: "warnings", type: 'TEXT DEFAULT "[]"' },
  ],
  antiraid_config: [
    {
      name: "punish",
      type: 'TEXT DEFAULT\'{"action":"kick","duration":300}\'',
    },
    { name: "antiBotPunishment", type: "TEXT DEFAULT'kick'" },
    { name: "antiJoinPunishment", type: "TEXT DEFAULT'kick'" },
    { name: "antiBadWords", type: "INTEGER DEFAULT 0" },
    { name: "antiGif", type: "INTEGER DEFAULT 0" },
    { name: "antiGifPunishment", type: "TEXT DEFAULT'delete'" },
  ],
  giveaways: [
    { name: "winners", type: "TEXT DEFAULT'[]'" },
    { name: "participantsCount", type: "INTEGER DEFAULT 0" },
    { name: "endedAt", type: "INTEGER" },
  ],
  tickets: [
    { name: "claimedBy", type: "TEXT" },
    { name: "claimedAt", type: "INTEGER" },
    { name: "category", type: "TEXT" },
  ],
  tickets_config: [{ name: "requireReason", type: "INTEGER DEFAULT 0" }],
  warnings: [
    { name: "editedBy", type: "TEXT" },
    { name: "editedAt", type: "INTEGER" },
  ],
  bot_settings: [{ name: "activityType", type: "TEXT DEFAULT'Custom'" }],
};

for (const [table, columns] of Object.entries(migrations)) {
  try {
    const tableInfo = db.prepare(`PRAGMA table_info(${table})`).all();
    const existingCols = tableInfo.map((c) => c.name.toLowerCase());

    for (const col of columns) {
      if (!existingCols.includes(col.name.toLowerCase())) {
        db.prepare(
          `ALTER TABLE ${table} ADD COLUMN ${col.name} ${col.type}`,
        ).run();
        Logger.info(
          `[DATABASE] Colonne'${col.name}'ajoutée à la table ${table}.`,
        );
      }
    }
  } catch (e) {
    Logger.error(
      `[DATABASE] Erreur lors de la migration de la table ${table} :`,
      e,
    );
  }
}

try {
  db.prepare(
    `
 UPDATE antiraid_config
 SET antiBadWords = (
 SELECT COALESCE(guilds.antiBadWords, 0)
 FROM guilds
 WHERE guilds.guildId = antiraid_config.guildId
 )
 WHERE antiBadWords = 0
 AND EXISTS (
 SELECT 1 FROM guilds
 WHERE guilds.guildId = antiraid_config.guildId
 AND guilds.antiBadWords = 1
 )
 `,
  ).run();
} catch (e) {
  Logger.error(
    "[DATABASE] Erreur lors de la synchronisation legacy antiBadWords :",
    e,
  );
}

try {
  db.prepare("DELETE FROM temporaries WHERE expiresAt < ?").run(Date.now());
} catch (e) {
  Logger.error(
    "[DATABASE] Erreur lors du nettoyage initial des temporaires :",
    e,
  );
}

// --- Cached prepared statements for hot-path queries -----------------------
// better-sqlite3 caches internally, but holding our own references avoids
// the lookup on every call and makes the contract explicit.
const stmtGetGuild = db.prepare("SELECT * FROM guilds WHERE guildId = ?");
const stmtInsertGuildDefaults = db.prepare(
  "INSERT OR IGNORE INTO guilds (guildId, prefix, welcomeMessage, goodbyeMessage, antiSpam, antiLink, antiBadWords) VALUES (?, '+', 'Bienvenue {user} sur **{server}**. Nous sommes {membercount} membres.', '{user} a quitté le serveur.', 0, 0, 0)",
);
const stmtGetUser = db.prepare(
  "SELECT * FROM users WHERE userId = ? AND guildId = ?",
);
const stmtInsertUserDefaults = db.prepare(
  "INSERT OR IGNORE INTO users (userId, guildId, xp, level, coins, bank, dailyTimestamp, workTimestamp) VALUES (?, ?, 0, 0, 0, 0, 0, 0)",
);
const stmtIsModuleEnabled = db.prepare(
  "SELECT isEnabled FROM guild_modules WHERE guildId = ? AND moduleName = ?",
);

// --- Atomic transaction helpers ---------------------------------------------
// Prepared statements + better-sqlite3 transactions for multi-step mutations
// that must be all-or-nothing. Without these wrappers two concurrent commands
// can interleave SELECT/UPDATE pairs and corrupt balances (the classic
// "double-spend" race on +pay, +rob, +deposit, +withdraw, XP gain, etc.).
const stmtSelectXpLevel = db.prepare(
  "SELECT xp, level FROM users WHERE userId = ? AND guildId = ?",
);
const stmtCondDebitCoins = db.prepare(
  "UPDATE users SET coins = coins - ? WHERE userId = ? AND guildId = ? AND coins >= ?",
);
const stmtCondDebitBank = db.prepare(
  "UPDATE users SET bank = bank - ? WHERE userId = ? AND guildId = ? AND bank >= ?",
);
const stmtAddCoinsRow = db.prepare(
  "UPDATE users SET coins = coins + ? WHERE userId = ? AND guildId = ?",
);
const stmtAddBankRow = db.prepare(
  "UPDATE users SET bank = bank + ? WHERE userId = ? AND guildId = ?",
);
const stmtFloorDebitCoins = db.prepare(
  "UPDATE users SET coins = CASE WHEN coins - ? < 0 THEN 0 ELSE coins - ? END WHERE userId = ? AND guildId = ?",
);
const stmtUpdateXpLevel = db.prepare(
  "UPDATE users SET xp = ?, level = ? WHERE userId = ? AND guildId = ?",
);
const stmtSelectInventoryItem = db.prepare(
  "SELECT id, amount FROM inventory WHERE userId = ? AND guildId = ? AND item = ?",
);
const stmtUpdateInventoryAmount = db.prepare(
  "UPDATE inventory SET amount = ? WHERE id = ?",
);
const stmtIncInventoryAmount = db.prepare(
  "UPDATE inventory SET amount = amount + ? WHERE id = ?",
);
const stmtDeleteInventoryById = db.prepare(
  "DELETE FROM inventory WHERE id = ?",
);
const stmtInsertInventoryItem = db.prepare(
  "INSERT INTO inventory (userId, guildId, item, amount) VALUES (?, ?, ?, ?)",
);

// Atomic SELECT-check-DEBIT-CREDIT across two user rows in same guild.
// Returns { ok: true } on success or { ok: false, reason: 'insufficient' }.
const txTransferCoins = db.transaction((fromId, toId, guildId, amount) => {
  stmtInsertUserDefaults.run(fromId, guildId);
  stmtInsertUserDefaults.run(toId, guildId);
  const info = stmtCondDebitCoins.run(amount, fromId, guildId, amount);
  if (info.changes === 0) return { ok: false, reason: "insufficient" };
  stmtAddCoinsRow.run(amount, toId, guildId);
  return { ok: true };
});

// Atomic transfer that floors source at 0 (used by rob fines where the
// caller has already validated that the source can cover something).
const txForceTransferCoins = db.transaction((fromId, toId, guildId, amount) => {
  stmtInsertUserDefaults.run(fromId, guildId);
  stmtInsertUserDefaults.run(toId, guildId);
  stmtFloorDebitCoins.run(amount, amount, fromId, guildId);
  stmtAddCoinsRow.run(amount, toId, guildId);
});

// Atomic coins -> bank move. Returns true if the user had enough coins.
const txDepositCoins = db.transaction((userId, guildId, amount) => {
  stmtInsertUserDefaults.run(userId, guildId);
  const info = stmtCondDebitCoins.run(amount, userId, guildId, amount);
  if (info.changes === 0) return false;
  stmtAddBankRow.run(amount, userId, guildId);
  return true;
});

// Atomic bank -> coins move. Returns true if the user had enough bank.
const txWithdrawCoins = db.transaction((userId, guildId, amount) => {
  stmtInsertUserDefaults.run(userId, guildId);
  const info = stmtCondDebitBank.run(amount, userId, guildId, amount);
  if (info.changes === 0) return false;
  stmtAddCoinsRow.run(amount, userId, guildId);
  return true;
});

// Atomic XP delta + recomputed level. `levelFn(newXp)` returns the new level
// (caller provides the formula so we don't hard-code it). Returns
// { xp, level, leveledUp }.
const txAddXpAndSyncLevel = db.transaction(
  (userId, guildId, amount, levelFn) => {
    stmtInsertUserDefaults.run(userId, guildId);
    const cur = stmtSelectXpLevel.get(userId, guildId);
    const newXp = (cur ? cur.xp : 0) + amount;
    const oldLevel = cur ? cur.level : 0;
    const newLevel = levelFn(newXp);
    stmtUpdateXpLevel.run(newXp, newLevel, userId, guildId);
    return { xp: newXp, level: newLevel, leveledUp: newLevel > oldLevel };
  },
);

// Atomic absolute set of xp + level (admin commands).
const txSetXpAndLevel = db.transaction((userId, guildId, xp, level) => {
  stmtInsertUserDefaults.run(userId, guildId);
  stmtUpdateXpLevel.run(xp, level, userId, guildId);
});

// Atomic "give item + coins" combo (mine, fish, casino draw).
const txAddItemAndCoins = db.transaction(
  (userId, guildId, item, itemAmount, coinsDelta) => {
    stmtInsertUserDefaults.run(userId, guildId);
    if (itemAmount > 0 && item) {
      const existing = stmtSelectInventoryItem.get(userId, guildId, item);
      if (existing) {
        stmtIncInventoryAmount.run(itemAmount, existing.id);
      } else {
        stmtInsertInventoryItem.run(userId, guildId, item, itemAmount);
      }
    }
    if (coinsDelta) stmtAddCoinsRow.run(coinsDelta, userId, guildId);
  },
);

// Atomic inventory decrement. Returns { removed, remaining }.
// `remaining` is null when the row was deleted.
const txDecrementItem = db.transaction((userId, guildId, item, amount) => {
  const existing = stmtSelectInventoryItem.get(userId, guildId, item);
  if (!existing) return { removed: 0, remaining: null };
  if (existing.amount <= amount) {
    stmtDeleteInventoryById.run(existing.id);
    return { removed: existing.amount, remaining: null };
  }
  const next = existing.amount - amount;
  stmtUpdateInventoryAmount.run(next, existing.id);
  return { removed: amount, remaining: next };
});

module.exports = {
  db,

  // Globals (key-value JSON storage, owner-scoped: blacklist, globalBans, etc.)
  /**
   * Récupère une valeur globale JSON par clé.
   * @param {string} key
   * @returns {*} valeur parsée ou null
   */
  getGlobal: (key) => {
    const row = db
      .prepare("SELECT value FROM globals WHERE key = ?")
      .get(key);
    if (!row) return null;
    try {
      return JSON.parse(row.value);
    } catch (_) {
      return null;
    }
  },
  /**
   * Insère ou met à jour une valeur globale (sérialisée en JSON).
   * @param {string} key
   * @param {*} value
   * @returns {void}
   */
  updateGlobal: (key, value) => {
    db.prepare(
      "INSERT INTO globals (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
    ).run(key, JSON.stringify(value));
  },
  // Mute presets
  /**
   * Liste les presets de mute d'un serveur.
   * @param {string} guildId
   * @returns {Array<object>} presets
   */
  getMutePresets: (guildId) =>
    db
      .prepare(
        "SELECT id, name, durationSeconds, reason FROM mute_presets WHERE guildId = ? ORDER BY name ASC",
      )
      .all(guildId),
  /**
   * Récupère un preset de mute par nom.
   * @param {string} guildId
   * @param {string} name
   * @returns {object|undefined} preset
   */
  getMutePreset: (guildId, name) =>
    db
      .prepare(
        "SELECT id, name, durationSeconds, reason FROM mute_presets WHERE guildId = ? AND name = ?",
      )
      .get(guildId, name),
  /**
   * Ajoute ou met à jour un preset de mute.
   * @param {string} guildId
   * @param {string} name
   * @param {number} durationSeconds
   * @param {string} [reason]
   * @returns {void}
   */
  addMutePreset: (guildId, name, durationSeconds, reason) => {
    db.prepare(
      "INSERT INTO mute_presets (guildId, name, durationSeconds, reason) VALUES (?, ?, ?, ?) ON CONFLICT(guildId, name) DO UPDATE SET durationSeconds = excluded.durationSeconds, reason = excluded.reason",
    ).run(guildId, name, durationSeconds, reason || null);
  },
  /**
   * Supprime un preset de mute.
   * @param {string} guildId
   * @param {string} name
   * @returns {boolean} true si supprimé
   */
  delMutePreset: (guildId, name) => {
    const r = db
      .prepare("DELETE FROM mute_presets WHERE guildId = ? AND name = ?")
      .run(guildId, name);
    return r.changes > 0;
  },

  /**
   * Vérifie si un utilisateur est blacklisté globalement.
   * @param {string} userId
   * @returns {boolean}
   */
  isBlacklisted: (userId) => {
    const row = db
      .prepare("SELECT value FROM globals WHERE key = 'blacklist'")
      .get();
    if (!row) return false;
    try {
      const list = JSON.parse(row.value);
      return Array.isArray(list) && list.some((e) => e.userId === userId);
    } catch (_) {
      return false;
    }
  },

  // Guilds
  /**
   * Récupère un serveur (le crée si absent) ou un champ précis.
   * @param {string} guildId
   * @param {string|null} [field]
   * @returns {object|*} ligne complète ou valeur du champ
   */
  getGuild: (guildId, field = null) => {
    let guild = stmtGetGuild.get(guildId);
    if (!guild) {
      // Collapse SELECT/INSERT/SELECT into INSERT OR IGNORE + SELECT.
      // Schema defaults supply all the columns the previous INSERT spelled out.
      stmtInsertGuildDefaults.run(guildId);
      guild = stmtGetGuild.get(guildId);
    }

    if (field !== null) {
      const val = guild[field];
      if (val === undefined || val === null) return null;
      try {
        return typeof val === "string" ? JSON.parse(val) : val;
      } catch (e) {
        return val;
      }
    }
    return guild;
  },

  /**
   * Met à jour des champs d'un serveur (objets sérialisés en JSON).
   * @param {string} guildId
   * @param {object} updates
   * @returns {object|null} résultat run() ou null si rien à mettre à jour
   */
  updateGuild: (guildId, updates) => {
    // S'assurer que le guild existe
    module.exports.getGuild(guildId);

    // Construire la requête dynamiquement
    const setClause = [];
    const values = [];

    for (const [key, value] of Object.entries(updates)) {
      if (!/^[a-zA-Z0-9_]+$/.test(key)) continue; // Prévention SQLi
      if (typeof value === "object" && value !== null) {
        // Pour les objets complexes, les stocker en JSON
        setClause.push(`${key} = ?`);
        values.push(JSON.stringify(value));
      } else {
        setClause.push(`${key} = ?`);
        values.push(value);
      }
    }

    if (setClause.length === 0) return null;

    values.push(guildId);
    return db
      .prepare(`UPDATE guilds SET ${setClause.join(",")} WHERE guildId = ?`)
      .run(...values);
  },

  // Users
  /**
   * Récupère un utilisateur (et le crée si absent) ou un champ précis.
   * @param {string} userId
   * @param {string} guildId
   * @param {string|null} [field]
   * @returns {object|*} ligne utilisateur ou valeur du champ
   */
  getUser: (userId, guildId, field = null) => {
    let user = stmtGetUser.get(userId, guildId);
    if (!user) {
      // INSERT OR IGNORE avoids a duplicate-key race and removes the prepare-on-call overhead.
      stmtInsertUserDefaults.run(userId, guildId);
      user = stmtGetUser.get(userId, guildId);
    }
    if (field && user[field]) {
      try {
        return typeof user[field] === "string"
          ? JSON.parse(user[field])
          : user[field];
      } catch (e) {
        return user[field];
      }
    }
    return user;
  },

  /**
   * Met à jour des champs d'un utilisateur (objets sérialisés en JSON).
   * @param {string} userId
   * @param {string} guildId
   * @param {object} updates
   * @returns {object|null} résultat run() ou null
   */
  setUser: (userId, guildId, updates) => {
    // S'assurer que l'utilisateur existe
    module.exports.getUser(userId, guildId);

    // Construire la requête dynamiquement
    const setClause = [];
    const values = [];

    for (const [key, value] of Object.entries(updates)) {
      if (!/^[a-zA-Z0-9_]+$/.test(key)) continue; // Prévention SQLi
      if (typeof value === "object" && value !== null) {
        setClause.push(`${key} = ?`);
        values.push(JSON.stringify(value));
      } else {
        setClause.push(`${key} = ?`);
        values.push(value);
      }
    }

    if (setClause.length === 0) return null;

    values.push(userId, guildId);
    return db
      .prepare(
        `UPDATE users SET ${setClause.join(",")} WHERE userId = ? AND guildId = ?`,
      )
      .run(...values);
  },

  // Alias de compatibilité: updateUser(userId, guildId, field, value) ou updateUser(userId, guildId, updates)
  /**
   * Alias: met à jour un utilisateur via (field, value) ou (updates).
   * @param {string} userId
   * @param {string} guildId
   * @param {string|object} fieldOrUpdates
   * @param {*} [value]
   * @returns {object|null}
   */
  updateUser: (userId, guildId, fieldOrUpdates, value) => {
    if (typeof fieldOrUpdates === "string") {
      return module.exports.setUser(userId, guildId, {
        [fieldOrUpdates]: value,
      });
    }
    return module.exports.setUser(userId, guildId, fieldOrUpdates);
  },

  /**
   * Ajoute de l'XP à un utilisateur.
   * @param {string} userId
   * @param {string} guildId
   * @param {number} amount
   * @returns {object} user mis à jour
   */
  addXP: (userId, guildId, amount) => {
    module.exports.getUser(userId, guildId); // crée l'utilisateur s'il n'existe pas
    db.prepare(
      "UPDATE users SET xp = xp + ? WHERE userId = ? AND guildId = ?",
    ).run(amount, userId, guildId);
    return module.exports.getUser(userId, guildId);
  },

  /**
   * Définit le niveau d'un utilisateur.
   * @param {string} userId
   * @param {string} guildId
   * @param {number} level
   * @returns {object} résultat run()
   */
  setLevel: (userId, guildId, level) => {
    return db
      .prepare("UPDATE users SET level = ? WHERE userId = ? AND guildId = ?")
      .run(level, userId, guildId);
  },

  /**
   * Met à jour XP et niveau en une requête.
   * @param {string} userId
   * @param {string} guildId
   * @param {number} newXp
   * @param {number} newLevel
   * @returns {object|undefined} résultat run()
   */
  updateUserLevels: (userId, guildId, newXp, newLevel) => {
    try {
      return db
        .prepare(
          "UPDATE users SET xp = ?, level = ? WHERE userId = ? AND guildId = ?",
        )
        .run(newXp, newLevel, userId, guildId);
    } catch (e) {
      Logger.error(`[DATABASE] Erreur updateUserLevels: ${e.message}`);
    }
  },

  // Economy Shop
  /**
   * Liste les items de la boutique d'un serveur.
   * @param {string} guildId
   * @returns {Array<object>} items
   */
  getEconomyShop: (guildId) => {
    return db
      .prepare("SELECT * FROM economy_shop WHERE guildId = ?")
      .all(guildId);
  },

  /**
   * Ajoute un item à la boutique.
   * @param {string} guildId
   * @param {{name:string, price:number, roleId?:string, itemType?:string, description?:string}} item
   * @returns {object} résultat run()
   */
  addShopItem: (guildId, item) => {
    // Handle undefined or empty string values by converting them to null for SQLite
    const roleId =
      item.roleId && item.roleId.trim() !== "" ? item.roleId : null;
    const itemType = item.itemType || "role";
    const description =
      item.description && item.description.trim() !== ""
        ? item.description
        : null;

    return db
      .prepare(
        "INSERT INTO economy_shop (guildId, name, description, price, roleId, itemType) VALUES (?, ?, ?, ?, ?, ?)",
      )
      .run(guildId, item.name, description, item.price, roleId, itemType);
  },

  /**
   * Supprime un item de la boutique.
   * @param {string} guildId
   * @param {number} id
   * @returns {object} résultat run()
   */
  deleteShopItem: (guildId, id) => {
    return db
      .prepare("DELETE FROM economy_shop WHERE id = ? AND guildId = ?")
      .run(id, guildId);
  },

  /**
   * Crédite des coins (cash) à un utilisateur.
   * @param {string} userId
   * @param {string} guildId
   * @param {number} amount
   * @returns {object} user mis à jour
   */
  addCoins: (userId, guildId, amount) => {
    db.prepare(
      "UPDATE users SET coins = coins + ? WHERE userId = ? AND guildId = ?",
    ).run(amount, userId, guildId);
    return module.exports.getUser(userId, guildId);
  },

  /**
   * Débite des coins (clampé à 0).
   * @param {string} userId
   * @param {string} guildId
   * @param {number} amount
   * @returns {object} user mis à jour
   */
  removeCoins: (userId, guildId, amount) => {
    db.prepare(
      "UPDATE users SET coins = CASE WHEN coins - ? < 0 THEN 0 ELSE coins - ? END WHERE userId = ? AND guildId = ?",
    ).run(amount, amount, userId, guildId);
    return module.exports.getUser(userId, guildId);
  },

  /**
   * Débite des coins en piochant cash puis banque.
   * @param {string} userId
   * @param {string} guildId
   * @param {number} amount
   * @returns {object} user mis à jour
   */
  removeGlobalCoins: (userId, guildId, amount) => {
    const user = module.exports.getUser(userId, guildId);
    let remaining = amount;
    let newCoins = user.coins;
    let newBank = user.bank;

    if (newCoins >= remaining) {
      newCoins -= remaining;
      remaining = 0;
    } else {
      remaining -= newCoins;
      newCoins = 0;
    }

    if (remaining > 0) {
      if (newBank >= remaining) {
        newBank -= remaining;
        remaining = 0;
      } else {
        newBank = 0;
        remaining = 0;
      }
    }

    db.prepare(
      "UPDATE users SET coins = ?, bank = ? WHERE userId = ? AND guildId = ?",
    ).run(newCoins, newBank, userId, guildId);
    return module.exports.getUser(userId, guildId);
  },

  /**
   * Tente de débiter des coins (échec si solde insuffisant).
   * @param {string} userId
   * @param {string} guildId
   * @param {number} amount
   * @returns {boolean} true si débité
   */
  tryRemoveCoins: (userId, guildId, amount) => {
    const info = db
      .prepare(
        "UPDATE users SET coins = coins - ? WHERE userId = ? AND guildId = ? AND coins >= ?",
      )
      .run(amount, userId, guildId, amount);
    return info.changes > 0;
  },

  /**
   * Définit le solde cash.
   * @param {string} userId
   * @param {string} guildId
   * @param {number} amount
   * @returns {object} user mis à jour
   */
  setCoins: (userId, guildId, amount) => {
    db.prepare(
      "UPDATE users SET coins = ? WHERE userId = ? AND guildId = ?",
    ).run(amount, userId, guildId);
    return module.exports.getUser(userId, guildId);
  },

  /**
   * Définit le solde banque.
   * @param {string} userId
   * @param {string} guildId
   * @param {number} amount
   * @returns {object} user mis à jour
   */
  setBank: (userId, guildId, amount) => {
    db.prepare(
      "UPDATE users SET bank = ? WHERE userId = ? AND guildId = ?",
    ).run(amount, userId, guildId);
    return module.exports.getUser(userId, guildId);
  },

  /**
   * Réinitialise la banque et fixe le cash au montant donné.
   * @param {string} userId
   * @param {string} guildId
   * @param {number} amount
   * @returns {object} user mis à jour
   */
  setGlobalCoins: (userId, guildId, amount) => {
    db.prepare(
      "UPDATE users SET coins = ?, bank = 0 WHERE userId = ? AND guildId = ?",
    ).run(amount, userId, guildId);
    return module.exports.getUser(userId, guildId);
  },

  /**
   * Crédite la banque.
   * @param {string} userId
   * @param {string} guildId
   * @param {number} amount
   * @returns {object} user mis à jour
   */
  addBank: (userId, guildId, amount) => {
    db.prepare(
      "UPDATE users SET bank = bank + ? WHERE userId = ? AND guildId = ?",
    ).run(amount, userId, guildId);
    return module.exports.getUser(userId, guildId);
  },

  /**
   * Débite la banque (clampé à 0).
   * @param {string} userId
   * @param {string} guildId
   * @param {number} amount
   * @returns {object} user mis à jour
   */
  removeBank: (userId, guildId, amount) => {
    db.prepare(
      "UPDATE users SET bank = CASE WHEN bank - ? < 0 THEN 0 ELSE bank - ? END WHERE userId = ? AND guildId = ?",
    ).run(amount, amount, userId, guildId);
    return module.exports.getUser(userId, guildId);
  },

  /**
   * Tente de débiter la banque (échec si solde insuffisant).
   * @param {string} userId
   * @param {string} guildId
   * @param {number} amount
   * @returns {boolean} true si débité
   */
  tryRemoveBank: (userId, guildId, amount) => {
    const info = db
      .prepare(
        "UPDATE users SET bank = bank - ? WHERE userId = ? AND guildId = ? AND bank >= ?",
      )
      .run(amount, userId, guildId, amount);
    return info.changes > 0;
  },

  /**
   * Remet à zéro cash et banque.
   * @param {string} userId
   * @param {string} guildId
   * @returns {object} user mis à jour
   */
  resetEconomy: (userId, guildId) => {
    db.prepare(
      "UPDATE users SET coins = 0, bank = 0 WHERE userId = ? AND guildId = ?",
    ).run(userId, guildId);
    return module.exports.getUser(userId, guildId);
  },

  /**
   * Récupère le rôle associé à un niveau.
   * @param {string} guildId
   * @param {number} level
   * @returns {object|undefined}
   */
  getLevelRole: (guildId, level) => {
    return db
      .prepare("SELECT * FROM level_roles WHERE guildId = ? AND level = ?")
      .get(guildId, level);
  },

  /**
   * Associe (ou remplace) un rôle pour un niveau.
   * @param {string} guildId
   * @param {number} level
   * @param {string} roleId
   * @returns {object} résultat run()
   */
  addLevelRole: (guildId, level, roleId) => {
    return db
      .prepare(
        "INSERT OR REPLACE INTO level_roles (guildId, level, roleId) VALUES (?, ?, ?)",
      )
      .run(guildId, level, roleId);
  },

  /**
   * Retire l'association rôle/niveau.
   * @param {string} guildId
   * @param {number} level
   * @returns {object} résultat run()
   */
  removeLevelRole: (guildId, level) => {
    return db
      .prepare("DELETE FROM level_roles WHERE guildId = ? AND level = ?")
      .run(guildId, level);
  },

  // Antiraid
  /**
   * Récupère la config antiraid (la crée si absente).
   * @param {string} guildId
   * @returns {object} config
   */
  getAntiraidConfig: (guildId) => {
    let config = db
      .prepare("SELECT * FROM antiraid_config WHERE guildId = ?")
      .get(guildId);
    if (!config) {
      // INSERT OR IGNORE collapses SELECT/INSERT/SELECT into a single round-trip on the miss path.
      db.prepare("INSERT OR IGNORE INTO antiraid_config (guildId) VALUES (?)").run(
        guildId,
      );
      config = db
        .prepare("SELECT * FROM antiraid_config WHERE guildId = ?")
        .get(guildId);
    }
    return config;
  },

  /**
   * Crée la ligne antiraid si elle n'existe pas (idempotent).
   * @param {string} guildId
   * @returns {object} résultat run()
   */
  createAntiraidConfig: (guildId) => {
    return db
      .prepare("INSERT OR IGNORE INTO antiraid_config (guildId) VALUES (?)")
      .run(guildId);
  },

  /**
   * Met à jour la config antiraid et synchronise les colonnes legacy de `guilds`.
   * @param {string} guildId
   * @param {object} updates
   * @returns {object|null} résultat run() ou null
   */
  updateAntiraidConfig: (guildId, updates) => {
    module.exports.createAntiraidConfig(guildId);

    // Construire la requête dynamiquement
    const setClause = [];
    const values = [];

    for (const [key, value] of Object.entries(updates)) {
      if (!/^[a-zA-Z0-9_]+$/.test(key)) continue; // Prévention SQLi
      setClause.push(`${key} = ?`);
      values.push(
        typeof value === "object" && value !== null
          ? JSON.stringify(value)
          : value,
      );
    }

    if (setClause.length === 0) return null;

    values.push(guildId);
    const result = db
      .prepare(
        `UPDATE antiraid_config SET ${setClause.join(", ")} WHERE guildId = ?`,
      )
      .run(...values);

    const legacyMirrors = {
      antiSpam: "antiSpam",
      antiLink: "antiLink",
      antiBadWords: "antiBadWords",
      antiBan: "antiban",
      antiBot: "antibot",
      antiChannel: "antichannel",
      raidMode: "antijoin",
    };
    const guildSet = [];
    const guildValues = [];
    for (const [sourceKey, guildKey] of Object.entries(legacyMirrors)) {
      if (updates[sourceKey] !== undefined) {
        guildSet.push(`${guildKey} = ?`);
        guildValues.push(
          typeof updates[sourceKey] === "boolean"
            ? updates[sourceKey]
              ? 1
              : 0
            : updates[sourceKey],
        );
      }
    }
    if (guildSet.length > 0) {
      module.exports.getGuild(guildId);
      guildValues.push(guildId);
      db.prepare(
        `UPDATE guilds SET ${guildSet.join(", ")} WHERE guildId = ?`,
      ).run(...guildValues);
    }

    return result;
  },

  // Invalide le cache interne d'isModuleEnabled (par-guilde ou global).
  /**
   * Invalide le cache des modules (un serveur ou tous).
   * @param {string|null} [guildId]
   * @returns {void}
   */
  invalidateModuleCache: (guildId) => {
    if (guildId) moduleStatusCache.delete(guildId);
    else moduleStatusCache.clear();
  },

  /**
   * Liste les modules d'un serveur et leur état.
   * @param {string} guildId
   * @returns {Array<{moduleName:string,isEnabled:number}>}
   */
  getGuildModules: (guildId) => {
    return db
      .prepare(
        "SELECT moduleName, isEnabled FROM guild_modules WHERE guildId = ?",
      )
      .all(guildId);
  },

  /**
   * Active/désactive un module pour un serveur et invalide le cache.
   * @param {string} guildId
   * @param {string} moduleName
   * @param {boolean} isEnabled
   * @returns {object} résultat run()
   */
  updateGuildModule: (guildId, moduleName, isEnabled) => {
    const result = db
      .prepare(
        "INSERT OR REPLACE INTO guild_modules (guildId, moduleName, isEnabled) VALUES (?, ?, ?)",
      )
      .run(guildId, moduleName, isEnabled ? 1 : 0);
    // Invalider le cache interne pour que la prochaine vérification relise la DB
    const cached = moduleStatusCache.get(guildId);
    if (cached) cached.delete(moduleName);
    return result;
  },

  /**
   * Indique si un module est actif (cache interne, défaut true).
   * @param {string} guildId
   * @param {string} moduleName
   * @returns {boolean}
   */
  isModuleEnabled: (guildId, moduleName) => {
    // Cache interne par-guilde pour éviter une lecture DB par message.
    // Invalidé par updateGuildModule => coherent avec les toggles dashboard.
    let guildMap = moduleStatusCache.get(guildId);
    if (!guildMap) {
      guildMap = new Map();
      moduleStatusCache.set(guildId, guildMap);
    }
    if (guildMap.has(moduleName)) return guildMap.get(moduleName);
    const row = stmtIsModuleEnabled.get(guildId, moduleName);
    const enabled = row ? row.isEnabled === 1 : true;
    guildMap.set(moduleName, enabled);
    return enabled;
  },
  /**
   * Renvoie le top des commandes (placeholder, retourne []).
   * @param {string} guildId
   * @param {number} [limit=5]
   * @returns {Array}
   */
  getTopCommands: (guildId, limit = 5) => {
    // Version simplifiée car pas encore de table de tracking d'usage fin
    return [];
  },

  /**
   * Renvoie l'historique de stats (placeholder, retourne []).
   * @param {string} guildId
   * @param {number} [days=7]
   * @returns {Array}
   */
  getHistoricalStats: (guildId, days = 7) => {
    // Version simplifiée
    return [];
  },

  /**
   * Distribution des membres par niveau.
   * @param {string} guildId
   * @returns {Array<{level:number,count:number}>}
   */
  getMemberLevelDistribution: (guildId) => {
    const rows = db
      .prepare(
        "SELECT level, COUNT(*) as count FROM users WHERE guildId = ? GROUP BY level",
      )
      .all(guildId);
    return rows;
  },

  // AFK
  /**
   * Récupère l'état AFK d'un utilisateur.
   * @param {string} userId
   * @param {string} guildId
   * @returns {object|undefined}
   */
  getAfk: (userId, guildId) => {
    return db
      .prepare("SELECT * FROM afk WHERE userId = ? AND guildId = ?")
      .get(userId, guildId);
  },

  /**
   * Définit un état AFK avec raison.
   * @param {string} userId
   * @param {string} guildId
   * @param {string} reason
   * @returns {object} résultat run()
   */
  setAfk: (userId, guildId, reason) => {
    return db
      .prepare(
        "INSERT OR REPLACE INTO afk (userId, guildId, reason, timestamp) VALUES (?, ?, ?, ?)",
      )
      .run(userId, guildId, reason, Date.now());
  },

  /**
   * Supprime l'état AFK.
   * @param {string} userId
   * @param {string} guildId
   * @returns {object} résultat run()
   */
  deleteAfk: (userId, guildId) => {
    return db
      .prepare("DELETE FROM afk WHERE userId = ? AND guildId = ?")
      .run(userId, guildId);
  },

  // Badwords
  /**
   * Liste les badwords d'un serveur.
   * @param {string} guildId
   * @returns {Array<{word:string}>}
   */
  getBadwords: (guildId) => {
    return db
      .prepare("SELECT word FROM badwords WHERE guildId = ?")
      .all(guildId);
  },

  /**
   * Ajoute un badword.
   * @param {string} guildId
   * @param {string} word
   * @returns {object} résultat run()
   */
  addBadword: (guildId, word) => {
    return db
      .prepare("INSERT OR IGNORE INTO badwords (guildId, word) VALUES (?, ?)")
      .run(guildId, word);
  },

  /**
   * Retire un badword.
   * @param {string} guildId
   * @param {string} word
   * @returns {object} résultat run()
   */
  removeBadword: (guildId, word) => {
    return db
      .prepare("DELETE FROM badwords WHERE guildId = ? AND word = ?")
      .run(guildId, word);
  },

  /**
   * Récupère les permissions de rôles pour une commande.
   * @param {string} guildId
   * @param {string[]} roleIds
   * @param {string} commandName
   * @returns {Array<object>}
   */
  getRolePermissions: (guildId, roleIds, commandName) => {
    if (!roleIds || roleIds.length === 0) return [];
    const placeholders = roleIds.map(() => "?").join(",");
    return db
      .prepare(
        `SELECT * FROM role_permissions WHERE guildId = ? AND commandName = ? AND roleId IN (${placeholders})`,
      )
      .all(guildId, commandName, ...roleIds);
  },

  /**
   * Indique si une commande a au moins une permission de rôle.
   * @param {string} guildId
   * @param {string} commandName
   * @returns {boolean}
   */
  commandHasRolePerms: (guildId, commandName) => {
    return (
      db
        .prepare(
          "SELECT COUNT(*) as c FROM role_permissions WHERE guildId = ? AND commandName = ?",
        )
        .get(guildId, commandName).c > 0
    );
  },

  /**
   * Récupère une commande personnalisée par nom.
   * @param {string} guildId
   * @param {string} name
   * @returns {object|undefined}
   */
  getCustomCommand: (guildId, name) => {
    return db
      .prepare("SELECT * FROM custom_commands WHERE guildId = ? AND name = ?")
      .get(guildId, name);
  },

  /**
   * Liste les commandes personnalisées d'un serveur.
   * @param {string} guildId
   * @returns {Array<object>}
   */
  getCustomCommands: (guildId) => {
    return db
      .prepare("SELECT * FROM custom_commands WHERE guildId = ?")
      .all(guildId);
  },

  /**
   * Ajoute ou remplace une commande personnalisée.
   * @param {string} guildId
   * @param {string} name
   * @param {string} response
   * @returns {object} résultat run()
   */
  addCustomCommand: (guildId, name, response) => {
    return db
      .prepare(
        "INSERT OR REPLACE INTO custom_commands (guildId, name, response) VALUES (?, ?, ?)",
      )
      .run(guildId, name, response);
  },

  /**
   * Supprime une commande personnalisée.
   * @param {string} guildId
   * @param {string} name
   * @returns {object} résultat run()
   */
  deleteCustomCommand: (guildId, name) => {
    return db
      .prepare("DELETE FROM custom_commands WHERE guildId = ? AND name = ?")
      .run(guildId, name);
  },

  /**
   * Récupère une lettre par identifiant.
   * @param {string|number} id
   * @returns {object|undefined}
   */
  getLettre: (id) => {
    return db.prepare("SELECT * FROM lettres WHERE id = ?").get(id);
  },

  /**
   * Insère une lettre.
   * @param {string|number} id
   * @param {string} content
   * @returns {object} résultat run()
   */
  insertLettre: (id, content) => {
    return db
      .prepare("INSERT INTO lettres (id, content) VALUES (?, ?)")
      .run(id, content);
  },

  /**
   * No-op : la table lettres est créée au démarrage.
   * @returns {void}
   */
  createLettresTable: () => {
    // La table est déjà créée dans le bloc d'initialisation principal
  },

  // Warnings
  /**
   * Ajoute un avertissement à un utilisateur.
   * @param {string} userId
   * @param {string} guildId
   * @param {string} reason
   * @param {string} moderatorId
   * @returns {object} résultat run()
   */
  addWarning: (userId, guildId, reason, moderatorId) => {
    return db
      .prepare(
        "INSERT INTO warnings (userId, guildId, reason, moderatorId) VALUES (?, ?, ?, ?)",
      )
      .run(userId, guildId, reason, moderatorId);
  },

  // Alias de compatibilité: addWarn(userId, guildId, moderatorId, reason)
  /**
   * Alias d'addWarning avec ordre d'arguments alternatif.
   * @param {string} userId
   * @param {string} guildId
   * @param {string} moderatorId
   * @param {string} reason
   * @returns {object} résultat run()
   */
  addWarn: (userId, guildId, moderatorId, reason) => {
    return db
      .prepare(
        "INSERT INTO warnings (userId, guildId, reason, moderatorId) VALUES (?, ?, ?, ?)",
      )
      .run(userId, guildId, reason, moderatorId);
  },

  /**
   * Liste les avertissements d'un utilisateur.
   * @param {string} userId
   * @param {string} guildId
   * @returns {Array<object>}
   */
  getWarnings: (userId, guildId) => {
    return db
      .prepare("SELECT * FROM warnings WHERE userId = ? AND guildId = ?")
      .all(userId, guildId);
  },

  // Alias de compatibilité
  /**
   * Alias de getWarnings.
   * @param {string} userId
   * @param {string} guildId
   * @returns {Array<object>}
   */
  getWarns: (userId, guildId) => {
    return db
      .prepare("SELECT * FROM warnings WHERE userId = ? AND guildId = ?")
      .all(userId, guildId);
  },

  /**
   * Supprime tous les avertissements d'un utilisateur.
   * @param {string} userId
   * @param {string} guildId
   * @returns {object} résultat run()
   */
  clearWarnings: (userId, guildId) => {
    return db
      .prepare("DELETE FROM warnings WHERE userId = ? AND guildId = ?")
      .run(userId, guildId);
  },

  // Alias de compatibilité
  /**
   * Alias de clearWarnings.
   * @param {string} userId
   * @param {string} guildId
   * @returns {object} résultat run()
   */
  clearWarns: (userId, guildId) => {
    return db
      .prepare("DELETE FROM warnings WHERE userId = ? AND guildId = ?")
      .run(userId, guildId);
  },

  // Bot Owner
  /**
   * Vérifie si l'utilisateur est owner (env OWNER_ID ou table bot_owners).
   * @param {string} userId
   * @returns {boolean}
   */
  isBotOwner: (userId) => {
    if (
      process.env.OWNER_ID &&
      process.env.OWNER_ID.split(",")
        .map((id) => id.trim())
        .includes(userId)
    )
      return true;
    const owner = db
      .prepare("SELECT userId FROM bot_owners WHERE userId = ?")
      .get(userId);
    return !!owner;
  },

  /**
   * Liste les owners du bot.
   * @returns {Array<object>}
   */
  getBotOwners: () => {
    return db.prepare("SELECT * FROM bot_owners").all();
  },

  /**
   * Ajoute un owner.
   * @param {string} userId
   * @returns {object} résultat run()
   */
  addBotOwner: (userId) => {
    return db
      .prepare(
        "INSERT OR IGNORE INTO bot_owners (userId, addedAt) VALUES (?, ?)",
      )
      .run(userId, Date.now());
  },

  /**
   * Retire un owner.
   * @param {string} userId
   * @returns {object} résultat run()
   */
  removeBotOwner: (userId) => {
    return db.prepare("DELETE FROM bot_owners WHERE userId = ?").run(userId);
  },

  // Speed Phrases
  /**
   * Liste toutes les speed phrases.
   * @returns {Array<object>}
   */
  getSpeedPhrases: () => {
    return db.prepare("SELECT * FROM speed_phrases").all();
  },

  /**
   * Ajoute ou remplace une speed phrase.
   * @param {string} phrase
   * @param {string} name
   * @returns {object} résultat run()
   */
  addSpeedPhrase: (phrase, name) => {
    return db
      .prepare(
        "INSERT OR REPLACE INTO speed_phrases (phrase, name) VALUES (?, ?)",
      )
      .run(phrase, name);
  },

  /**
   * Supprime une speed phrase.
   * @param {string} phrase
   * @returns {object} résultat run()
   */
  removeSpeedPhrase: (phrase) => {
    return db.prepare("DELETE FROM speed_phrases WHERE phrase = ?").run(phrase);
  },

  // Granular Antiraid Whitelist
  /**
   * Liste les entrées whitelist antiraid d'un serveur.
   * @param {string} guildId
   * @returns {Array<object>}
   */
  getAntiraidWhitelist: (guildId) => {
    return db
      .prepare("SELECT * FROM antiraid_whitelist WHERE guildId = ?")
      .all(guildId);
  },

  /**
   * Récupère les bypass antiraid d'un utilisateur.
   * @param {string} guildId
   * @param {string} userId
   * @returns {string[]|null}
   */
  getAntiraidWhitelistUser: (guildId, userId) => {
    const row = db
      .prepare(
        "SELECT bypasses FROM antiraid_whitelist WHERE guildId = ? AND userId = ?",
      )
      .get(guildId, userId);
    return row && row.bypasses ? JSON.parse(row.bypasses) : null;
  },

  /**
   * Définit les bypass antiraid d'un utilisateur.
   * @param {string} guildId
   * @param {string} userId
   * @param {string[]} bypassesArray
   * @returns {object} résultat run()
   */
  setAntiraidWhitelistUser: (guildId, userId, bypassesArray) => {
    return db
      .prepare(
        "INSERT OR REPLACE INTO antiraid_whitelist (guildId, userId, bypasses) VALUES (?, ?, ?)",
      )
      .run(guildId, userId, JSON.stringify(bypassesArray));
  },

  /**
   * Retire l'utilisateur de la whitelist antiraid.
   * @param {string} guildId
   * @param {string} userId
   * @returns {object} résultat run()
   */
  removeAntiraidWhitelistUser: (guildId, userId) => {
    return db
      .prepare(
        "DELETE FROM antiraid_whitelist WHERE guildId = ? AND userId = ?",
      )
      .run(guildId, userId);
  },

  // VoiceMaster
  /**
   * Récupère la config VoiceMaster d'un serveur.
   * @param {string} guildId
   * @returns {object|undefined}
   */
  getVoiceMasterConfig: (guildId) => {
    return db
      .prepare("SELECT * FROM voicemaster_config WHERE guildId = ?")
      .get(guildId);
  },

  /**
   * Enregistre un salon VoiceMaster créé.
   * @param {string} channelId
   * @param {string} guildId
   * @param {string} ownerId
   * @returns {object} résultat run()
   */
  createVoiceMasterChannel: (channelId, guildId, ownerId) => {
    return db
      .prepare(
        "INSERT INTO voicemaster_channels (channelId, guildId, ownerId) VALUES (?, ?, ?)",
      )
      .run(channelId, guildId, ownerId);
  },

  /**
   * Récupère un salon VoiceMaster par identifiant.
   * @param {string} channelId
   * @returns {object|undefined}
   */
  getVoiceMasterChannel: (channelId) => {
    return db
      .prepare("SELECT * FROM voicemaster_channels WHERE channelId = ?")
      .get(channelId);
  },

  /**
   * Supprime un salon VoiceMaster.
   * @param {string} channelId
   * @returns {object} résultat run()
   */
  deleteVoiceMasterChannel: (channelId) => {
    return db
      .prepare("DELETE FROM voicemaster_channels WHERE channelId = ?")
      .run(channelId);
  },

  // Private Voice Channels
  /**
   * Upsert un salon vocal privé avec sa data JSON.
   * @param {string} channelId
   * @param {string} guildId
   * @param {string} ownerId
   * @param {object} pvData
   * @returns {object} résultat run()
   */
  setPrivateVoice: (channelId, guildId, ownerId, pvData) => {
    // Single UPSERT replaces the prior SELECT-then-INSERT/UPDATE round-trip.
    const dataJson = JSON.stringify(pvData);
    return db
      .prepare(
        `INSERT INTO private_voice_channels (channelId, guildId, ownerId, data)
         VALUES (?, ?, ?, ?)
         ON CONFLICT(channelId) DO UPDATE SET
           guildId = excluded.guildId,
           ownerId = excluded.ownerId,
           data = excluded.data`,
      )
      .run(channelId, guildId, ownerId, dataJson);
  },

  /**
   * Récupère un salon vocal privé (data JSON parsée).
   * @param {string} channelId
   * @returns {object|undefined}
   */
  getPrivateVoice: (channelId) => {
    const row = db
      .prepare("SELECT * FROM private_voice_channels WHERE channelId = ?")
      .get(channelId);
    if (row && row.data) {
      try {
        return { ...row, data: JSON.parse(row.data) };
      } catch (e) {
        Logger.error(
          `[DATABASE] Error parsing private voice data for channel ${channelId}:`,
          e,
        );
        return row; // Return raw data if parsing fails
      }
    }
    return row;
  },

  /**
   * Supprime un salon vocal privé.
   * @param {string} channelId
   * @returns {object} résultat run()
   */
  deletePrivateVoice: (channelId) => {
    return db
      .prepare("DELETE FROM private_voice_channels WHERE channelId = ?")
      .run(channelId);
  },

  /**
   * Liste tous les salons vocaux privés (data JSON parsée).
   * @returns {Array<object>}
   */
  getAllPrivateVoices: () => {
    const rows = db.prepare("SELECT * FROM private_voice_channels").all();
    return rows.map((row) => {
      if (row.data) {
        try {
          return { ...row, data: JSON.parse(row.data) };
        } catch (e) {
          Logger.error(
            `[DATABASE] Error parsing private voice data for channel ${row.channelId}:`,
            e,
          );
          return row;
        }
      }
      return row;
    });
  },

  // Dog States
  /**
   * Liste tous les états "dog" en cours.
   * @returns {Array<object>}
   */
  getAllDogStates: () => {
    return db.prepare("SELECT * FROM dog_states").all();
  },

  /**
   * Crée/remplace un état "dog".
   * @param {string} userId
   * @param {string} guildId
   * @param {string} masterId
   * @returns {object} résultat run()
   */
  addDogState: (userId, guildId, masterId) => {
    return db
      .prepare(
        "INSERT OR REPLACE INTO dog_states (userId, guildId, masterId) VALUES (?, ?, ?)",
      )
      .run(userId, guildId, masterId);
  },

  /**
   * Supprime l'état "dog" d'un utilisateur.
   * @param {string} userId
   * @param {string} guildId
   * @returns {object} résultat run()
   */
  removeDogState: (userId, guildId) => {
    return db
      .prepare("DELETE FROM dog_states WHERE userId = ? AND guildId = ?")
      .run(userId, guildId);
  },

  // Bot Settings
  /**
   * Récupère les settings globaux du bot (id=1).
   * @returns {object}
   */
  getBotSettings: () => {
    // Row id=1 is seeded at module load (line ~685), so the row exists.
    // One SELECT is enough; the prior fallback INSERT+SELECT was dead code on the hot path.
    let settings = db
      .prepare("SELECT * FROM bot_settings WHERE id = 1")
      .get();
    if (!settings) {
      db.prepare(
        "INSERT OR IGNORE INTO bot_settings (id, presenceStatus, customStatus, themeColor) VALUES (1,'online','','#2B2D31')",
      ).run();
      settings = db.prepare("SELECT * FROM bot_settings WHERE id = 1").get();
    }
    return settings;
  },

  /**
   * Met à jour les settings globaux du bot.
   * @param {object} updates
   * @returns {object|null} résultat run() ou null
   */
  updateBotSettings: (updates) => {
    const setClause = [];
    const values = [];

    for (const [key, value] of Object.entries(updates)) {
      if (!/^[a-zA-Z0-9_]+$/.test(key)) continue;
      setClause.push(`${key} = ?`);
      values.push(value);
    }

    if (setClause.length === 0) return null;

    return db
      .prepare(`UPDATE bot_settings SET ${setClause.join(", ")} WHERE id = 1`)
      .run(...values);
  },

  // Stats Channels
  /**
   * Liste toutes les configs de stats channels.
   * @returns {Array<object>}
   */
  getStatsChannels: () => {
    return db.prepare("SELECT * FROM stats_channels").all();
  },

  // Birthdays
  /**
   * Liste les anniversaires d'un jour/mois donné.
   * @param {number} day
   * @param {number} month
   * @returns {Array<object>}
   */
  getBirthdays: (day, month) => {
    return db
      .prepare("SELECT * FROM birthdays WHERE day = ? AND month = ?")
      .all(day, month);
  },

  // Giveaways
  /**
   * Crée (ou remplace) un giveaway actif.
   * @param {string} messageId
   * @param {string} channelId
   * @param {string} guildId
   * @param {string} prize
   * @param {number} winnersCount
   * @param {number} endsAt
   * @param {string} hostId
   * @param {Array<object>} [requirements=[]]
   * @returns {object} résultat run()
   */
  createGiveaway: (
    messageId,
    channelId,
    guildId,
    prize,
    winnersCount,
    endsAt,
    hostId,
    requirements = [],
  ) => {
    return db
      .prepare(
        `
 INSERT OR REPLACE INTO giveaways (messageId, channelId, guildId, prize, winnersCount, endsAt, hostId, requirements, winners, participantsCount, endedAt, status, ended)
 VALUES (?, ?, ?, ?, ?, ?, ?, ?,'[]', 0, NULL,'active', 0)
 `,
      )
      .run(
        messageId,
        channelId,
        guildId,
        prize,
        winnersCount,
        endsAt,
        hostId,
        JSON.stringify(requirements || []),
      );
  },

  /**
   * Récupère un giveaway par message (filtre serveur facultatif).
   * @param {string} messageId
   * @param {string|null} [guildId]
   * @returns {object|undefined}
   */
  getGiveaway: (messageId, guildId = null) => {
    if (guildId)
      return db
        .prepare("SELECT * FROM giveaways WHERE messageId = ? AND guildId = ?")
        .get(messageId, guildId);
    return db
      .prepare("SELECT * FROM giveaways WHERE messageId = ?")
      .get(messageId);
  },

  /**
   * Récupère un giveaway actif par message.
   * @param {string} messageId
   * @returns {object|undefined}
   */
  getActiveGiveaway: (messageId) => {
    return db
      .prepare("SELECT * FROM giveaways WHERE messageId = ? AND ended = 0")
      .get(messageId);
  },

  /**
   * Liste tous les giveaways actifs.
   * @returns {Array<object>}
   */
  getActiveGiveaways: () => {
    return db.prepare("SELECT * FROM giveaways WHERE ended = 0").all();
  },

  /**
   * Inscrit un utilisateur à un giveaway.
   * @param {string} messageId
   * @param {string} guildId
   * @param {string} userId
   * @returns {object} résultat run()
   */
  addGiveawayEntry: (messageId, guildId, userId) => {
    return db
      .prepare(
        "INSERT OR IGNORE INTO giveaway_entries (messageId, guildId, userId) VALUES (?, ?, ?)",
      )
      .run(messageId, guildId, userId);
  },

  /**
   * Désinscrit un utilisateur d'un giveaway.
   * @param {string} messageId
   * @param {string} userId
   * @returns {object} résultat run()
   */
  removeGiveawayEntry: (messageId, userId) => {
    return db
      .prepare(
        "DELETE FROM giveaway_entries WHERE messageId = ? AND userId = ?",
      )
      .run(messageId, userId);
  },

  /**
   * Vérifie si un utilisateur est inscrit.
   * @param {string} messageId
   * @param {string} userId
   * @returns {boolean}
   */
  hasGiveawayEntry: (messageId, userId) => {
    return !!db
      .prepare(
        "SELECT 1 FROM giveaway_entries WHERE messageId = ? AND userId = ?",
      )
      .get(messageId, userId);
  },

  /**
   * Liste les userIds inscrits à un giveaway.
   * @param {string} messageId
   * @returns {string[]}
   */
  getGiveawayEntries: (messageId) => {
    return db
      .prepare(
        "SELECT userId FROM giveaway_entries WHERE messageId = ? ORDER BY joinedAt ASC",
      )
      .all(messageId)
      .map((row) => row.userId);
  },

  /**
   * Termine un giveaway et enregistre les gagnants.
   * @param {string} messageId
   * @param {string[]} [winners=[]]
   * @param {number} [participantsCount=0]
   * @returns {object} résultat run()
   */
  endGiveaway: (messageId, winners = [], participantsCount = 0) => {
    return db
      .prepare(
        "UPDATE giveaways SET ended = 1, status ='ended', winners = ?, participantsCount = ?, endedAt = ? WHERE messageId = ?",
      )
      .run(
        JSON.stringify(winners || []),
        participantsCount || 0,
        Date.now(),
        messageId,
      );
  },

  // Stats Channels Configuration
  /**
   * Récupère la config de stats channels d'un serveur.
   * @param {string} guildId
   * @returns {object|undefined}
   */
  getStatsConfig: (guildId) => {
    return db
      .prepare("SELECT * FROM stats_channels WHERE guildId = ?")
      .get(guildId);
  },

  /**
   * Crée ou met à jour la config stats channels (clés filtrées).
   * @param {string} guildId
   * @param {object} config
   * @returns {object|null} résultat run() ou null
   */
  saveStatsConfig: (guildId, config) => {
    const existing = db
      .prepare("SELECT guildId FROM stats_channels WHERE guildId = ?")
      .get(guildId);

    // Valid keys based on the schema (matching stats_channels table columns)
    const validKeys = [
      "categoryId",
      "membersId",
      "topId",
      "onlineId",
      "vocalId",
      "inviteId",
      "inviteCode",
    ];
    const filteredConfig = {};
    for (const key of Object.keys(config)) {
      if (validKeys.includes(key)) {
        filteredConfig[key] = config[key];
      } else if (key === "totalId") {
        // Alias for membersId
        filteredConfig["membersId"] = config[key];
      }
    }

    if (Object.keys(filteredConfig).length === 0) return null;

    if (existing) {
      const fields = Object.keys(filteredConfig)
        .map((key) => `${key} = ?`)
        .join(", ");
      const values = [...Object.values(filteredConfig), guildId];
      return db
        .prepare(`UPDATE stats_channels SET ${fields} WHERE guildId = ?`)
        .run(...values);
    } else {
      const keys = ["guildId", ...Object.keys(filteredConfig)];
      const placeholders = keys.map(() => "?").join(", ");
      const values = [guildId, ...Object.values(filteredConfig)];
      return db
        .prepare(
          `INSERT INTO stats_channels (${keys.join(", ")}) VALUES (${placeholders})`,
        )
        .run(...values);
    }
  },

  // Nettoyage périodique
  /**
   * Démarre le nettoyage horaire des entrées temporaires expirées (idempotent).
   * @returns {void}
   */
  startCleanupInterval: () => {
    if (module.exports._cleanupIntervalId) return; // idempotent
    module.exports._cleanupIntervalId = setInterval(
      () => {
        try {
          const now = Date.now();
          db.prepare(
            "DELETE FROM temporaries WHERE expiresAt > 0 AND expiresAt < ?",
          ).run(now);
        } catch (e) {
          Logger.error(`[DATABASE] Error during cleanup: ${e.message}`);
        }
      },
      60 * 60 * 1000,
    ); // 1 hour
  },
  /**
   * Arrête l'intervalle de nettoyage.
   * @returns {void}
   */
  stopCleanupInterval: () => {
    if (module.exports._cleanupIntervalId) {
      clearInterval(module.exports._cleanupIntervalId);
      module.exports._cleanupIntervalId = null;
    }
  },

  // --- Maintenance SQLite : VACUUM périodique + snapshots ------------------
  // Le VACUUM compacte le fichier et libère l'espace fragmenté. Bloquant donc
  // déclenché hors trafic critique (hebdomadaire). En WAL, on checkpoint puis
  // VACUUM pour garantir un fichier compacté propre.
  /**
   * Exécute un VACUUM SQLite après checkpoint WAL.
   * @returns {boolean} true si succès
   */
  runVacuum: () => {
    try {
      try {
        db.pragma("wal_checkpoint(TRUNCATE)");
      } catch (e) {
        // checkpoint best-effort, on continue
      }
      db.exec("VACUUM");
      Logger.info("[DATABASE] VACUUM terminé avec succès.");
      return true;
    } catch (e) {
      Logger.error(`[DATABASE] Erreur VACUUM : ${e.message}`);
      return false;
    }
  },
  /**
   * Démarre l'intervalle hebdomadaire de VACUUM (idempotent).
   * @returns {void}
   */
  startVacuumInterval: () => {
    if (module.exports._vacuumIntervalId) return; // idempotent
    // Hebdomadaire : 7 jours
    module.exports._vacuumIntervalId = setInterval(
      () => {
        module.exports.runVacuum();
      },
      7 * 24 * 60 * 60 * 1000,
    );
  },
  /**
   * Arrête l'intervalle de VACUUM.
   * @returns {void}
   */
  stopVacuumInterval: () => {
    if (module.exports._vacuumIntervalId) {
      clearInterval(module.exports._vacuumIntervalId);
      module.exports._vacuumIntervalId = null;
    }
  },

  // Répertoire des snapshots (créé à la demande)
  _snapshotsDir: () => {
    const fs = require("fs");
    const dir = path.join(dataDir, "snapshots");
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    return dir;
  },

  // Chemin du fichier DB principal
  /**
   * Renvoie le chemin absolu du fichier de base de données.
   * @returns {string}
   */
  getDbPath: () => path.join(dataDir, "bot.db"),

  // Crée un snapshot atomique via db.backup() (better-sqlite3).
  // Retourne { ok, file, size } ou { ok:false, error }.
  /**
   * Crée un snapshot atomique de la DB (élague à 7 par défaut).
   * @returns {Promise<{ok:boolean, file?:string, size?:number, error?:string}>}
   */
  createSnapshot: async () => {
    const fs = require("fs");
    try {
      const dir = module.exports._snapshotsDir();
      const iso = new Date().toISOString().replace(/[:.]/g, "-");
      const file = path.join(dir, `bot-${iso}.db`);
      await db.backup(file);
      const size = fs.existsSync(file) ? fs.statSync(file).size : 0;
      module.exports.pruneSnapshots(7);
      Logger.info(`[DATABASE] Snapshot créé : ${path.basename(file)}`);
      return { ok: true, file, size };
    } catch (e) {
      Logger.error(`[DATABASE] Erreur snapshot : ${e.message}`);
      return { ok: false, error: e.message };
    }
  },

  // Liste les snapshots disponibles, triés du plus récent au plus ancien.
  /**
   * Liste les snapshots, du plus récent au plus ancien.
   * @returns {Array<{id:string,name:string,path:string,size:number,mtime:number}>}
   */
  listSnapshots: () => {
    const fs = require("fs");
    try {
      const dir = module.exports._snapshotsDir();
      const files = fs
        .readdirSync(dir)
        .filter((f) => /^bot-.*\.db$/.test(f))
        .map((name) => {
          const full = path.join(dir, name);
          const st = fs.statSync(full);
          return {
            id: name.replace(/^bot-/, "").replace(/\.db$/, ""),
            name,
            path: full,
            size: st.size,
            mtime: st.mtimeMs,
          };
        })
        .sort((a, b) => b.mtime - a.mtime);
      return files;
    } catch (e) {
      Logger.error(`[DATABASE] Erreur listSnapshots : ${e.message}`);
      return [];
    }
  },

  // Conserve les `keep` snapshots les plus récents, supprime les autres.
  /**
   * Élague les snapshots et garde uniquement les `keep` plus récents.
   * @param {number} [keep=7]
   * @returns {number} nombre de snapshots supprimés
   */
  pruneSnapshots: (keep = 7) => {
    const fs = require("fs");
    try {
      const all = module.exports.listSnapshots();
      if (all.length <= keep) return 0;
      const removed = all.slice(keep);
      for (const s of removed) {
        try {
          fs.unlinkSync(s.path);
        } catch (_) {}
      }
      Logger.info(`[DATABASE] Pruned ${removed.length} snapshot(s) ancien(s).`);
      return removed.length;
    } catch (e) {
      Logger.error(`[DATABASE] Erreur pruneSnapshots : ${e.message}`);
      return 0;
    }
  },

  // Restaure un snapshot : copie le fichier sur bot.db.pending. Le swap réel
  // doit être fait au prochain démarrage par le launcher (ou manuellement),
  // ce qui évite tout accès concurrent sur le fichier ouvert. L'appelant
  // doit ensuite arrêter le process (process.exit) pour que la restauration
  // prenne effet au prochain démarrage.
  /**
   * Prépare la restauration d'un snapshot (effective au prochain démarrage).
   * @param {string} snapshotId
   * @returns {{ok:boolean, snapshot?:object, pending?:string, error?:string}}
   */
  stageRestore: (snapshotId) => {
    const fs = require("fs");
    try {
      const all = module.exports.listSnapshots();
      const snap = all.find(
        (s) => s.id === snapshotId || s.name === snapshotId,
      );
      if (!snap) return { ok: false, error: "Snapshot introuvable." };
      const pending = path.join(dataDir, "bot.db.pending");
      fs.copyFileSync(snap.path, pending);
      Logger.info(
        `[DATABASE] Restauration préparée depuis ${snap.name}. Redémarrage requis.`,
      );
      return { ok: true, snapshot: snap, pending };
    } catch (e) {
      Logger.error(`[DATABASE] Erreur stageRestore : ${e.message}`);
      return { ok: false, error: e.message };
    }
  },

  // Tickets
  /**
   * Récupère la config tickets d'un serveur.
   * @param {string} guildId
   * @returns {object|undefined}
   */
  getTicketConfig: (guildId) => {
    return db
      .prepare("SELECT * FROM tickets_config WHERE guildId = ?")
      .get(guildId);
  },

  /**
   * Récupère le ticket ouvert d'un utilisateur.
   * @param {string} guildId
   * @param {string} userId
   * @returns {object|undefined}
   */
  getTicket: (guildId, userId) => {
    return db
      .prepare(
        "SELECT * FROM tickets WHERE guildId = ? AND userId = ? AND status ='open'",
      )
      .get(guildId, userId);
  },

  /**
   * Récupère un ticket par identifiant de salon.
   * @param {string} channelId
   * @returns {object|undefined}
   */
  getTicketByChannel: (channelId) => {
    return db
      .prepare("SELECT * FROM tickets WHERE channelId = ?")
      .get(channelId);
  },

  /**
   * Crée un ticket ouvert.
   * @param {string} channelId
   * @param {string} guildId
   * @param {string} userId
   * @param {string|null} [category]
   * @returns {object} résultat run()
   */
  createTicket: (channelId, guildId, userId, category = null) => {
    return db
      .prepare(
        "INSERT INTO tickets (channelId, guildId, userId, status, createdAt, category) VALUES (?, ?, ?,'open', ?, ?)",
      )
      .run(
        channelId,
        guildId,
        userId,
        Math.floor(Date.now() / 1000),
        category,
      );
  },

  /**
   * Marque un ticket comme pris en charge par un modérateur.
   * @param {string} channelId
   * @param {string} userId
   * @returns {object} résultat run()
   */
  claimTicket: (channelId, userId) => {
    return db
      .prepare(
        "UPDATE tickets SET claimedBy = ?, claimedAt = ? WHERE channelId = ?",
      )
      .run(userId, Math.floor(Date.now() / 1000), channelId);
  },

  /**
   * Ferme un ticket.
   * @param {string} channelId
   * @returns {object} résultat run()
   */
  closeTicket: (channelId) => {
    return db
      .prepare("UPDATE tickets SET status ='closed'WHERE channelId = ?")
      .run(channelId);
  },

  /**
   * Récupère une option de ticket par id.
   * @param {number|string} id
   * @returns {object|undefined}
   */
  getTicketOption: (id) => {
    return db.prepare("SELECT * FROM ticket_options WHERE id = ?").get(id);
  },

  // Verification
  /**
   * Récupère la config de vérification d'un serveur.
   * @param {string} guildId
   * @returns {object|undefined}
   */
  getVerifyConfig: (guildId) => {
    return db
      .prepare("SELECT * FROM verify_config WHERE guildId = ?")
      .get(guildId);
  },

  // TempVC
  /**
   * Récupère la config TempVC d'un serveur.
   * @param {string} guildId
   * @returns {object|undefined}
   */
  getTempVCConfig: (guildId) => {
    return db
      .prepare("SELECT * FROM tempvc_config WHERE guildId = ?")
      .get(guildId);
  },

  /**
   * Enregistre un salon TempVC créé.
   * @param {string} channelId
   * @param {string} guildId
   * @param {string} ownerId
   * @returns {object} résultat run()
   */
  createTempVCChannel: (channelId, guildId, ownerId) => {
    return db
      .prepare(
        "INSERT INTO tempvc_channels (channelId, guildId, ownerId) VALUES (?, ?, ?)",
      )
      .run(channelId, guildId, ownerId);
  },

  /**
   * Récupère un salon TempVC.
   * @param {string} channelId
   * @returns {object|undefined}
   */
  getTempVCChannel: (channelId) => {
    return db
      .prepare("SELECT * FROM tempvc_channels WHERE channelId = ?")
      .get(channelId);
  },

  /**
   * Supprime un salon TempVC.
   * @param {string} channelId
   * @returns {object} résultat run()
   */
  deleteTempVCChannel: (channelId) => {
    return db
      .prepare("DELETE FROM tempvc_channels WHERE channelId = ?")
      .run(channelId);
  },

  /**
   * Met à jour l'owner d'un salon TempVC.
   * @param {string} channelId
   * @param {string} newOwnerId
   * @returns {object} résultat run()
   */
  updateTempVCOwner: (channelId, newOwnerId) => {
    return db
      .prepare("UPDATE tempvc_channels SET ownerId = ? WHERE channelId = ?")
      .run(newOwnerId, channelId);
  },

  // Casino & Inventory extensions
  /**
   * Incrémente le compteur de tirages casino.
   * @param {string} userId
   * @param {string} guildId
   * @param {number} [count=1]
   * @returns {object} résultat run()
   */
  incrementDraws: (userId, guildId, count = 1) => {
    module.exports.getUser(userId, guildId);
    return db
      .prepare(
        "UPDATE users SET casinoDraws = casinoDraws + ? WHERE userId = ? AND guildId = ?",
      )
      .run(count, userId, guildId);
  },

  // --- Atomic economy/levels helpers (race-safe) ----------------------------
  // Use these in commands that perform multi-step balance changes; the legacy
  // individual addCoins/removeCoins/addBank/... helpers stay for back-compat
  // but are NOT safe under concurrency when composed into compound operations.

  /**
   * Transfère des coins entre deux utilisateurs (atomique, échoue si solde insuffisant).
   * @param {string} fromId
   * @param {string} toId
   * @param {string} guildId
   * @param {number} amount
   * @returns {{ok:boolean, reason?:string}}
   */
  transferCoins: (fromId, toId, guildId, amount) => {
    if (!Number.isFinite(amount) || amount <= 0) {
      return { ok: false, reason: "invalid" };
    }
    return txTransferCoins(fromId, toId, guildId, amount);
  },

  /**
   * Transfert forcé (sans vérification de solde) entre deux utilisateurs.
   * @param {string} fromId
   * @param {string} toId
   * @param {string} guildId
   * @param {number} amount
   * @returns {void}
   */
  forceTransferCoins: (fromId, toId, guildId, amount) => {
    if (!Number.isFinite(amount) || amount <= 0) return;
    txForceTransferCoins(fromId, toId, guildId, amount);
  },

  /**
   * Dépose des coins du cash vers la banque (atomique).
   * @param {string} userId
   * @param {string} guildId
   * @param {number} amount
   * @returns {boolean} true si succès
   */
  depositCoins: (userId, guildId, amount) => {
    if (!Number.isFinite(amount) || amount <= 0) return false;
    return txDepositCoins(userId, guildId, amount);
  },

  /**
   * Retire des coins de la banque vers le cash (atomique).
   * @param {string} userId
   * @param {string} guildId
   * @param {number} amount
   * @returns {boolean} true si succès
   */
  withdrawCoins: (userId, guildId, amount) => {
    if (!Number.isFinite(amount) || amount <= 0) return false;
    return txWithdrawCoins(userId, guildId, amount);
  },

  /**
   * Ajoute de l'XP et synchronise le niveau via `levelFn(xp)` (atomique).
   * @param {string} userId
   * @param {string} guildId
   * @param {number} amount
   * @param {(xp:number)=>number} levelFn
   * @returns {object}
   */
  addXpAndSyncLevel: (userId, guildId, amount, levelFn) => {
    return txAddXpAndSyncLevel(userId, guildId, amount, levelFn);
  },

  /**
   * Définit XP et niveau en une transaction.
   * @param {string} userId
   * @param {string} guildId
   * @param {number} xp
   * @param {number} level
   * @returns {object}
   */
  setXpAndLevel: (userId, guildId, xp, level) => {
    return txSetXpAndLevel(userId, guildId, xp, level);
  },

  /**
   * Ajoute un item et ajuste les coins en une transaction.
   * @param {string} userId
   * @param {string} guildId
   * @param {string} item
   * @param {number} itemAmount
   * @param {number} coinsDelta
   * @returns {object}
   */
  addItemAndCoins: (userId, guildId, item, itemAmount, coinsDelta) => {
    return txAddItemAndCoins(
      userId,
      guildId,
      item,
      itemAmount || 0,
      coinsDelta || 0,
    );
  },

  /**
   * Décrémente un item d'inventaire (supprime si quantité atteint 0).
   * @param {string} userId
   * @param {string} guildId
   * @param {string} item
   * @param {number} [amount=1]
   * @returns {object}
   */
  decrementItem: (userId, guildId, item, amount = 1) => {
    return txDecrementItem(userId, guildId, item, amount);
  },


  /**
   * Liste l'inventaire d'un utilisateur.
   * @param {string} userId
   * @param {string} guildId
   * @returns {Array<object>}
   */
  getInventory: (userId, guildId) => {
    return db
      .prepare("SELECT * FROM inventory WHERE userId = ? AND guildId = ?")
      .all(userId, guildId);
  },

  /**
   * Ajoute (ou incrémente) un item d'inventaire.
   * @param {string} userId
   * @param {string} guildId
   * @param {string} item
   * @param {number} [amount=1]
   * @returns {object} résultat run()
   */
  addItem: (userId, guildId, item, amount = 1) => {
    const existing = db
      .prepare(
        "SELECT * FROM inventory WHERE userId = ? AND guildId = ? AND item = ?",
      )
      .get(userId, guildId, item);
    if (existing) {
      return db
        .prepare("UPDATE inventory SET amount = amount + ? WHERE id = ?")
        .run(amount, existing.id);
    } else {
      return db
        .prepare(
          "INSERT INTO inventory (userId, guildId, item, amount) VALUES (?, ?, ?, ?)",
        )
        .run(userId, guildId, item, amount);
    }
  },

  /**
   * Retire un item d'inventaire (supprime la ligne si vidée).
   * @param {string} userId
   * @param {string} guildId
   * @param {string} item
   * @param {number} [amount=1]
   * @returns {object|null} résultat run() ou null si introuvable
   */
  removeItem: (userId, guildId, item, amount = 1) => {
    const existing = db
      .prepare(
        "SELECT * FROM inventory WHERE userId = ? AND guildId = ? AND item = ?",
      )
      .get(userId, guildId, item);
    if (!existing) return null;
    if (existing.amount <= amount) {
      return db.prepare("DELETE FROM inventory WHERE id = ?").run(existing.id);
    } else {
      return db
        .prepare("UPDATE inventory SET amount = amount - ? WHERE id = ?")
        .run(amount, existing.id);
    }
  },

  /**
   * Équipe un item (color/badge/role/success).
   * @param {string} userId
   * @param {string} guildId
   * @param {"color"|"badge"|"role"|"success"} type
   * @param {string|null} itemName
   * @returns {object|null} résultat run() ou null si type invalide
   */
  equipItem: (userId, guildId, type, itemName) => {
    const columnMap = {
      color: "equippedColor",
      badge: "equippedBadge",
      role: "equippedRole",
      success: "equippedSuccess",
    };
    const column = columnMap[type];
    if (!column) return null;
    module.exports.getUser(userId, guildId);
    const value =
      itemName === undefined || itemName === null || itemName === ""
        ? null
        : String(itemName);
    return db
      .prepare(
        `UPDATE users SET ${column} = ? WHERE userId = ? AND guildId = ?`,
      )
      .run(value, userId, guildId);
  },

  // Invites
  /**
   * Récupère les invites associés à un inviter (depuis users.inviteData).
   * @param {string} guildId
   * @param {string} inviterId
   * @returns {Array<object>}
   */
  getInvitesByInviter: (guildId, inviterId) => {
    // Basic implementation: fetch from users' inviteData if stored as JSON
    const user = module.exports.getUser(inviterId, guildId);
    if (user && user.inviteData) {
      try {
        const data = JSON.parse(user.inviteData);
        return Array.isArray(data) ? data : [];
      } catch (e) {
        return [];
      }
    }
    return [];
  },

  /**
   * Renvoie les stats d'invites de tous les membres d'un serveur.
   * @param {string} guildId
   * @returns {Array<{userId:string, regular:number, bonus:number, leaves:number, total:number, tag:string}>}
   */
  getAllInviteData: (guildId) => {
    const rows = db
      .prepare("SELECT userId, invites FROM users WHERE guildId = ?")
      .all(guildId);
    return rows.map((row) => {
      let data = { regular: 0, bonus: 0, leaves: 0, total: 0 };
      if (row.invites) {
        try {
          data = JSON.parse(row.invites);
        } catch (e) {}
      }
      return {
        userId: row.userId,
        ...data,
        tag: "User", // Fallback tag
      };
    });
  },

  // --- Reaction roles ---
  /**
   * Ajoute une reaction-role.
   * @param {string} guildId
   * @param {string} messageId
   * @param {string} channelId
   * @param {string} emoji
   * @param {string} roleId
   * @param {string} [createdBy]
   * @returns {object} résultat run()
   */
  addReactionRole: (guildId, messageId, channelId, emoji, roleId, createdBy) =>
    db
      .prepare(
        `INSERT OR IGNORE INTO reaction_roles
         (guildId, messageId, channelId, emoji, roleId, createdBy)
         VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .run(guildId, messageId, channelId, emoji, roleId, createdBy || null),

  /**
   * Supprime une reaction-role.
   * @param {string} messageId
   * @param {string} emoji
   * @returns {object} résultat run()
   */
  removeReactionRole: (messageId, emoji) =>
    db
      .prepare(`DELETE FROM reaction_roles WHERE messageId = ? AND emoji = ?`)
      .run(messageId, emoji),

  /**
   * Récupère une reaction-role par message+emoji.
   * @param {string} messageId
   * @param {string} emoji
   * @returns {object|null}
   */
  getReactionRole: (messageId, emoji) =>
    db
      .prepare(
        `SELECT * FROM reaction_roles WHERE messageId = ? AND emoji = ? LIMIT 1`,
      )
      .get(messageId, emoji) || null,

  /**
   * Liste les reaction-roles d'un serveur.
   * @param {string} guildId
   * @returns {Array<object>}
   */
  listReactionRoles: (guildId) =>
    db
      .prepare(
        `SELECT * FROM reaction_roles WHERE guildId = ? ORDER BY createdAt DESC`,
      )
      .all(guildId) || [],

  // --- Self-assignable roles ---
  /**
   * Ajoute un self-role.
   * @param {string} guildId
   * @param {string} category
   * @param {string} label
   * @param {string} roleId
   * @param {string} [emoji]
   * @param {string} [createdBy]
   * @returns {object} résultat run()
   */
  addSelfRole: (guildId, category, label, roleId, emoji, createdBy) =>
    db
      .prepare(
        `INSERT OR IGNORE INTO self_roles
         (guildId, category, label, roleId, emoji, createdBy)
         VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .run(
        guildId,
        category,
        label,
        roleId,
        emoji || null,
        createdBy || null,
      ),

  /**
   * Supprime un self-role.
   * @param {string} guildId
   * @param {string} roleId
   * @returns {object} résultat run()
   */
  removeSelfRole: (guildId, roleId) =>
    db
      .prepare(`DELETE FROM self_roles WHERE guildId = ? AND roleId = ?`)
      .run(guildId, roleId),

  /**
   * Récupère un self-role précis.
   * @param {string} guildId
   * @param {string} roleId
   * @returns {object|null}
   */
  getSelfRole: (guildId, roleId) =>
    db
      .prepare(
        `SELECT * FROM self_roles WHERE guildId = ? AND roleId = ? LIMIT 1`,
      )
      .get(guildId, roleId) || null,

  /**
   * Liste les self-roles d'un serveur.
   * @param {string} guildId
   * @returns {Array<object>}
   */
  listSelfRoles: (guildId) =>
    db
      .prepare(
        `SELECT * FROM self_roles WHERE guildId = ? ORDER BY category ASC, label ASC`,
      )
      .all(guildId) || [],

  /**
   * Liste les self-roles d'une catégorie.
   * @param {string} guildId
   * @param {string} category
   * @returns {Array<object>}
   */
  listSelfRolesByCategory: (guildId, category) =>
    db
      .prepare(
        `SELECT * FROM self_roles WHERE guildId = ? AND category = ? ORDER BY label ASC`,
      )
      .all(guildId, category) || [],

  // --- Button roles ---
  /**
   * Ajoute un button-role.
   * @param {string} guildId
   * @param {string} messageId
   * @param {string} channelId
   * @param {string} customId
   * @param {string} label
   * @param {string} [style]
   * @param {string} roleId
   * @param {string} [createdBy]
   * @returns {object} résultat run()
   */
  addButtonRole: (
    guildId,
    messageId,
    channelId,
    customId,
    label,
    style,
    roleId,
    createdBy,
  ) =>
    db
      .prepare(
        `INSERT OR IGNORE INTO button_roles
         (guildId, messageId, channelId, customId, label, style, roleId, createdBy)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        guildId,
        messageId,
        channelId,
        customId,
        label,
        style || "Secondary",
        roleId,
        createdBy || null,
      ),

  /**
   * Supprime un button-role.
   * @param {string} messageId
   * @param {string} customId
   * @returns {object} résultat run()
   */
  removeButtonRole: (messageId, customId) =>
    db
      .prepare(
        `DELETE FROM button_roles WHERE messageId = ? AND customId = ?`,
      )
      .run(messageId, customId),

  /**
   * Récupère un button-role par customId.
   * @param {string} customId
   * @returns {object|null}
   */
  getButtonRoleByCustomId: (customId) =>
    db
      .prepare(`SELECT * FROM button_roles WHERE customId = ? LIMIT 1`)
      .get(customId) || null,

  /**
   * Liste les button-roles d'un serveur.
   * @param {string} guildId
   * @returns {Array<object>}
   */
  listButtonRoles: (guildId) =>
    db
      .prepare(
        `SELECT * FROM button_roles WHERE guildId = ? ORDER BY messageId, id`,
      )
      .all(guildId) || [],

  /**
   * Liste les button-roles attachés à un message.
   * @param {string} messageId
   * @returns {Array<object>}
   */
  getButtonRolesForMessage: (messageId) =>
    db
      .prepare(`SELECT * FROM button_roles WHERE messageId = ? ORDER BY id`)
      .all(messageId) || [],

  // --- log_settings (per-type log config) -------------------------------------
  // Schema: log_settings(guildId, type, enabled, channelId, events)
  // `events` is stored as a comma-separated list (e.g. "ban,kick"); `null` means "all".
  /**
   * Récupère la config log d'un type (events parsé en tableau, null = tous).
   * @param {string} guildId
   * @param {string} type
   * @returns {{guildId:string,type:string,enabled:number,channelId:string|null,events:string[]|null}|null}
   */
  getLogSetting: (guildId, type) => {
    const row = db
      .prepare(
        "SELECT guildId, type, enabled, channelId, events FROM log_settings WHERE guildId = ? AND type = ?",
      )
      .get(guildId, type);
    if (!row) return null;
    return {
      guildId: row.guildId,
      type: row.type,
      enabled: row.enabled ? 1 : 0,
      channelId: row.channelId || null,
      events: row.events
        ? row.events
            .split(",")
            .map((e) => e.trim())
            .filter(Boolean)
        : null,
    };
  },

  /**
   * Upsert la config log d'un type et renvoie la valeur normalisée.
   * @param {string} guildId
   * @param {string} type
   * @param {{enabled?:boolean|number,channelId?:string|null,events?:string|string[]|null}} [updates]
   * @returns {object|null}
   */
  setLogSetting: (guildId, type, updates = {}) => {
    const current = module.exports.getLogSetting(guildId, type) || {
      enabled: 0,
      channelId: null,
      events: null,
    };

    let enabled = current.enabled ? 1 : 0;
    let channelId = current.channelId || null;
    let events = Array.isArray(current.events)
      ? current.events.join(",")
      : current.events || null;

    if (Object.prototype.hasOwnProperty.call(updates, "enabled")) {
      enabled = updates.enabled ? 1 : 0;
    }
    if (Object.prototype.hasOwnProperty.call(updates, "channelId")) {
      channelId = updates.channelId || null;
      // Auto-activer si on définit un salon, auto-désactiver si on retire.
      if (!Object.prototype.hasOwnProperty.call(updates, "enabled")) {
        enabled = channelId ? 1 : 0;
      }
    }
    if (Object.prototype.hasOwnProperty.call(updates, "events")) {
      if (updates.events === null || updates.events === undefined) {
        events = null;
      } else if (Array.isArray(updates.events)) {
        events = updates.events
          .map((e) => String(e).trim())
          .filter(Boolean)
          .join(",") || null;
      } else {
        events = String(updates.events)
          .split(",")
          .map((e) => e.trim())
          .filter(Boolean)
          .join(",") || null;
      }
    }

    db.prepare(
      `INSERT INTO log_settings (guildId, type, enabled, channelId, events)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(guildId, type) DO UPDATE SET
         enabled = excluded.enabled,
         channelId = excluded.channelId,
         events = excluded.events`,
    ).run(guildId, type, enabled, channelId, events);

    return module.exports.getLogSetting(guildId, type);
  },

  /**
   * Liste toutes les configs log d'un serveur (events parsés).
   * @param {string} guildId
   * @returns {Array<object>}
   */
  listLogSettings: (guildId) => {
    const rows = db
      .prepare(
        "SELECT guildId, type, enabled, channelId, events FROM log_settings WHERE guildId = ? ORDER BY type ASC",
      )
      .all(guildId);
    return rows.map((row) => ({
      guildId: row.guildId,
      type: row.type,
      enabled: row.enabled ? 1 : 0,
      channelId: row.channelId || null,
      events: row.events
        ? row.events
            .split(",")
            .map((e) => e.trim())
            .filter(Boolean)
        : null,
    }));
  },

  // Helper utilisé par les events : retourne le channelId effectif pour un type
  // de log donné, en respectant `enabled` et le filtre `events`. Fallback sur la
  // colonne legacy `guilds.*LogsChannel` si aucun enregistrement n'existe.
  /**
   * Résout le channelId effectif pour un type de log et un évènement.
   * @param {string} guildId
   * @param {string} type
   * @param {string|null} [eventName]
   * @returns {string|null}
   */
  resolveLogChannel: (guildId, type, eventName = null) => {
    const legacyMap = {
      modlog: "modLogsChannel",
      msglog: "msgLogsChannel",
      voicelog: "voiceLogsChannel",
      raidlog: "raidLogsChannel",
    };
    const setting = module.exports.getLogSetting(guildId, type);
    if (setting) {
      if (!setting.enabled) return null;
      if (
        eventName &&
        Array.isArray(setting.events) &&
        setting.events.length > 0 &&
        !setting.events.includes(eventName)
      ) {
        return null;
      }
      if (setting.channelId) return setting.channelId;
    }
    // Fallback legacy
    const legacyCol = legacyMap[type];
    if (legacyCol) {
      const guild = module.exports.getGuild(guildId);
      return (guild && guild[legacyCol]) || null;
    }
    return null;
  },

  getVanitySniper: (guildId) => {
    try {
      return (
        db.prepare("SELECT * FROM vanity_snipers WHERE guildId = ?").get(guildId) || null
      );
    } catch (e) {
      Logger.error("[DB] Error getVanitySniper:", e);
      return null;
    }
  },

  getAllActiveVanitySnipers: () => {
    try {
      return (
        db
          .prepare("SELECT * FROM vanity_snipers WHERE status = 'active'")
          .all() || []
      );
    } catch (e) {
      Logger.error("[DB] Error getAllActiveVanitySnipers:", e);
      return [];
    }
  },

  setVanitySniper: (guildId, data) => {
    try {
      const now = Date.now();
      return db
        .prepare(
          `
        INSERT INTO vanity_snipers (guildId, vanityCode, channelId, userId, status, checksCount, createdAt, lastCheck, lastError)
        VALUES (?, ?, ?, ?, 'active', 0, ?, ?, NULL)
        ON CONFLICT(guildId) DO UPDATE SET
          vanityCode = excluded.vanityCode,
          channelId = excluded.channelId,
          userId = excluded.userId,
          status = 'active',
          checksCount = 0,
          createdAt = excluded.createdAt,
          lastCheck = excluded.lastCheck,
          lastError = NULL
      `,
        )
        .run(
          guildId,
          data.vanityCode,
          data.channelId || null,
          data.userId || null,
          now,
          now,
        );
    } catch (e) {
      Logger.error("[DB] Error setVanitySniper:", e);
      return null;
    }
  },

  updateVanitySniper: (guildId, updates = {}) => {
    try {
      const fields = [];
      const values = [];
      for (const [key, val] of Object.entries(updates)) {
        fields.push(`${key} = ?`);
        values.push(val);
      }
      if (fields.length === 0) return null;
      values.push(guildId);
      return db
        .prepare(`UPDATE vanity_snipers SET ${fields.join(", ")} WHERE guildId = ?`)
        .run(...values);
    } catch (e) {
      Logger.error("[DB] Error updateVanitySniper:", e);
      return null;
    }
  },

  deleteVanitySniper: (guildId) => {
    try {
      return db
        .prepare("DELETE FROM vanity_snipers WHERE guildId = ?")
        .run(guildId);
    } catch (e) {
      Logger.error("[DB] Error deleteVanitySniper:", e);
      return null;
    }
  },
};
