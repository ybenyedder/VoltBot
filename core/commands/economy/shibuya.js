const {
  getMainEmbed,
  getRow,
  getCasinoSettings,
} = require("../../events/interactionHandlers/casinoHandlers");

module.exports = {
  name: "shibuya",
  aliases: ["casino", "box", "gift"],
  description: "Ouvre le Shibuya Casino.",
  category: "economy",
  usage: "shibuya",
  async execute(client, message, args) {
    const { casinoConfig } = getCasinoSettings(client, message.guild.id);
    const s = casinoConfig.settings || {};

    await message
      .reply({
        embeds: [getMainEmbed(message.guild, s, message.t)],
        components: [getRow(s, message.t)],
      })
      .catch(() => {});
  },
};
