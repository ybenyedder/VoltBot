module.exports = {
  name: "afk",
  description:
    "Vous signale comme absent (AFK). Le bot préviendra ceux qui vous mentionnent.",
  category: "utility",
  usage: "+afk [raison]",
  async execute(client, message, args) {
    const reason = args.join(" ") || message.t("commands.afk.reason_unspecified");
    const now = Date.now();

    client.db.db
      .prepare(
        "INSERT OR REPLACE INTO afk (userId, guildId, reason, timestamp) VALUES (?, ?, ?, ?)",
      )
      .run(message.author.id, message.guild.id, reason, now);

    const ts = Math.floor(now / 1000);

    const embed = client.embedBuilder
      .base(client, "AFK")
      .addFields(
        {
          name: message.t("commands.afk.field_status"),
          value: message.t("commands.afk.status_away"),
          inline: true,
        },
        {
          name: message.t("commands.afk.field_since"),
          value: `<t:${ts}:R>`,
          inline: true,
        },
        {
          name: message.t("commands.afk.field_reason"),
          value: reason.slice(0, 1024),
          inline: false,
        },
      );

    await message.reply({ embeds: [embed] }).catch(() => {});
  },
};
