const path = require("path");
const fs = require("fs");
const instanceDir = process.env.BOT_INSTANCE_CWD || process.cwd();
require("dotenv").config({
  path: path.join(instanceDir, ".env"),
  override: true,
});

// --- FAIL-FAST ENV VALIDATION ---
// Required at startup. Missing any of these => exit immediately with a
// clear error so misconfigured bots never reach login/handler registration.
(() => {
  const instanceLabel =
    process.env.BOT_INSTANCE_NAME || path.basename(instanceDir);
  const required = [
    "DISCORD_TOKEN",
    "OWNER_ID",
    "BOT_ACCESS_ID",
    "DISCORD_CLIENT_ID",
    "DISCORD_CLIENT_SECRET",
    "JWT_SECRET",
  ];
  const missing = required.filter(
    (k) => !process.env[k] || String(process.env[k]).trim() === "",
  );
  if (missing.length) {
    console.error(
      `[FATAL] [${instanceLabel}] Missing required env vars: ${missing.join(", ")}. ` +
        `Check ${path.join(instanceDir, ".env")} (see .env.example at repo root).`,
    );
    process.exit(1);
  }
  const recommended = ["DISCORD_REDIRECT_URI", "DASHBOARD_URL", "PORT"];
  const missingRecommended = recommended.filter((k) => !process.env[k]);
  if (missingRecommended.length) {
    console.warn(
      `[WARN] [${instanceLabel}] Missing recommended env vars (using defaults): ${missingRecommended.join(", ")}`,
    );
  }
})();

const {
  Client,
  GatewayIntentBits,
  Partials,
  Collection,
} = require("discord.js");
const config = require("./config/config.js");
const Logger = require("./utils/logger.js");

// Activer le garbage collection manuel pour les tests
if (process.env.NODE_ENV === "development") {
  try {
    global.gc = require("vm").runInNewContext("gc");
  } catch (e) {
    // gc not exposed
  }
}

// --- SINGLE INSTANCE LOCK ---
const lockFile = path.join(instanceDir, ".bot.lock");
Logger.info(`[DEBUG] Instance Dir: ${instanceDir}, Lock file: ${lockFile}`);
if (fs.existsSync(lockFile)) {
  try {
    const pid = parseInt(fs.readFileSync(lockFile, "utf8"));
    if (!isNaN(pid) && pid !== process.pid) {
      process.kill(pid, 0); // Check if process is alive (throws if not)
      Logger.error(
        `Le bot tourne déjà (PID ${pid}). Si vous êtes sûr qu'il ne tourne pas, supprimez le fichier : ${lockFile}`,
      );
      process.exit(1);
    }
  } catch (e) {
    // Process is dead, stale lockfile — continue
    try {
      fs.unlinkSync(lockFile);
    } catch (err) {}
  }
}

try {
  fs.writeFileSync(lockFile, process.pid.toString());
} catch (e) {
  Logger.error(`Impossible d'écrire le fichier lock: ${e.message}`);
}

const cleanLock = () => {
  try {
    if (fs.existsSync(lockFile)) {
      const pid = parseInt(fs.readFileSync(lockFile, "utf8"));
      if (pid === process.pid) {
        try {
          fs.unlinkSync(lockFile);
        } catch (err) {}
      }
    }
  } catch (e) {
    // Ignore error on cleanup
  }
};

process.on("exit", cleanLock);

