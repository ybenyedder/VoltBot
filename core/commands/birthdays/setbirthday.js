module.exports = {
  name: "setbirthday",
  aliases: ["anniversaire", "setbday"],
  description: "Définit votre date d'anniversaire.",
  category: "birthdays",
  usage: "+setbirthday [JJ] [MM]",
  async execute(client, message, args) {
    const day = parseInt(args[0], 10);
    const month = parseInt(args[1], 10);

    const daysInMonth = (m) => {
      if ([4, 6, 9, 11].includes(m)) return 30;
      if (m === 2) return 29;
      return 31;
    };

    if (
      isNaN(day) ||
      isNaN(month) ||
      month < 1 ||
      month > 12 ||
      day < 1 ||
      day > daysInMonth(month)
    ) {
      return message
        .reply({
          embeds: [
            client.embedBuilder.error(
              client,
              message.t("commands.setbirthday.invalid_date"),
            ),
          ],
        })
        .catch(() => {});
    }

    try {
      client.db.db
        .prepare(
          "INSERT OR REPLACE INTO birthdays (userId, guildId, day, month) VALUES (?, ?, ?, ?)",
        )
        .run(message.author.id, message.guild.id, day, month);
    } catch (e) {
      return message
        .reply({
          embeds: [
            client.embedBuilder.error(
              client,
              message.t("commands.setbirthday.save_failed"),
            ),
          ],
        })
        .catch(() => {});
    }

    const pad = (n) => String(n).padStart(2, "0");
    const MONTH_NAMES = [
      message.t("commands.setbirthday.month_1"),
      message.t("commands.setbirthday.month_2"),
      message.t("commands.setbirthday.month_3"),
      message.t("commands.setbirthday.month_4"),
      message.t("commands.setbirthday.month_5"),
      message.t("commands.setbirthday.month_6"),
      message.t("commands.setbirthday.month_7"),
      message.t("commands.setbirthday.month_8"),
      message.t("commands.setbirthday.month_9"),
      message.t("commands.setbirthday.month_10"),
      message.t("commands.setbirthday.month_11"),
      message.t("commands.setbirthday.month_12"),
    ];

    // Tout en UTC : la comparaison "passé ou non" doit être indépendante du TZ
    // serveur, et le timestamp renvoyé est un Unix epoch (UTC) que Discord
    // localise côté client via <t:N:R>.
    const now = new Date();
    const todayMidnightUtc = Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate(),
    );
    let nextMs = Date.UTC(now.getUTCFullYear(), month - 1, day);
    if (nextMs < todayMidnightUtc) {
      nextMs = Date.UTC(now.getUTCFullYear() + 1, month - 1, day);
    }
    const nextTs = Math.floor(nextMs / 1000);

    const embed = client.embedBuilder
      .success(client, message.t("commands.setbirthday.saved"))
      .addFields(
        {
          name: message.t("commands.setbirthday.field_date"),
          value: message.t("commands.setbirthday.date_value", {
            dd: pad(day),
            mm: pad(month),
            day,
            month: MONTH_NAMES[month - 1],
          }),
          inline: true,
        },
        {
          name: message.t("commands.setbirthday.field_next"),
          value: `<t:${nextTs}:R>`,
          inline: true,
        },
      );

    await message.reply({ embeds: [embed] }).catch(() => {});
  },
};
