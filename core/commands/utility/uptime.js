module.exports = {
  name: "uptime",
  aliases: ["up", "en-ligne"],
  description: "Affiche depuis combien de temps le bot est en ligne.",
  category: "utility",
  usage: "uptime",
  async execute(client, message, args) {
    const ms = client.uptime;
    const startTs = Math.floor((Date.now() - ms) / 1000);
    const totalSec = Math.floor(ms / 1000);
    const d = Math.floor(totalSec / 86400);
    const h = Math.floor((totalSec % 86400) / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    const s = totalSec % 60;

    const parts = [];
    if (d) parts.push(message.t("commands.uptime.unit_day", { value: d }));
    if (h) parts.push(message.t("commands.uptime.unit_hour", { value: h }));
    if (m) parts.push(message.t("commands.uptime.unit_minute", { value: m }));
    if (s || parts.length === 0) parts.push(message.t("commands.uptime.unit_second", { value: s }));

    const embed = client.embedBuilder
      .base(client, message.t("commands.uptime.title"))
      .addFields(
        { name: message.t("commands.uptime.field_duration"), value: `\`${parts.join(" ")}\``, inline: true },
        { name: message.t("commands.uptime.field_since"), value: `<t:${startTs}:R>`, inline: true },
      );

    await message.reply({ embeds: [embed] }).catch(() => {});
  },
};
