const { EmbedBuilder, MessageFlags } = require("discord.js");

const safeRespond = async (interaction, payload) => {
  try {
    if (interaction.replied || interaction.deferred) {
      return await interaction.followUp(payload);
    }
    return await interaction.reply(payload);
  } catch (_) {
    /* swallow */
  }
};

const ch = (interaction, id) =>
  id ? `<#${id}>` : `\`${interaction.t("interactions.config.not_set")}\``;
const ro = (interaction, id) =>
  id ? `<@&${id}>` : `\`${interaction.t("interactions.config.not_set")}\``;
const onOff = (interaction, v) =>
  v
    ? interaction.t("interactions.config.active")
    : interaction.t("interactions.config.inactive");
const code = (v) => `\`${v}\``;

const SECTIONS = {
  welcome: "interactions.config.section_welcome",
  goodbye: "interactions.config.section_goodbye",
  joinping: "interactions.config.section_joinping",
  stats: "interactions.config.section_stats",
  logs: "interactions.config.section_logs",
  autorole: "interactions.config.section_autorole",
  moderation: "interactions.config.section_moderation",
  antiraid: "interactions.config.section_antiraid",
  economy: "interactions.config.section_economy",
  tickets: "interactions.config.section_tickets",
  levels: "interactions.config.section_levels",
  birthdays: "interactions.config.section_birthdays",
};

