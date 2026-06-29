const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  MessageFlags,
  StringSelectMenuBuilder,
} = require("discord.js");
const permissions = require("../../utils/permissions");
const { t } = require("../../utils/i18n");

let HELP_EXAMPLES = {};
try {
  HELP_EXAMPLES = require("../../utils/help_examples.json");
} catch (e) {
  HELP_EXAMPLES = {};
}

const CATEGORY_KEYS = {
  antiraid: "commands.helptest.cat_antiraid",
  backup: "commands.helptest.cat_backup",
  birthdays: "commands.helptest.cat_birthdays",
  config: "commands.helptest.cat_config",
  custom: "commands.helptest.cat_custom",
  economy: "commands.helptest.cat_economy",
  fun: "commands.helptest.cat_fun",
  invitations: "commands.helptest.cat_invitations",
  levels: "commands.helptest.cat_levels",
  logs: "commands.helptest.cat_logs",
  moderation: "commands.helptest.cat_moderation",
  roles: "commands.helptest.cat_roles",
  security: "commands.helptest.cat_security",
  social: "commands.helptest.cat_social",
  stats: "commands.helptest.cat_stats",
  suggestions: "commands.helptest.cat_suggestions",
  tickets: "commands.helptest.cat_tickets",
  utility: "commands.helptest.cat_utility",
  voice: "commands.helptest.cat_voice",
};

const PER_PAGE_CMDS = 15;
const COLLECTOR_MS = 120_000;

const labelFor = (cat, lang = "fr") =>
  (CATEGORY_KEYS[cat] && t(lang, CATEGORY_KEYS[cat])) ||
  cat.charAt(0).toUpperCase() + cat.slice(1);

const sortCmds = (arr) =>
  arr.slice().sort((a, b) => a.name.localeCompare(b.name));

const exampleFor = (cmd, prefix) => {
  const raw = HELP_EXAMPLES[cmd.name];
  if (!raw) return null;
  const resolved = raw.replace(/\$\{prefix\}/g, prefix);
  const m = resolved.match(/`([^`]+)`/);
  return m ? m[1] : null;
};

const buildHero = (client, categorized, totalCmds, prefix, lang = "fr") => {
  const fmt = new Intl.NumberFormat("fr-FR");
  const cats = Array.from(categorized.keys()).sort((a, b) =>
    labelFor(a, lang).localeCompare(labelFor(b, lang)),
  );
  const embed = new EmbedBuilder()
    .setColor(client.embedBuilder.getTheme(client))
    .setAuthor({
      name: t(lang, "commands.helptest.hero_author", { count: fmt.format(totalCmds) }),
      iconURL: client.user.displayAvatarURL({ size: 256 }),
    })
    .setThumbnail(client.user.displayAvatarURL({ size: 1024 }))
    .setDescription(
      t(lang, "commands.helptest.hero_desc", { prefix, cats: cats.length }),
    )
    .setTimestamp();

  for (const cat of cats) {
    const cmds = categorized.get(cat) || [];
    embed.addFields({
      name: `${labelFor(cat, lang)} · ${cmds.length}`,
      value: "—",
      inline: true,
    });
  }
  return embed;
};

const buildCategoryEmbed = (client, cat, cmds, pageIdx, totalPages, prefix, lang = "fr") => {
  const start = pageIdx * PER_PAGE_CMDS;
  const slice = cmds.slice(start, start + PER_PAGE_CMDS);
  const lines = slice
    .map((c) => {
      const desc = (c.description || "").replace(/\n/g, " ").slice(0, 70);
      return `- \`${prefix}${c.name}\` — ${desc || "—"}`;
    })
    .join("\n");

  return new EmbedBuilder()
    .setColor(client.embedBuilder.getTheme(client))
    .setAuthor({
      name: `[DEV] ${labelFor(cat, lang)} · ${cmds.length}`,
      iconURL: client.user.displayAvatarURL({ size: 256 }),
    })
    .setDescription(lines || "—")
    .setFooter({ text: t(lang, "commands.helptest.cat_footer", { page: pageIdx + 1, total: totalPages }) })
    .setTimestamp();
};

