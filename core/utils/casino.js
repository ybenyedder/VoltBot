/**
 * Vérifie si l'utilisateur a le niveau requis pour jouer au casino
 * @param {import('discord.js').Client} client
 * @param {import('discord.js').Message} message
 * @returns {Promise<boolean>} - True si l'utilisateur peut jouer, false sinon
 */
async function checkCasinoLevel(client, message) {
  const guildId = message.guild.id;
  const userId = message.author.id;

  // Récupérer la config du casino
  const config = client.db.getGuild(guildId);
  let casinoConfig = { settings: {} };
  try {
    casinoConfig = JSON.parse(
      config.casinoConfig || '{"rewards":[],"settings":{}}',
    );
    if (Array.isArray(casinoConfig)) {
      casinoConfig = { rewards: casinoConfig, settings: {} };
    }
  } catch (e) {
    client.logger.error(
      `[CASINO] Error parsing casinoConfig for guild ${guildId}: ${e.message}`,
    );
  }

  const minLevel = parseInt(casinoConfig.settings?.minLevel) || 0;
  if (minLevel <= 0) return true;

  // Récupérer le niveau de l'utilisateur
  const userStats = client.db.getUser(userId, guildId);
  if (userStats.level < minLevel) {
    const embed = client.embedBuilder.error(
      client,
      message.t("utils.casino.access_denied", {
        minLevel,
        level: userStats.level,
      }),
    );
    message.reply({ embeds: [embed] }).catch(() => {});
    return false;
  }

  return true;
}

module.exports = { checkCasinoLevel };