// --- GRACEFUL SHUTDOWN ---
// Tracks intervals registered in this file so they can be cleared on shutdown.
const shutdownIntervals = [];
let shuttingDown = false;
const gracefulShutdown = (signal) => {
  if (shuttingDown) return;
  shuttingDown = true;
  Logger.info(`[SHUTDOWN] Signal ${signal} reçu, arrêt en cours...`);
  // 1. Stop all intervals registered in this file
  for (const id of shutdownIntervals) {
    try {
      clearInterval(id);
    } catch (e) {}
  }
  // 2. Stop intervals registered elsewhere via the client
  try {
    if (client && client.statsIntervals) {
      client.statsIntervals.forEach((id) => clearInterval(id));
      client.statsIntervals.clear();
    }
    if (client && Array.isArray(client._readyIntervals)) {
      client._readyIntervals.forEach((id) => clearInterval(id));
      client._readyIntervals.length = 0;
    }
  } catch (e) {}
  // 3. Stop the database cleanup interval (if exposed)
  try {
    if (
      client &&
      client.db &&
      typeof client.db.stopCleanupInterval === "function"
    ) {
      client.db.stopCleanupInterval();
    }
    if (
      client &&
      client.db &&
      typeof client.db.stopVacuumInterval === "function"
    ) {
      client.db.stopVacuumInterval();
    }
  } catch (e) {}
  // 4. Stop the automod cache refresher
  try {
    const automod = require("./events/handlers/automodHandler");
    if (typeof automod.stopCacheRefresh === "function")
      automod.stopCacheRefresh();
  } catch (e) {}
  // 5. Destroy Discord gateway connection
  try {
    if (client && typeof client.destroy === "function") client.destroy();
  } catch (e) {}
  // 6. Close SQLite (better-sqlite3 flushes WAL on close)
  try {
    if (client && client.db && client.db.db && client.db.db.open) {
      client.db.db.close();
    }
  } catch (e) {}
  cleanLock();
  // Give discord.js / DB a brief moment to finish flush, then exit
  setTimeout(() => process.exit(0), 500).unref();
};

process.on("SIGINT", () => gracefulShutdown("SIGINT"));
process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
// Initialisation du client avec tous les intents nécessaires
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMessageReactions,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildPresences,
    GatewayIntentBits.GuildWebhooks,
    // Required for guildBanAdd/guildBanRemove events (events/guildBanAdd.js, events/guildBanRemove.js).
    // In discord.js v14 this is GuildModeration (was GuildBans in v13). Without it, ban events
    // silently never fire and the moderation log/handlers won't trigger.
    GatewayIntentBits.GuildModeration,
  ],
  partials: [
    Partials.Message,
    Partials.Channel,
    Partials.Reaction,
    Partials.User,
    Partials.GuildMember,
  ],
});

// Collections pour stocker diverses données du bot
client.commands = new Collection();
client.aliases = new Collection();
client.cooldowns = new Collection();
client.logger = Logger;
client.config = config;
client.guildModulesCache = new Map();
client.guildSettingsCache = new Map();

// Initialisation de la base de données des salons privés et chargement dans client.pvMap
client.pvMap = new Map();

// Initialisation de la base de données principale
client.db = require("./utils/database.js");

const { invalidateGuildCache } = require("./events/handlers/automodHandler");
const invalidateRuntimeGuildConfig = (guildId) => {
  if (!guildId) return;
  client.guildSettingsCache.delete(guildId);
  client.guildModulesCache.delete(guildId);
  invalidateGuildCache(guildId);
};

const rawUpdateGuild = client.db.updateGuild;
client.db.updateGuild = (...args) => {
  const result = rawUpdateGuild(...args);
  invalidateRuntimeGuildConfig(args[0]);
  return result;
};

const rawUpdateAntiraidConfig = client.db.updateAntiraidConfig;
client.db.updateAntiraidConfig = (...args) => {
  const result = rawUpdateAntiraidConfig(...args);
  invalidateRuntimeGuildConfig(args[0]);
  return result;
};

client.invalidateGuildConfig = invalidateRuntimeGuildConfig;

// Charger les salons vocaux privés depuis la base de données dans client.pvMap
client.db.getAllPrivateVoices().forEach((pvChannel) => {
  client.pvMap.set(pvChannel.channelId, pvChannel.data);
});
Logger.info(
  `Loaded ${client.pvMap.size} private voice channels from database.`,
);

// Initialisation de client.dogMap et chargement depuis la base de données
client.dogMap = new Map();
client.db.getAllDogStates().forEach((state) => {
  client.dogMap.set(state.userId, {
    masterId: state.masterId,
    guildId: state.guildId,
  });
});
Logger.info(`Loaded ${client.dogMap.size} dog states from database.`);

