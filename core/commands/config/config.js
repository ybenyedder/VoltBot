const { PermissionsBitField } = require("discord.js");
const permissions = require("../../utils/permissions");

module.exports = {
  name: "config",
  aliases: ["settings"],
  description: "Affiche la configuration actuelle du serveur.",
  category: "config",
  usage: "config",
  userPerms: [PermissionsBitField.Flags.Administrator],
  async execute(client, message, args) {
    if (!permissions.isAdmin(message)) {
      return message
        .reply({
          embeds: [
            client.embedBuilder.error(client, message.t("commands.config.admin_only")),
          ],
        })
        .catch(() => {});
    }

    const gs = client.db.getGuild(message.guild.id) || {};
    const antiraid = client.db.getAntiraidConfig(message.guild.id) || {};

    const chanName = (id) => {
      if (!id) return "—";
      const ch = message.guild.channels.cache.get(id);
      return ch ? `#${ch.name}` : id;
    };
    const roleName = (id) => {
      if (!id) return "—";
      const r = message.guild.roles.cache.get(id);
      return r ? `@${r.name}` : id;
    };
    const onoff = (v) => (v ? "on" : "off");
    const pad = (k, w = 10) => (k + " ".repeat(w)).slice(0, w);
    const block = (rows) =>
      "```prolog\n" +
      rows.map(([k, v]) => `${pad(k)}: ${v}`).join("\n") +
      "\n```";

    let publicChannels;
    try {
      const arr = JSON.parse(gs.publicChannels || "[]");
      publicChannels =
        arr.length > 0
          ? message.t("commands.config.public_count", { count: arr.length })
          : message.t("commands.config.public_all");
    } catch {
      publicChannels = message.t("commands.config.public_all");
    }

    const guildIcon = message.guild.iconURL({ size: 256 });

    const embed = client.embedBuilder
      .base(client, message.t("commands.config.title", { server: message.guild.name }), null)
      .setAuthor({
        name: message.t("commands.config.title", { server: message.guild.name }),
        iconURL: guildIcon || undefined,
      })
      .setThumbnail(guildIcon || null)
      .addFields(
        {
          name: message.t("commands.config.section_general"),
          value: block([
            [message.t("commands.config.row_prefix"), gs.prefix || client.config.prefix],
            [message.t("commands.config.row_public"), publicChannels],
            [message.t("commands.config.row_fivem"), gs.fivemIP || "—"],
            [message.t("commands.config.row_language"), gs.language || "fr"],
          ]),
          inline: false,
        },
        {
          name: message.t("commands.config.section_moderation"),
          value: block([
            [message.t("commands.config.row_mod_role"), roleName(gs.modRole)],
            [message.t("commands.config.row_spam"), onoff(antiraid.antiSpam)],
            [message.t("commands.config.row_link"), onoff(antiraid.antiLink)],
            [message.t("commands.config.row_words"), onoff(antiraid.antiBadWords ?? gs.antiBadWords)],
            [message.t("commands.config.row_rank"), onoff(antiraid.antiRank)],
          ]),
          inline: true,
        },
        {
          name: message.t("commands.config.section_logs"),
          value: block([
            [message.t("commands.config.row_mod"), chanName(gs.modLogsChannel)],
            [message.t("commands.config.row_raid"), chanName(gs.raidLogsChannel)],
          ]),
          inline: true,
        },
        {
          name: message.t("commands.config.section_welcome"),
          value: block([
            [message.t("commands.config.row_arrival"), chanName(gs.welcomeChannel)],
            [message.t("commands.config.row_departure"), chanName(gs.goodbyeChannel)],
            [message.t("commands.config.row_auto_role"), roleName(gs.autoRole)],
          ]),
          inline: true,
        },
        {
          name: message.t("commands.config.section_levels"),
          value: block([
            [message.t("commands.config.row_channel"), chanName(gs.levelChannel)],
          ]),
          inline: true,
        },
        {
          name: message.t("commands.config.section_economy"),
          value: block([
            [message.t("commands.config.row_currency"), gs.currencyName || "Coins"],
          ]),
          inline: true,
        },
        {
          name: message.t("commands.config.section_tickets"),
          value: block([
            [message.t("commands.config.row_category"), gs.ticketCategory ? `<${gs.ticketCategory}>` : "—"],
            [message.t("commands.config.row_logs"), chanName(gs.ticketLogChannel)],
          ]),
          inline: true,
        },
      )
      .setFooter({
        text: message.t("commands.config.footer", {
          server: message.guild.name,
          members: new Intl.NumberFormat("fr-FR").format(message.guild.memberCount),
        }),
        iconURL: guildIcon || undefined,
      });

    return message.reply({ embeds: [embed] }).catch(() => {});
  },
};
