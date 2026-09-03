const axios = require("axios");
const Logger = require("./logger");

const FALLBACK_GIFS = {
  kiss: [
    "https://cdn.nekos.life/kiss/kiss_001.gif",
    "https://cdn.nekos.life/kiss/kiss_002.gif",
    "https://cdn.nekos.life/kiss/kiss_003.gif",
    "https://cdn.nekos.life/kiss/kiss_004.gif",
    "https://cdn.nekos.life/kiss/kiss_005.gif",
  ],
  hug: [
    "https://cdn.nekos.life/hug/hug_001.gif",
    "https://cdn.nekos.life/hug/hug_002.gif",
    "https://cdn.nekos.life/hug/hug_003.gif",
    "https://cdn.nekos.life/hug/hug_004.gif",
    "https://cdn.nekos.life/hug/hug_005.gif",
  ],
  pat: [
    "https://cdn.nekos.life/pat/pat_001.gif",
    "https://cdn.nekos.life/pat/pat_002.gif",
    "https://cdn.nekos.life/pat/pat_003.gif",
    "https://cdn.nekos.life/pat/pat_004.gif",
    "https://cdn.nekos.life/pat/pat_005.gif",
  ],
  slap: [
    "https://cdn.nekos.life/slap/slap_001.gif",
    "https://cdn.nekos.life/slap/slap_002.gif",
    "https://cdn.nekos.life/slap/slap_003.gif",
    "https://cdn.nekos.life/slap/slap_004.gif",
    "https://cdn.nekos.life/slap/slap_005.gif",
  ],
};

/**
 * Fetches an anime action GIF from multiple providers with automatic fallbacks.
 * @param {string} action - 'kiss', 'hug', 'pat', 'slap'
 * @returns {Promise<string>} URL of the GIF
 */
async function getAnimeGif(action) {
  // Provider 1: nekos.life
  try {
    const res = await axios.get(`https://nekos.life/api/v2/img/${action}`, {
      timeout: 4000,
    });
    if (res.data?.url) return res.data.url;
  } catch (err) {
    Logger.warn(`[ANIME_GIF] nekos.life failed for ${action}: ${err.message}`);
  }

  // Provider 2: purrbot.site
  try {
    const res = await axios.get(
      `https://api.purrbot.site/v2/img/sfw/${action}/gif`,
      { timeout: 4000 },
    );
    if (res.data?.link) return res.data.link;
  } catch (err) {
    Logger.warn(`[ANIME_GIF] purrbot.site failed for ${action}: ${err.message}`);
  }

  // Provider 3: otakugifs.xyz
  try {
    const res = await axios.get(
      `https://api.otakugifs.xyz/gif?reaction=${action}`,
      { timeout: 4000 },
    );
    if (res.data?.url) return res.data.url;
  } catch (err) {
    Logger.warn(`[ANIME_GIF] otakugifs.xyz failed for ${action}: ${err.message}`);
  }

  // Provider 4: static curated fallback URLs
  const list = FALLBACK_GIFS[action];
  if (list && list.length > 0) {
    return list[Math.floor(Math.random() * list.length)];
  }

  throw new Error(`No GIF found for action: ${action}`);
}

module.exports = {
  getAnimeGif,
  FALLBACK_GIFS,
};
