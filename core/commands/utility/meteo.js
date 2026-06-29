const { EmbedBuilder } = require("discord.js");
const axios = require("axios");
const Logger = require("../../utils/logger");

module.exports = {
  name: "meteo",
  aliases: ["weather"],
  description: "Affiche la météo pour une ville donnée.",
  category: "utility",
  usage: "+meteo [ville]",
  async execute(client, message, args) {
    const city = args.join(" ");
    if (!city)
      return message
        .reply({
          embeds: [
            client.embedBuilder.warning(
              client,
              message.t("commands.meteo.city_required"),
            ),
          ],
        })
        .catch(() => {});

    try {
      const geoRes = await axios.get(
        `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1&language=fr&format=json`,
      );
      if (!geoRes.data.results || geoRes.data.results.length === 0) {
        return message
          .reply({
            embeds: [client.embedBuilder.error(client, message.t("commands.meteo.city_not_found"))],
          })
          .catch(() => {});
      }

      const location = geoRes.data.results[0];
      const { latitude, longitude, name, country } = location;

      const weatherRes = await axios.get(
        `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m,pressure_msl&timezone=auto`,
      );

      const current = weatherRes.data.current;

      const weatherCodes = {
        0: message.t("commands.meteo.code_0"),
        1: message.t("commands.meteo.code_1"),
        2: message.t("commands.meteo.code_2"),
        3: message.t("commands.meteo.code_3"),
        45: message.t("commands.meteo.code_45"),
        48: message.t("commands.meteo.code_48"),
        51: message.t("commands.meteo.code_51"),
        53: message.t("commands.meteo.code_53"),
        55: message.t("commands.meteo.code_55"),
        61: message.t("commands.meteo.code_61"),
        63: message.t("commands.meteo.code_63"),
        65: message.t("commands.meteo.code_65"),
        71: message.t("commands.meteo.code_71"),
        73: message.t("commands.meteo.code_73"),
        75: message.t("commands.meteo.code_75"),
        95: message.t("commands.meteo.code_95"),
        96: message.t("commands.meteo.code_96"),
        99: message.t("commands.meteo.code_99"),
      };

      const desc = weatherCodes[current.weather_code] || message.t("commands.meteo.code_unknown");

      const embed = new EmbedBuilder()
        .setColor(client.embedBuilder.getTheme(client))
        .setAuthor({
          name: message.t("commands.meteo.author", { name, country }),
          iconURL: client.user.displayAvatarURL({ size: 256 }),
        })
        .setDescription(desc)
        .addFields(
          {
            name: message.t("commands.meteo.temperature"),
            value: `\`${current.temperature_2m} °C\``,
            inline: true,
          },
          {
            name: message.t("commands.meteo.feels_like"),
            value: `\`${current.apparent_temperature} °C\``,
            inline: true,
          },
          {
            name: message.t("commands.meteo.humidity"),
            value: `\`${current.relative_humidity_2m} %\``,
            inline: true,
          },
          {
            name: message.t("commands.meteo.wind"),
            value: `\`${current.wind_speed_10m} km/h\``,
            inline: true,
          },
          {
            name: message.t("commands.meteo.precipitation"),
            value: `\`${current.precipitation ?? 0} mm\``,
            inline: true,
          },
          {
            name: message.t("commands.meteo.pressure"),
            value: `\`${current.pressure_msl ? Math.round(current.pressure_msl) : "—"} hPa\``,
            inline: true,
          },
        )
        .setTimestamp()
        .setFooter({
          text: "Open-Meteo",
          iconURL: client.user.displayAvatarURL(),
        });

      await message.reply({ embeds: [embed] }).catch(() => {});
    } catch (err) {
      Logger.error(
        `[CMD meteo] guild=${message.guild?.id || "DM"} user=${message.author?.id} city="${city}":`,
        err,
      );
      await message
        .reply({
          embeds: [client.embedBuilder.error(client, message.t("commands.meteo.service_unavailable"))],
        })
        .catch(() => {});
    }
  },
};