// Démarrer le nettoyage automatique des données expirées
client.db.startCleanupInterval();
// Démarrer le VACUUM hebdomadaire (compaction SQLite, libère l'espace).
if (typeof client.db.startVacuumInterval === "function") {
  client.db.startVacuumInterval();
}

// Garbage Collection pour les Maps mémoire (toutes les 5 minutes)
shutdownIntervals.push(setInterval(() => {
  const now = Date.now();

  // 1. Nettoyer spamMap
  if (client.spamMap) {
    for (const [key, value] of client.spamMap.entries()) {
      if (now - value.lastMessage > 600000) client.spamMap.delete(key);
    }
  }

  // 2. Nettoyer lettresState (lazy stamp pour entrées historiques)
  if (client.lettresState) {
    for (const [key, value] of client.lettresState.entries()) {
      if (!value._createdAt) value._createdAt = now;
      // Inactif depuis 15min => purge
      if (now - value._createdAt > 900000) client.lettresState.delete(key);
    }
  }

  // 2b. Nettoyer ticketOptionState (inactif > 15min, ne pas casser une édition active)
  if (client.ticketOptionState) {
    for (const [key, value] of client.ticketOptionState.entries()) {
      if (!value._createdAt) value._createdAt = now;
      if (now - value._createdAt > 900000) client.ticketOptionState.delete(key);
    }
  }

  // 2c. Nettoyer nukeCounters (entrées > 2 min, déjà fait dans clientReady mais
  // redondant pour garantir l'éviction si clientReady n'a pas tourné)
  if (client.nukeCounters) {
    for (const [key, value] of client.nukeCounters.entries()) {
      if (now - (value.firstAction || 0) > 120000)
        client.nukeCounters.delete(key);
    }
  }

  // 2d. Nettoyer snipes / editSnipes (entrées > 1h)
  if (client.snipes) {
    for (const [key, value] of client.snipes.entries()) {
      if (now - (value.timestamp || 0) > 3600000) client.snipes.delete(key);
    }
  }
  if (client.editSnipes) {
    for (const [key, value] of client.editSnipes.entries()) {
      if (now - (value.timestamp || 0) > 3600000) client.editSnipes.delete(key);
    }
  }

  // 3. Nettoyer dropCooldowns
  if (client.dropCooldowns) {
    for (const [key, value] of client.dropCooldowns.entries()) {
      if (now - value > 3600000) client.dropCooldowns.delete(key);
    }
  }

  // 4. Nettoyer dogMap & pvMap (si nécessaire, inactivité > 1h)
  if (client.dogMap) {
    for (const [key, value] of client.dogMap.entries()) {
      if (!client.users.cache.has(key)) client.dogMap.delete(key);
    }
  }

  if (client.pvMap) {
    for (const [key, value] of client.pvMap.entries()) {
      if (!client.channels.cache.has(key)) {
        client.pvMap.delete(key);
        continue;
      }
      // Prune idle PV attempts entries (> 5 min) to bound memory.
      if (value && value.attempts && typeof value.attempts === "object") {
        for (const uid of Object.keys(value.attempts)) {
          const rec = value.attempts[uid];
          if (!rec || typeof rec !== "object" || !rec.lastAttempt ||
              now - rec.lastAttempt > 300000) {
            delete value.attempts[uid];
          }
        }
      }
    }
  }

  // 5. Vider le cache des settings serveur (forcer relecture DB toutes les 5 min)
  if (client.guildSettingsCache) client.guildSettingsCache.clear();
  if (client.guildModulesCache) client.guildModulesCache.clear();
}, 300000));

Logger.info(
  "Garbage collection des Maps mémoire initialisé (toutes les 5 min).",
);

// Aide à la création d'embeds
client.embedBuilder = require("./utils/embedBuilder.js");
client.messageUtils = require("./utils/messageUtils.js");

// Canvas pour les cartes de niveau
client.canvas = require("./utils/canvas.js");

// Utilitaires
client.utils = {
  antiraid: require("./utils/antiraid.js"),
};

// Initialisation du Dashboard
const { initDashboard } = require("./dashboard/manager.js");
initDashboard(client);