const buildCategorySelect = (categorized, selected = null, lang = "fr") => {
  const cats = Array.from(categorized.keys()).sort((a, b) =>
    labelFor(a, lang).localeCompare(labelFor(b, lang)),
  );
  return new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId("helptest_cat_select")
      .setPlaceholder(t(lang, "commands.helptest.select_placeholder"))
      .addOptions(
        cats.slice(0, 25).map((cat) => ({
          label: labelFor(cat, lang),
          value: cat,
          default: selected === cat,
        })),
      ),
  );
};

const buildActions = (pageIdx, totalPages, disabled = false, lang = "fr") =>
  new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("helptest_prev")
      .setLabel(t(lang, "commands.helptest.btn_prev"))
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(disabled || pageIdx === 0),
    new ButtonBuilder()
      .setCustomId("helptest_page")
      .setLabel(t(lang, "commands.helptest.btn_page", { page: pageIdx + 1, total: totalPages }))
      .setStyle(ButtonStyle.Primary)
      .setDisabled(true),
    new ButtonBuilder()
      .setCustomId("helptest_next")
      .setLabel(t(lang, "commands.helptest.btn_next"))
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(disabled || pageIdx >= totalPages - 1),
    new ButtonBuilder()
      .setCustomId("helptest_home")
      .setLabel(t(lang, "commands.helptest.btn_home"))
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(disabled),
  );

const buildCommandDetail = (client, command, prefix, lang = "fr") => {
  const usage = command.usage
    ? command.usage.replace(/\+/g, prefix)
    : `${prefix}${command.name}`;
  const example = exampleFor(command, prefix);
  const cat = command.category ? command.category.toLowerCase() : "utility";

  const embed = new EmbedBuilder()
    .setColor(client.embedBuilder.getTheme(client))
    .setAuthor({
      name: t(lang, "commands.helptest.cmd_author", { name: command.name }),
      iconURL: client.user.displayAvatarURL({ size: 256 }),
    })
    .setDescription(command.description || t(lang, "commands.helptest.no_description"))
    .addFields(
      { name: t(lang, "commands.helptest.field_category"), value: `\`${labelFor(cat, lang)}\``, inline: true },
      { name: t(lang, "commands.helptest.field_usage"), value: `\`${usage}\``, inline: true },
    )
    .setTimestamp();

  if (command.aliases && command.aliases.length > 0) {
    embed.addFields({
      name: t(lang, "commands.helptest.field_aliases"),
      value: command.aliases.map((a) => `\`${a}\``).join(", "),
      inline: true,
    });
  }
  if (example) {
    embed.addFields({ name: t(lang, "commands.helptest.field_example"), value: `\`${example}\``, inline: false });
  }
  if (command.userPerms && command.userPerms.length > 0) {
    const perms = client.embedBuilder?.formatPerms
      ? client.embedBuilder.formatPerms(command.userPerms, lang)
      : command.userPerms.map((p) => `\`${p}\``).join(", ");
    embed.addFields({ name: t(lang, "commands.helptest.field_permissions"), value: perms, inline: false });
  }
  return embed;
};

