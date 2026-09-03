const axios = require("axios");
const { Routes, PermissionFlagsBits, EmbedBuilder } = require("discord.js");
const Logger = require("./logger");

// Map en mémoire des snipers actifs : guildId -> { interval, data }
const activeSnipers = new Map();

/**
 * Nettoie une chaîne pour en extraire le code vanity pur
 * @param {string} input
 * @returns {string}
 */
function cleanCode(input) {
  if (!input || typeof input !== "string") return "";
  let clean = input.trim();
  clean = clean.replace(/^(https?:\/\/)?(www\.)?/i, "");
  clean = clean.replace(/^(discord\.gg\/|discord\.com\/invite\/|discordapp\.com\/invite\/)/i, "");
  clean = clean.split(/[?#]/)[0].replace(/\/+$/, "");
  return clean.toLowerCase();
}

/**
 * Valide le format d'un code vanity Discord
 * @param {string} code
 * @returns {boolean}
 */
function isValidCode(code) {
  if (!code || typeof code !== "string") return false;
  return /^[a-zA-Z0-9-_]{2,32}$/.test(code);
}

/**
 * Vérifie la disponibilité d'une invite / vanity URL auprès de l'API Discord
 * @param {string} code
 * @returns {Promise<{ available: boolean, guild?: object, error?: string, status?: number }>}
 */
async function checkAvailability(code) {
  try {
    const res = await axios.get(`https://discord.com/api/v10/invites/${encodeURIComponent(code)}`, {
      timeout: 3500,
      headers: { "User-Agent": "VoltBot-VanitySniper/1.0" },
    });
    return { available: false, guild: res.data?.guild };
  } catch (err) {
    if (err.response?.status === 404) {
      return { available: true };
    }
    return {
      available: false,
      error: err.message,
      status: err.response?.status,
    };
  }
}

/**
 * Tente de revendiquer le code vanity pour la guilde via l'API Discord
 * @param {import("discord.js").Client} client
 * @param {string} guildId
 * @param {string} code
 * @returns {Promise<{ success: boolean, error?: string, raw?: any }>}
 */
async function claimVanity(client, guildId, code) {
  try {
    const res = await client.rest.patch(Routes.guildVanityUrl(guildId), {
      body: { code },
    });
    return { success: true, raw: res };
  } catch (err) {
    return {
      success: false,
      error: err.message,
      code: err.code,
      status: err.status,
    };
  }
}

/**
 * Démarre ou reprogramme la boucle de vérification pour une guilde
 * @param {import("discord.js").Client} client
 * @param {string} guildId
 * @param {{ vanityCode: string, channelId?: string, userId?: string }} options
 */
function startSniper(client, guildId, options) {
  stopSniper(client, guildId, false);

  const vanityCode = cleanCode(options.vanityCode);
  if (!isValidCode(vanityCode)) {
    throw new Error("Invalid vanity code format");
  }

  client.db.setVanitySniper(guildId, {
    vanityCode,
    channelId: options.channelId,
    userId: options.userId,
  });

  let checkCount = 0;
  let isChecking = false;

  const performCheck = async () => {
    if (isChecking) return;
    isChecking = true;

    try {
      const guild = client.guilds.cache.get(guildId);
      if (!guild) {
        Logger.warn(`[SNIPER_URL] Guild ${guildId} non trouvée dans le cache, arrêt.`);
        stopSniper(client, guildId);
        return;
      }

      // Si le serveur a déjà ce code vanity
      if (guild.vanityURLCode && guild.vanityURLCode.toLowerCase() === vanityCode) {
        Logger.info(`[SNIPER_URL] Guilde ${guildId} possède déjà le vanity ${vanityCode}.`);
        client.db.updateVanitySniper(guildId, { status: "claimed", lastCheck: Date.now() });
        stopSniper(client, guildId, false);
        notifySuccess(client, guild, vanityCode, options.channelId, options.userId, true);
        return;
      }

      checkCount++;
      const result = await checkAvailability(vanityCode);

      if (result.available) {
        Logger.info(`[SNIPER_URL] Vanity ${vanityCode} détectée libre ! Tentative de claim pour ${guild.name} (${guildId})...`);
        const claimRes = await claimVanity(client, guildId, vanityCode);

        if (claimRes.success) {
          Logger.info(`[SNIPER_URL] 🎯 SUCCÈS : Vanity ${vanityCode} attribuée à ${guild.name} !`);
          client.db.updateVanitySniper(guildId, {
            status: "claimed",
            lastCheck: Date.now(),
            checksCount: checkCount,
          });
          stopSniper(client, guildId, false);
          notifySuccess(client, guild, vanityCode, options.channelId, options.userId, false);
          return;
        } else {
          Logger.error(`[SNIPER_URL] Échec lors du claim de ${vanityCode} : ${claimRes.error}`);
          client.db.updateVanitySniper(guildId, {
            lastError: claimRes.error,
            lastCheck: Date.now(),
            checksCount: checkCount,
          });
        }
      } else {
        // Sauvegarde périodique du compteur toutes les 10 vérifications
        if (checkCount % 10 === 0) {
          client.db.updateVanitySniper(guildId, {
            checksCount: checkCount,
            lastCheck: Date.now(),
          });
        }
      }
    } catch (err) {
      Logger.error(`[SNIPER_URL] Erreur dans la boucle de vérification :`, err);
    } finally {
      isChecking = false;
    }
  };

  // Exécution immédiate puis intervalle régulier de 5 secondes
  performCheck();
  const interval = setInterval(performCheck, 5000);

  activeSnipers.set(guildId, {
    interval,
    vanityCode,
    channelId: options.channelId,
    userId: options.userId,
    startedAt: Date.now(),
    getChecks: () => checkCount,
  });

  Logger.info(`[SNIPER_URL] Surveillance démarrée pour ${guildId} sur discord.gg/${vanityCode}`);
}

/**
 * Notifie le salon du succès du snipe
 */
function notifySuccess(client, guild, code, channelId, userId, alreadyOwned = false) {
  if (!channelId) return;
  const channel = guild.channels.cache.get(channelId);
  if (!channel) return;

  const embed = client.embedBuilder
    .success(
      client,
      alreadyOwned
        ? `L'URL personnalisée **discord.gg/${code}** est déjà attribuée à ce serveur !`
        : `🎯 **SNIPE RÉUSSI !**\nL'URL personnalisée **discord.gg/${code}** a été snipée et attribuée avec succès à ce serveur !`,
    )
    .setTitle("🎯 Sniper d'URL — Succès !")
    .setTimestamp();

  const content = userId ? `<@${userId}>` : undefined;
  channel.send({ content, embeds: [embed] }).catch(() => {});
}

/**
 * Arrête le sniper pour une guilde donnée
 * @param {import("discord.js").Client} client
 * @param {string} guildId
 * @param {boolean} [updateDb=true]
 */
function stopSniper(client, guildId, updateDb = true) {
  const current = activeSnipers.get(guildId);
  if (current) {
    clearInterval(current.interval);
    activeSnipers.delete(guildId);
  }
  if (updateDb && client?.db?.updateVanitySniper) {
    client.db.updateVanitySniper(guildId, { status: "stopped", lastCheck: Date.now() });
  }
}

/**
 * Initialise les snipers actifs stockés en base de données au démarrage du bot
 * @param {import("discord.js").Client} client
 */
function init(client) {
  try {
    if (!client?.db?.getAllActiveVanitySnipers) return;
    const records = client.db.getAllActiveVanitySnipers();
    let resumed = 0;
    for (const record of records) {
      try {
        startSniper(client, record.guildId, {
          vanityCode: record.vanityCode,
          channelId: record.channelId,
          userId: record.userId,
        });
        resumed++;
      } catch (e) {
        Logger.error(`[SNIPER_URL] Impossible de reprendre le sniper pour ${record.guildId}:`, e);
      }
    }
    if (resumed > 0) {
      Logger.info(`[SNIPER_URL] ${resumed} sniper(s) d'URL repris depuis la base de données.`);
    }
  } catch (err) {
    Logger.error("[SNIPER_URL] Erreur lors de l'initialisation :", err);
  }
}

module.exports = {
  cleanCode,
  isValidCode,
  checkAvailability,
  claimVanity,
  startSniper,
  stopSniper,
  init,
  activeSnipers,
};