// Chargement des événements
const eventsPath = path.join(__dirname, "events");
if (fs.existsSync(eventsPath)) {
  const eventFiles = fs
    .readdirSync(eventsPath)
    .filter((file) => file.endsWith(".js"));
  let loadedEvents = 0;
  for (const file of eventFiles) {
    const filePath = path.join(eventsPath, file);
    const event = require(filePath);
    if (event.once) {
      client.once(event.name, (...args) => event.execute(...args, client));
    } else {
      client.on(event.name, (...args) => event.execute(...args, client));
    }
    loadedEvents++;
  }
  Logger.info(`${loadedEvents} events loaded.`);
} else {
  fs.mkdirSync(eventsPath, { recursive: true });
}

// Chargement des commandes
const commandsPath = path.join(__dirname, "commands");
if (!fs.existsSync(commandsPath)) {
  fs.mkdirSync(commandsPath, { recursive: true });
}

// Fonction récursive pour lire les dossiers de commandes
let loadedCommands = 0;
const loadCommands = (dir) => {
  if (!fs.existsSync(dir)) return;
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat.isDirectory()) {
      loadCommands(filePath);
    } else if (file.endsWith(".js")) {
      const command = require(filePath);
      if ("name" in command && "execute" in command) {
        client.commands.set(command.name, command);
        if (command.aliases && Array.isArray(command.aliases)) {
          command.aliases.forEach((alias) =>
            client.aliases.set(alias, command.name),
          );
        }
        loadedCommands++;
      } else {
        Logger.warn(
          `Command at ${filePath} is missing "name" or "execute" property.`,
        );
      }
    }
  }
};

loadCommands(commandsPath);
Logger.info(`${loadedCommands} legacy prefix commands loaded.`);

let errorCount = 0;
let lastErrorReset = Date.now();

const handleError = (type, error) => {
  // Reset le compteur toutes les 5 minutes
  if (Date.now() - lastErrorReset > 300000) {
    errorCount = 0;
    lastErrorReset = Date.now();
  }

  errorCount++;

  // Log l'erreur avec contexte
  Logger.error(
    `[ANTI-CRASH] ${type}:`,
    error?.stack || error?.message || error,
  );

  // Si trop d'erreurs en peu de temps, alerter
  if (errorCount > 10) {
    Logger.error(
      `[ANTI-CRASH] ALERTE: ${errorCount} erreurs detectees en 5 minutes!`,
    );
  }
};

// Promesses rejetees non gerees
process.on("unhandledRejection", (reason, promise) => {
  handleError("Unhandled Promise Rejection", reason);
});

// Exceptions non capturees (erreurs synchrones)
process.on("uncaughtException", (error, origin) => {
  cleanLock();
  handleError(`Uncaught Exception (${origin})`, error);
  if (error?.code === "ECONNRESET" || error?.code === "ETIMEDOUT") {
    Logger.warn("[ANTI-CRASH] Erreur reseau ignoree, le bot continue...");
  } else {
    process.exit(1);
  }
});

// Avertissements (deprecation, etc.)
process.on("warning", (warning) => {
  Logger.warn(`[WARNING] ${warning.name}: ${warning.message}`);
});

// Discord.js errors specifiques
client.on("error", (error) => {
  handleError("Discord Client Error", error);
});

client.on("shardError", (error) => {
  handleError("Discord Shard Error", error);
});

// Reconnexion automatique
client.on("shardDisconnect", (event, shardId) => {
  Logger.warn(
    `[SHARD] Deconnexion du shard ${shardId}. Tentative de reconnexion...`,
  );
});

client.on("shardReconnecting", (shardId) => {
  Logger.info(`[SHARD] Reconnexion du shard ${shardId} en cours...`);
});

client.on("shardResume", (shardId, replayedEvents) => {
  Logger.info(
    `[SHARD] Shard ${shardId} reconnecte. ${replayedEvents} evenements rejoues.`,
  );
});

// Connexion du bot (DISCORD_TOKEN already validated at startup)
Logger.info("Logging into Discord...");
client.login(process.env.DISCORD_TOKEN);
