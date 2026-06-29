const {
  PermissionFlagsBits,
  ActionRowBuilder,
  StringSelectMenuBuilder,
} = require("discord.js");

module.exports = {
  name: "configmenu",
  aliases: ["config", "cfg"],
  description:
    "Menu de configuration complète du bot — affiche et gère tous les paramètres du serveur.",
  category: "config",
  usage: "configmenu",
  userPerms: [PermissionFlagsBits.Administrator],
  async execute(client, message, args) {
    const gs = client.db.getGuild(message.guild.id);
    const antiraid = client.db.getAntiraidConfig(message.guild.id);

    const onoff = (v) => (v ? "on" : "off");
    const chanName = (id) => {
      if (!id) return message.t("commands.configmenu.not_set");
      const ch = message.guild.channels.cache.get(id);
      return ch ? `#${ch.name}` : id;
    };
    const roleName = (id) => {
      if (!id) return message.t("commands.configmenu.not_set");
      const r = message.guild.roles.cache.get(id);
      return r ? `@${r.name}` : id;
    };
    const pad = (k, w = 11) => (k + " ".repeat(w)).slice(0, w);
    const block = (rows) =>
      "```prolog\n" +
      rows.map(([k, v]) => `${pad(k)}: ${v}`).join("\n") +
      "\n```";

    const ticketsCfg = client.db.getTicketsConfig?.(message.guild.id);
    const statsCfg = client.db.getStatsConfig?.(message.guild.id);

    const embed = client.embedBuilder
      .base(client, message.t("commands.configmenu.title"), null)
      .addFields(
        {
          name: message.t("commands.configmenu.section_welcome"),
          value: block([
            [message.t("commands.configmenu.row_channel"), chanName(gs.welcomeChannel)],
            [message.t("commands.configmenu.row_dm"), onoff(gs.welcomeDm)],
          ]),
          inline: true,
        },
        {
          name: message.t("commands.configmenu.section_goodbye"),
          value: block([[message.t("commands.configmenu.row_channel"), chanName(gs.goodbyeChannel)]]),
          inline: true,
        },
        {
          name: message.t("commands.configmenu.section_joinping"),
          value: block([
            [message.t("commands.configmenu.row_channel"), chanName(gs.joinPingChannel)],
            [message.t("commands.configmenu.row_mode"), gs.joinPingMode || "ghost"],
          ]),
          inline: true,
        },
        {
          name: message.t("commands.configmenu.section_stats"),
          value: block([[message.t("commands.configmenu.row_voice"), onoff(statsCfg)]]),
          inline: true,
        },
        {
          name: message.t("commands.configmenu.section_logs"),
          value: block([
            [message.t("commands.configmenu.row_mod"), chanName(gs.modLogsChannel)],
            [message.t("commands.configmenu.row_raid"), chanName(gs.raidLogsChannel)],
            [message.t("commands.configmenu.row_voice_log"), chanName(gs.voiceLogsChannel)],
          ]),
          inline: true,
        },
        {
          name: message.t("commands.configmenu.section_autorole"),
          value: block([[message.t("commands.configmenu.row_role"), roleName(gs.autoRole)]]),
          inline: true,
        },
        {
          name: message.t("commands.configmenu.section_moderation"),
          value: block([
            [message.t("commands.configmenu.row_anti_spam"), onoff(antiraid.antiSpam)],
            [message.t("commands.configmenu.row_anti_link"), onoff(antiraid.antiLink)],
            [message.t("commands.configmenu.row_anti_words"), onoff(antiraid.antiBadWords ?? gs.antiBadWords)],
          ]),
          inline: true,
        },
        {
          name: message.t("commands.configmenu.section_antiraid"),
          value: block([
            [message.t("commands.configmenu.row_raid_mode"), onoff(antiraid?.raidMode)],
            [message.t("commands.configmenu.row_anti_bot"), onoff(antiraid?.antiBot)],
            [message.t("commands.configmenu.row_anti_nuke"), onoff(antiraid?.antiNuke)],
          ]),
          inline: true,
        },
        {
          name: message.t("commands.configmenu.section_economy"),
          value: block([[message.t("commands.configmenu.row_currency"), gs.currencyName || "Coins"]]),
          inline: true,
        },
        {
          name: message.t("commands.configmenu.section_tickets"),
          value: block([[message.t("commands.configmenu.row_active"), onoff(ticketsCfg?.categoryId)]]),
          inline: true,
        },
        {
          name: message.t("commands.configmenu.section_levels"),
          value: block([[message.t("commands.configmenu.row_channel"), chanName(gs.levelChannel)]]),
          inline: true,
        },
        {
          name: message.t("commands.configmenu.section_birthdays"),
          value: block([
            [message.t("commands.configmenu.row_channel"), chanName(gs.birthdayChannel || gs.welcomeChannel)],
          ]),
          inline: true,
        },
      );

    const row = new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId("config_menu")
        .setPlaceholder(message.t("commands.configmenu.select_placeholder"))
        .addOptions([
          {
            label: message.t("commands.configmenu.section_welcome"),
            description: message.t("commands.configmenu.opt_welcome_desc"),
            value: "welcome",
          },
          {
            label: message.t("commands.configmenu.section_goodbye"),
            description: message.t("commands.configmenu.opt_goodbye_desc"),
            value: "goodbye",
          },
          {
            label: message.t("commands.configmenu.section_joinping"),
            description: message.t("commands.configmenu.opt_joinping_desc"),
            value: "joinping",
          },
          {
            label: message.t("commands.configmenu.section_stats"),
            description: message.t("commands.configmenu.opt_stats_desc"),
            value: "stats",
          },
          {
            label: message.t("commands.configmenu.section_logs"),
            description: message.t("commands.configmenu.opt_logs_desc"),
            value: "logs",
          },
          {
            label: message.t("commands.configmenu.section_autorole"),
            description: message.t("commands.configmenu.opt_autorole_desc"),
            value: "autorole",
          },
          {
            label: message.t("commands.configmenu.section_moderation"),
            description: message.t("commands.configmenu.opt_moderation_desc"),
            value: "moderation",
          },
          {
            label: message.t("commands.configmenu.section_antiraid"),
            description: message.t("commands.configmenu.opt_antiraid_desc"),
            value: "antiraid",
          },
          {
            label: message.t("commands.configmenu.section_economy"),
            description: message.t("commands.configmenu.opt_economy_desc"),
            value: "economy",
          },
          {
            label: message.t("commands.configmenu.section_tickets"),
            description: message.t("commands.configmenu.opt_tickets_desc"),
            value: "tickets",
          },
          {
            label: message.t("commands.configmenu.section_levels"),
            description: message.t("commands.configmenu.opt_levels_desc"),
            value: "levels",
          },
          {
            label: message.t("commands.configmenu.section_birthdays"),
            description: message.t("commands.configmenu.opt_birthdays_desc"),
            value: "birthdays",
          },
        ]),
    );

    await message.reply({ embeds: [embed], components: [row] }).catch(() => {});
  },
};