const handleConfigMenuInteractions = async (interaction, client) => {
  if (
    !interaction.isStringSelectMenu() ||
    interaction.customId !== "config_menu"
  )
    return false;

  try {
    const selected = interaction.values[0];
    const gs = client.db.getGuild(interaction.guild.id);
    const ar = client.db.getAntiraidConfig(interaction.guild.id);
    const sectionName = SECTIONS[selected]
      ? interaction.t(SECTIONS[selected])
      : interaction.t("interactions.config.section_unknown");

    const embed = new EmbedBuilder()
      .setColor(client.embedBuilder.getTheme(client))
      .setAuthor({
        name: interaction.t("interactions.config.author", {
          section: sectionName,
        }),
        iconURL: interaction.guild.iconURL({ dynamic: true }),
      })
      .setTimestamp();

    const setRows = (rows) => {
      const fields = [];
      for (const [nom, valeur] of rows) {
        fields.push(
          { name: interaction.t("interactions.config.field_name"), value: nom, inline: true },
          { name: interaction.t("interactions.config.field_current_value"), value: valeur, inline: true },
          { name: "​", value: "​", inline: true },
        );
      }
      embed.addFields(fields);
    };

    switch (selected) {
      case "welcome":
        setRows([
          [interaction.t("interactions.config.row_channel"), ch(interaction, gs.welcomeChannel)],
          [interaction.t("interactions.config.row_dm"), onOff(interaction, gs.welcomeDm)],
          [
            interaction.t("interactions.config.row_message"),
            code(gs.welcomeMessage || "Bienvenue {user} sur {server}."),
          ],
        ]);
        break;

      case "goodbye":
        setRows([
          [interaction.t("interactions.config.row_channel"), ch(interaction, gs.goodbyeChannel)],
          [interaction.t("interactions.config.row_dm"), onOff(interaction, gs.goodbyeDm)],
          [interaction.t("interactions.config.row_channel_message"), code(gs.goodbyeMessage || interaction.t("interactions.config.default_goodbye_message"))],
          [interaction.t("interactions.config.row_dm_message"), code(gs.goodbyeDmMessage || interaction.t("interactions.config.default_goodbye_dm_message"))],
        ]);
        break;

      case "joinping":
        setRows([
          [interaction.t("interactions.config.row_channel"), ch(interaction, gs.joinPingChannel)],
          [interaction.t("interactions.config.row_mode"), code(gs.joinPingMode || "ghost")],
        ]);
        break;

      case "stats": {
        const statsConf = client.db.getStatsConfig?.(interaction.guild.id);
        setRows([
          [
            interaction.t("interactions.config.row_state"),
            statsConf
              ? interaction.t("interactions.config.configured")
              : `\`${interaction.t("interactions.config.not_set")}\``,
          ],
          [
            interaction.t("interactions.config.row_channels"),
            statsConf
              ? interaction.t("interactions.config.stats_channels")
              : `\`${interaction.t("interactions.config.none")}\``,
          ],
          [interaction.t("interactions.config.row_cycle"), interaction.t("interactions.config.cycle_value")],
        ]);
        break;
      }

      case "logs":
        setRows([
          [interaction.t("interactions.config.row_moderation"), ch(interaction, gs.modLogsChannel)],
          [interaction.t("interactions.config.row_raid"), ch(interaction, gs.raidLogsChannel)],
          [interaction.t("interactions.config.row_voice"), ch(interaction, gs.voiceLogsChannel)],
          [interaction.t("interactions.config.row_messages"), ch(interaction, gs.msgLogsChannel)],
        ]);
        break;

      case "autorole":
        setRows([[interaction.t("interactions.config.row_role"), ro(interaction, gs.autoRole)]]);
        break;

      case "moderation":
        setRows([
          [interaction.t("interactions.config.row_antispam"), onOff(interaction, ar.antiSpam)],
          [interaction.t("interactions.config.row_antilink"), onOff(interaction, ar.antiLink)],
          [interaction.t("interactions.config.row_antibadwords"), onOff(interaction, ar.antiBadWords ?? gs.antiBadWords)],
          [interaction.t("interactions.config.row_modrole"), ro(interaction, gs.modRole)],
          [interaction.t("interactions.config.row_sanction_dm"), onOff(interaction, gs.sanctionDm)],
        ]);
        break;

      case "antiraid":
        setRows([
          [interaction.t("interactions.config.row_raid_mode"), onOff(interaction, ar?.raidMode)],
          [interaction.t("interactions.config.row_antibot"), onOff(interaction, ar?.antiBot)],
          [interaction.t("interactions.config.row_antinuke"), onOff(interaction, ar?.antiNuke)],
          [interaction.t("interactions.config.row_antiban"), onOff(interaction, ar?.antiBan)],
          [interaction.t("interactions.config.row_antikick"), onOff(interaction, ar?.antiKick)],
          [interaction.t("interactions.config.row_antispam"), onOff(interaction, ar?.antiSpam)],
        ]);
        break;

      case "economy":
        setRows([
          [interaction.t("interactions.config.row_currency"), code(gs.currencyName || "Coins")],
          [interaction.t("interactions.config.row_work"), `${gs.minWork || 50} – ${gs.maxWork || 200}`],
          [interaction.t("interactions.config.row_daily"), `${gs.minDaily || 200} – ${gs.maxDaily || 1000}`],
        ]);
        break;

      case "tickets": {
        const tc = client.db.getTicketConfig?.(interaction.guild.id);
        setRows([
          [
            interaction.t("interactions.config.row_category"),
            tc?.categoryId ? `<#${tc.categoryId}>` : `\`${interaction.t("interactions.config.not_set")}\``,
          ],
          [
            interaction.t("interactions.config.row_staff_role"),
            tc?.roleId ? `<@&${tc.roleId}>` : `\`${interaction.t("interactions.config.not_set")}\``,
          ],
          [
            interaction.t("interactions.config.row_logs"),
            tc?.logsChannelId ? `<#${tc.logsChannelId}>` : `\`${interaction.t("interactions.config.not_set")}\``,
          ],
        ]);
        break;
      }

      case "levels":
        setRows([[interaction.t("interactions.config.row_levelup_channel"), ch(interaction, gs.levelChannel)]]);
        break;

      case "birthdays":
        setRows([
          [interaction.t("interactions.config.row_dedicated_channel"), ch(interaction, gs.birthdayChannel)],
          [
            interaction.t("interactions.config.row_fallback_channel"),
            gs.birthdayChannel ? ch(interaction, gs.welcomeChannel) : `\`${interaction.t("interactions.config.none")}\``,
          ],
          [interaction.t("interactions.config.row_announce_time"), "08:00"],
        ]);
        break;

      default:
        embed.setDescription(interaction.t("interactions.config.unknown_category"));
    }

    // Mutate same panel message; fall back to fresh ephemeral if non-ephemeral source.
    if (interaction.message?.flags?.has?.(MessageFlags.Ephemeral)) {
      await interaction
        .update({
          embeds: [embed],
          components: interaction.message.components || [],
        })
        .catch(() => {});
    } else {
      await interaction
        .update({
          embeds: [embed],
          components: interaction.message?.components || [],
        })
        .catch(async () => {
          await interaction
            .reply({ embeds: [embed], flags: [MessageFlags.Ephemeral] })
            .catch(() => {});
        });
    }
    return true;
  } catch (e) {
    await safeRespond(interaction, {
      embeds: [
        client.embedBuilder.error(
          client,
          interaction.t("interactions.config.section_unavailable"),
        ),
      ],
      flags: [MessageFlags.Ephemeral],
    });
    return true;
  }
};

module.exports = { handleConfigMenuInteractions };