module.exports = {
  name: "helptest",
  aliases: ["allcmds"],
  description: "Affiche TOUTES les commandes du bot sans restriction.",
  category: "utility",
  usage: "+helptest [commande]",
  async execute(client, message, args) {
    if (!permissions.isBotOwner(client, message.author.id)) {
      return message
        .reply({
          embeds: [
            client.embedBuilder.error(client, message.t("commands.helptest.dev_only")),
          ],
        })
        .catch(() => {});
    }

    const guildSettings = client.db.getGuild(message.guild.id);
    const prefix = guildSettings.prefix || client.config.prefix;
    const lang = message.lang;

    const categorized = new Map();
    let total = 0;
    client.commands.forEach((cmd) => {
      const cat = cmd.category ? cmd.category.toLowerCase() : "utility";
      if (!categorized.has(cat)) categorized.set(cat, []);
      categorized.get(cat).push(cmd);
      total++;
    });
    for (const [k, v] of categorized) categorized.set(k, sortCmds(v));

    if (args[0]) {
      const query = args[0].toLowerCase();
      if (categorized.has(query)) {
        const cmds = categorized.get(query);
        const totalPages = Math.max(1, Math.ceil(cmds.length / PER_PAGE_CMDS));
        const pageIdx = 0;
        const sent = await message
          .reply({
            embeds: [
              buildCategoryEmbed(client, query, cmds, pageIdx, totalPages, prefix, lang),
            ],
            components: [
              buildCategorySelect(categorized, query, lang),
              buildActions(pageIdx, totalPages, false, lang),
            ],
          })
          .catch(() => {});
        if (!sent) return;
        return attachCollector(client, message, sent, categorized, total, prefix, {
          view: "category",
          cat: query,
          pageIdx,
        }, lang);
      }

      const command =
        client.commands.get(query) ||
        client.commands.get(client.aliases.get(query));
      if (!command) {
        return message
          .reply({
            embeds: [
              client.embedBuilder.warning(
                client,
                message.t("commands.helptest.cmd_not_found", { name: args[0] }),
              ),
            ],
            flags: [MessageFlags.Ephemeral],
          })
          .catch(() => {});
      }
      return message
        .reply({ embeds: [buildCommandDetail(client, command, prefix, lang)] })
        .catch(() => {});
    }

    const sent = await message
      .reply({
        embeds: [buildHero(client, categorized, total, prefix, lang)],
        components: [buildCategorySelect(categorized, null, lang)],
      })
      .catch(() => {});
    if (!sent) return;
    return attachCollector(client, message, sent, categorized, total, prefix, {
      view: "hero",
      cat: null,
      pageIdx: 0,
    }, lang);
  },
};

function attachCollector(client, message, sent, categorized, total, prefix, state, lang = "fr") {
  const collector = sent.createMessageComponentCollector({
    filter: (i) => i.user.id === message.author.id,
    time: COLLECTOR_MS,
  });

  collector.on("collect", async (interaction) => {
    try {
      if (interaction.customId === "helptest_cat_select") {
        const cat = interaction.values[0];
        const cmds = categorized.get(cat) || [];
        const totalPages = Math.max(1, Math.ceil(cmds.length / PER_PAGE_CMDS));
        state.view = "category";
        state.cat = cat;
        state.pageIdx = 0;
        return interaction
          .update({
            embeds: [
              buildCategoryEmbed(client, cat, cmds, state.pageIdx, totalPages, prefix, lang),
            ],
            components: [
              buildCategorySelect(categorized, cat, lang),
              buildActions(state.pageIdx, totalPages, false, lang),
            ],
          })
          .catch(() => {});
      }

      if (interaction.customId === "helptest_home") {
        state.view = "hero";
        state.cat = null;
        state.pageIdx = 0;
        return interaction
          .update({
            embeds: [buildHero(client, categorized, total, prefix, lang)],
            components: [buildCategorySelect(categorized, null, lang)],
          })
          .catch(() => {});
      }

      if (
        interaction.customId === "helptest_prev" ||
        interaction.customId === "helptest_next"
      ) {
        if (state.view !== "category")
          return interaction.deferUpdate().catch(() => {});
        const cmds = categorized.get(state.cat) || [];
        const totalPages = Math.max(1, Math.ceil(cmds.length / PER_PAGE_CMDS));
        if (interaction.customId === "helptest_prev" && state.pageIdx > 0)
          state.pageIdx--;
        else if (
          interaction.customId === "helptest_next" &&
          state.pageIdx < totalPages - 1
        )
          state.pageIdx++;
        return interaction
          .update({
            embeds: [
              buildCategoryEmbed(client, state.cat, cmds, state.pageIdx, totalPages, prefix, lang),
            ],
            components: [
              buildCategorySelect(categorized, state.cat, lang),
              buildActions(state.pageIdx, totalPages, false, lang),
            ],
          })
          .catch(() => {});
      }
    } catch (e) {
      try {
        await interaction.deferUpdate();
      } catch (_) {}
    }
  });

  collector.on("end", () => {
    sent
      .edit({
        components:
          state.view === "category"
            ? [
                buildCategorySelect(categorized, state.cat, lang),
                buildActions(
                  state.pageIdx,
                  Math.max(
                    1,
                    Math.ceil(
                      (categorized.get(state.cat) || []).length / PER_PAGE_CMDS,
                    ),
                  ),
                  true,
                  lang,
                ),
              ]
            : [buildCategorySelect(categorized, null, lang)],
      })
      .catch(() => {});
  });
}
