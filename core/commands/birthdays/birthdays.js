const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
} = require("discord.js");

const MONTH_NAMES = [
  "janvier",
  "février",
  "mars",
  "avril",
  "mai",
  "juin",
  "juillet",
  "août",
  "septembre",
  "octobre",
  "novembre",
  "décembre",
];

const MONTH_TITLES = [
  "Janvier",
  "Février",
  "Mars",
  "Avril",
  "Mai",
  "Juin",
  "Juillet",
  "Août",
  "Septembre",
  "Octobre",
  "Novembre",
  "Décembre",
];

const PAGE_SIZE = 6;

const fmtLine = (b, monthNames) =>
  `<@${b.userId}> · ${b.day} ${monthNames[b.month - 1]}`;

const clamp = (str) => (str.length > 1024 ? `${str.slice(0, 1021)}...` : str);

function buildMonthFields(list, monthNames, monthTitles) {
  const byMonth = new Map();
  for (const b of list) {
    if (!byMonth.has(b.month)) byMonth.set(b.month, []);
    byMonth.get(b.month).push(b);
  }
  const months = [...byMonth.keys()].sort((a, b) => a - b);
  return months.map((m) => {
    const entries = byMonth.get(m).sort((a, b) => a.day - b.day);
    return {
      name: monthTitles[m - 1],
      value: clamp(entries.map((b) => fmtLine(b, monthNames)).join("\n")),
      inline: true,
    };
  });
}

function chunk(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

module.exports = {
  name: "birthdays",
  aliases: ["bdays"],
  description: "Affiche les prochains anniversaires du serveur.",
  category: "birthdays",
  usage: "birthdays",
  async execute(client, message, args) {
    let list;
    try {
      list = client.db.db
        .prepare("SELECT * FROM birthdays WHERE guildId = ?")
        .all(message.guild.id);
    } catch (e) {
      return message
        .reply({
          embeds: [
            client.embedBuilder.error(
              client,
              message.t("commands.birthdays.read_failed"),
            ),
          ],
        })
        .catch(() => {});
    }

    if (!list || list.length === 0) {
      return message
        .reply({
          embeds: [
            client.embedBuilder.info(client, message.t("commands.birthdays.none_registered")),
          ],
        })
        .catch(() => {});
    }

    // UTC pour aligner sur le scheduler d'annonces (clientReady.js).
    const now = new Date();
    const todayD = now.getUTCDate();
    const todayM = now.getUTCMonth() + 1;

    const todayList = list
      .filter((b) => b.day === todayD && b.month === todayM)
      .sort((a, b) => a.userId.localeCompare(b.userId));

    const sortedByMonth = [...list].sort(
      (a, b) => a.month - b.month || a.day - b.day,
    );

    const monthNames = [
      message.t("commands.birthdays.month_1_lower"),
      message.t("commands.birthdays.month_2_lower"),
      message.t("commands.birthdays.month_3_lower"),
      message.t("commands.birthdays.month_4_lower"),
      message.t("commands.birthdays.month_5_lower"),
      message.t("commands.birthdays.month_6_lower"),
      message.t("commands.birthdays.month_7_lower"),
      message.t("commands.birthdays.month_8_lower"),
      message.t("commands.birthdays.month_9_lower"),
      message.t("commands.birthdays.month_10_lower"),
      message.t("commands.birthdays.month_11_lower"),
      message.t("commands.birthdays.month_12_lower"),
    ];
    const monthTitles = [
      message.t("commands.birthdays.month_1"),
      message.t("commands.birthdays.month_2"),
      message.t("commands.birthdays.month_3"),
      message.t("commands.birthdays.month_4"),
      message.t("commands.birthdays.month_5"),
      message.t("commands.birthdays.month_6"),
      message.t("commands.birthdays.month_7"),
      message.t("commands.birthdays.month_8"),
      message.t("commands.birthdays.month_9"),
      message.t("commands.birthdays.month_10"),
      message.t("commands.birthdays.month_11"),
      message.t("commands.birthdays.month_12"),
    ];

    const monthFields = buildMonthFields(sortedByMonth, monthNames, monthTitles);
    const pages = chunk(monthFields, PAGE_SIZE);
    const totalPages = pages.length;

    const todayField =
      todayList.length > 0
        ? {
            name: message.t("commands.birthdays.today"),
            value: clamp(todayList.map((b) => `<@${b.userId}>`).join(" · ")),
            inline: false,
          }
        : null;

    const buildEmbed = (pageIdx) => {
      const embed = client.embedBuilder.base(client, null, null).setAuthor({
        name: message.t("commands.birthdays.author"),
        iconURL: client?.user?.displayAvatarURL?.({ size: 64 }),
      });
      if (totalPages > 1) {
        embed.setFooter({ text: message.t("commands.birthdays.footer_page", { page: pageIdx + 1, total: totalPages }) });
      }
      const fields = [];
      if (todayField) fields.push(todayField);
      fields.push(...pages[pageIdx]);
      embed.addFields(fields);
      return embed;
    };

    if (totalPages <= 1) {
      return message.reply({ embeds: [buildEmbed(0)] }).catch(() => {});
    }

    let current = 0;
    const buildRow = (idx, disabled = false) =>
      new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("bday_prev")
          .setLabel(message.t("commands.birthdays.btn_prev"))
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(disabled || idx === 0),
        new ButtonBuilder()
          .setCustomId("bday_page")
          .setLabel(message.t("commands.birthdays.footer_page", { page: idx + 1, total: totalPages }))
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(true),
        new ButtonBuilder()
          .setCustomId("bday_next")
          .setLabel(message.t("commands.birthdays.btn_next"))
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(disabled || idx === totalPages - 1),
      );

    const sent = await message
      .reply({
        embeds: [buildEmbed(current)],
        components: [buildRow(current)],
      })
      .catch(() => null);
    if (!sent) return;

    const collector = sent.createMessageComponentCollector({
      componentType: ComponentType.Button,
      time: 120000,
      filter: (i) => i.user.id === message.author.id,
    });

    collector.on("collect", async (interaction) => {
      if (interaction.customId === "bday_prev" && current > 0) current--;
      else if (interaction.customId === "bday_next" && current < totalPages - 1)
        current++;
      await interaction
        .update({
          embeds: [buildEmbed(current)],
          components: [buildRow(current)],
        })
        .catch(() => {});
    });

    collector.on("end", async () => {
      await sent
        .edit({ components: [buildRow(current, true)] })
        .catch(() => {});
    });
  },
};
