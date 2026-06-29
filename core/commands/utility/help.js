const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  MessageFlags,
  ModalBuilder,
  PermissionsBitField,
  StringSelectMenuBuilder,
  TextInputBuilder,
  TextInputStyle,
} = require("discord.js");
const permissions = require("../../utils/permissions");

let HELP_EXAMPLES = {};
try {
  HELP_EXAMPLES = require("../../utils/help_examples.json");
} catch (e) {
  HELP_EXAMPLES = {};
}

// Les libellés/teasers de catégorie sont résolus via i18n (clés help.cat_label.* /
// help.cat_teaser.*). Cette liste sert uniquement de référence des catégories connues.
const KNOWN_CATEGORIES = [
  "antiraid",
  "backup",
  "birthdays",
  "config",
  "custom",
  "economy",
  "fun",
  "invitations",
  "levels",
  "logs",
  "moderation",
  "roles",
  "security",
  "social",
  "stats",
  "suggestions",
  "tickets",
  "utility",
  "voice",
];

const ULTRA_SENSITIVE = [
  "invite",
  "owner",
  "setstatus",
  "botstatus",
  "botactivity",
  "botnick",
  "setavatar",
  "setbanner",
  "helptest",
];

const PER_PAGE_CMDS = 8;
const COLLECTOR_MS = 120_000;

const levenshtein = (a, b) => {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  const prev = new Array(b.length + 1);
  for (let j = 0; j <= b.length; j++) prev[j] = j;
  for (let i = 1; i <= a.length; i++) {
    let cur = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      const next = Math.min(cur + 1, prev[j] + 1, prev[j - 1] + cost);
      prev[j - 1] = cur;
      cur = next;
    }
    prev[b.length] = cur;
  }
  return prev[b.length];
};

const closestCommand = (client, query) => {
  let best = null;
  let bestScore = Infinity;
  client.commands.forEach((cmd) => {
    const names = [cmd.name, ...(cmd.aliases || [])];
    for (const n of names) {
      const d = levenshtein(query, n.toLowerCase());
      if (d < bestScore) {
        bestScore = d;
        best = cmd.name;
      }
    }
  });
  return bestScore <= 3 ? best : null;
};

// Résout un libellé/teaser de catégorie via i18n, avec repli capitalisé si absent.
const labelFor = (cat, tt) => {
  const key = `help.cat_label.${cat}`;
  const v = tt(key);
  if (v !== key) return v;
  return cat.charAt(0).toUpperCase() + cat.slice(1);
};

const teaserFor = (cat, tt) => {
  const key = `help.cat_teaser.${cat}`;
  const v = tt(key);
  return v === key ? "" : v;
};

// Résout la description d'une commande via i18n (commands.<name>.description),
// avec repli sur la propriété description du module.
const descOf = (cmd, tt) => {
  const key = `commands.${cmd.name}.description`;
  const v = tt(key);
  return v === key ? cmd.description || null : v;
};

const sortCmds = (arr) =>
  arr.slice().sort((a, b) => a.name.localeCompare(b.name));

const exampleFor = (cmd, prefix) => {
  const raw = HELP_EXAMPLES[cmd.name];
  if (!raw) return null;
  const resolved = raw.replace(/\$\{prefix\}/g, prefix);
  const m = resolved.match(/`([^`]+)`/);
  return m ? m[1] : null;
};

// Résout l'usage localisé d'une commande via i18n (commands.<name>.usage),
// avec repli sur la propriété usage du module.
const usageOf = (cmd, tt) => {
  const key = `commands.${cmd.name}.usage`;
  const v = tt(key);
  return v === key ? cmd.usage || null : v;
};

const buildHeroEmbed = (client, categorized, totalCmds, prefix, guild, tt) => {
  const fmt = new Intl.NumberFormat("en-US");
  const cats = Array.from(categorized.keys()).sort((a, b) =>
    labelFor(a, tt).localeCompare(labelFor(b, tt)),
  );

  const lines = cats.map((c) => {
    const count = categorized.get(c).length;
    return `• **${labelFor(c, tt)}** — ${count}`;
  });

  const mid = Math.ceil(lines.length / 2);
  const colA = lines.slice(0, mid).join("\n");
  const colB = lines.slice(mid).join("\n");

  const embed = new EmbedBuilder()
    .setColor(client.embedBuilder.getTheme(client))
    .setAuthor({
      name: `${client.user.username} · ${tt("help.hub_title")}`,
      iconURL: client.user.displayAvatarURL({ size: 256 }),
    })
    .setDescription(
      [
        tt("help.hero_pick", { prefix }),
        tt("help.hero_counts", {
          cmds: fmt.format(totalCmds),
          cats: cats.length,
        }),
      ].join("\n"),
    )
    .addFields(
      { name: tt("help.field_categories"), value: colA || "—", inline: true },
      { name: "​", value: colB || "—", inline: true },
    )
    .setFooter({
      text: `${client.user.username} · ${tt("help.prefix_current", { prefix })}`,
    });

  if (guild) {
    const icon = guild.iconURL({ size: 256 });
    if (icon) embed.setThumbnail(icon);
  }
  return embed;
};

const buildCategoryEmbed = (
  client,
  cat,
  cmds,
  pageIdx,
  totalPages,
  prefix,
  tt,
) => {
  const start = pageIdx * PER_PAGE_CMDS;
  const slice = cmds.slice(start, start + PER_PAGE_CMDS);

  const items = slice.map((c) => {
    const rawUsage = usageOf(c, tt);
    const usage = rawUsage
      ? rawUsage.replace(/\+/g, prefix)
      : `${prefix}${c.name}`;
    const desc = (descOf(c, tt) || "—").replace(/\n/g, " ");
    // Backtick only the command name; leave args in plain text so long usages
    // don't break into multiple wrapped inline-code boxes on narrow clients.
    const m = usage.match(/^(\S+)(\s+.+)?$/);
    const head = m ? `\`${m[1]}\`` : `\`${usage}\``;
    const tail = m && m[2] ? m[2] : "";
    return `• ${head}${tail}\n↳ ${desc}`;
  });

  const intro = [
    `**${labelFor(cat, tt)}**`,
    `*${tt("help.params_hint1")}*`,
    `*${tt("help.params_hint2")}* \`,,\``,
  ].join("\n");

  return new EmbedBuilder()
    .setColor(client.embedBuilder.getTheme(client))
    .setAuthor({
      name: `${client.user.username} · ${labelFor(cat, tt)}`,
      iconURL: client.user.displayAvatarURL({ size: 256 }),
    })
    .setDescription(`${intro}\n\n${items.join("\n\n") || "—"}`)
    .setFooter({
      text: `${client.user.username} · ${tt("help.prefix_current_page", { prefix, page: pageIdx + 1, total: totalPages })}`,
    });
};

const buildCategorySelect = (categorized, selected = null, tt) => {
  const cats = Array.from(categorized.keys()).sort((a, b) =>
    labelFor(a, tt).localeCompare(labelFor(b, tt)),
  );
  const opts = cats.slice(0, 25).map((cat) => {
    const count = categorized.get(cat).length;
    const teaser = teaserFor(cat, tt).slice(0, 80);
    return {
      label: `${labelFor(cat, tt)} (${count})`,
      value: cat,
      description: teaser || undefined,
      default: selected === cat,
    };
  });
  return new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId("help_cat_select")
      .setPlaceholder(tt("help.select_placeholder"))
      .addOptions(opts),
  );
};

const buildHeroActions = (disabled = false, tt) =>
  new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("help_search")
      .setLabel(tt("help.btn_search"))
      .setStyle(ButtonStyle.Primary)
      .setDisabled(disabled),
    new ButtonBuilder()
      .setCustomId("help_close")
      .setLabel(tt("help.btn_close"))
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(disabled),
  );

const buildCategoryActions = (pageIdx, totalPages, disabled = false, tt) =>
  new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("help_prev")
      .setLabel("◀")
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(disabled || pageIdx === 0),
    new ButtonBuilder()
      .setCustomId("help_home")
      .setLabel(tt("help.btn_home"))
      .setStyle(ButtonStyle.Primary)
      .setDisabled(disabled),
    new ButtonBuilder()
      .setCustomId("help_search")
      .setLabel(tt("help.btn_search"))
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(disabled),
    new ButtonBuilder()
      .setCustomId("help_next")
      .setLabel("▶")
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(disabled || pageIdx >= totalPages - 1),
  );

const buildCommandDetail = (client, command, prefix, isDev = false, tt, lang) => {
  const rawUsage = usageOf(command, tt);
  const usage = rawUsage
    ? rawUsage.replace(/\+/g, prefix)
    : `${prefix}${command.name}`;
  const example = exampleFor(command, prefix);
  const cat = command.category ? command.category.toLowerCase() : "utility";

  const embed = new EmbedBuilder()
    .setColor(client.embedBuilder.getTheme(client))
    .setAuthor({
      name: `${isDev ? "[DEV] " : ""}${tt("help.command_label")} · ${command.name}`,
      iconURL: client.user.displayAvatarURL({ size: 256 }),
    })
    .setDescription(descOf(command, tt) || tt("help.no_description"))
    .addFields(
      {
        name: tt("help.field_category"),
        value: `\`${labelFor(cat, tt)}\``,
        inline: true,
      },
      {
        name: tt("help.field_usage"),
        value: `\`${usage}\``,
        inline: true,
      },
    )
    .setTimestamp();

  if (command.aliases && command.aliases.length > 0) {
    embed.addFields({
      name: tt("help.field_alias"),
      value: command.aliases.map((a) => `\`${a}\``).join(", "),
      inline: true,
    });
  }

  if (example) {
    embed.addFields({
      name: tt("help.field_example"),
      value: `\`${example}\``,
      inline: false,
    });
  }

  if (command.userPerms && command.userPerms.length > 0) {
    const perms = client.embedBuilder?.formatPerms
      ? client.embedBuilder.formatPerms(command.userPerms, lang)
      : command.userPerms.map((p) => `\`${p}\``).join(", ");
    embed.addFields({
      name: tt("help.field_perms"),
      value: perms,
      inline: false,
    });
  }

  if (command.botPerms && command.botPerms.length > 0) {
    const perms = client.embedBuilder?.formatPerms
      ? client.embedBuilder.formatPerms(command.botPerms, lang)
      : command.botPerms.map((p) => `\`${p}\``).join(", ");
    embed.addFields({
      name: tt("help.field_botperms"),
      value: perms,
      inline: false,
    });
  }

  return embed;
};

const buildSearchResults = (client, matches, query, prefix, tt) => {
  const lines = matches
    .slice(0, 20)
    .map((c) => {
      const desc = (descOf(c, tt) || "").replace(/\n/g, " ").slice(0, 60);
      return `- \`${prefix}${c.name}\` — ${desc || "—"}`;
    })
    .join("\n");

  return new EmbedBuilder()
    .setColor(client.embedBuilder.getTheme(client))
    .setAuthor({
      name: `${tt("help.search_label")} · ${matches.length}`,
      iconURL: client.user.displayAvatarURL({ size: 256 }),
    })
    .setDescription(
      matches.length
        ? lines + (matches.length > 20 ? "\n\n…" : "")
        : tt("help.search_none", { query }),
    )
    .setFooter({ text: tt("help.search_footer", { query }) })
    .setTimestamp();
};

const computeAccess = async (client, message, guildSettings) => {
  const isPrimaryOwner = permissions.isPrimaryOwner(message.author.id);
  const isSecondaryOwner = permissions.isBotOwner(client, message.author.id);
  const isWhitelisted = permissions.isWhitelisted(
    message.author.id,
    message.guild.id,
    client,
    guildSettings,
  );
  const isAdmin = message.member.permissions.has(
    PermissionsBitField.Flags.Administrator,
  );

  const userRolePerms = new Set();
  if (!isPrimaryOwner && !isSecondaryOwner && !isWhitelisted && !isAdmin) {
    try {
      const memberRoleIds = message.member.roles.cache.map((r) => r.id);
      if (memberRoleIds.length > 0) {
        const placeholders = memberRoleIds.map(() => "?").join(",");
        const allPerms = client.db.db
          .prepare(
            `SELECT DISTINCT commandName FROM role_permissions WHERE guildId = ? AND roleId IN (${placeholders})`,
          )
          .all(message.guild.id, ...memberRoleIds);
        allPerms.forEach((p) => userRolePerms.add(p.commandName));
      }
    } catch (e) {}
  }

  return (cmd) => {
    if (isPrimaryOwner) return true;
    if (!cmd.userPerms || cmd.userPerms.length === 0) return true;
    if (isSecondaryOwner || isWhitelisted || isAdmin)
      return !ULTRA_SENSITIVE.includes(cmd.name);
    return userRolePerms.has(cmd.name);
  };
};

module.exports = {
  name: "help",
  aliases: ["h", "aide", "commands", "cmds", "commandes"],
  description: "Affiche la liste complète des commandes.",
  category: "utility",
  usage: "+help [commande]",
  userPerms: [PermissionsBitField.Flags.Administrator],
  async execute(client, message, args) {
    const guildSettings = client.db.getGuild(message.guild.id);
    const prefix = guildSettings.prefix || client.config.prefix;
    const tt = message.t;
    const lang = message.lang;
    const hasAccess = await computeAccess(client, message, guildSettings);

    const categorized = new Map();
    let total = 0;
    client.commands.forEach((cmd) => {
      if (!hasAccess(cmd)) return;
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
              buildCategoryEmbed(
                client,
                query,
                cmds,
                pageIdx,
                totalPages,
                prefix,
                tt,
              ),
            ],
            components: [
              buildCategorySelect(categorized, query, tt),
              buildCategoryActions(pageIdx, totalPages, false, tt),
            ],
          })
          .catch(() => {});
        if (!sent) return;
        return attachCollector(
          client,
          message,
          sent,
          categorized,
          total,
          prefix,
          { view: "category", cat: query, pageIdx, hasAccess },
          tt,
          lang,
        );
      }

      const command =
        client.commands.get(query) ||
        client.commands.get(client.aliases.get(query));
      if (!command) {
        const suggestion = closestCommand(client, query);
        const msg = suggestion
          ? tt("help.cmd_not_found_suggest", {
              query: args[0],
              suggestion: `${prefix}${suggestion}`,
            })
          : tt("help.cmd_not_found", { query: args[0] });
        return message
          .reply({
            embeds: [client.embedBuilder.warning(client, msg)],
            flags: [MessageFlags.Ephemeral],
          })
          .catch(() => {});
      }
      if (!hasAccess(command)) {
        return message
          .reply({
            embeds: [
              client.embedBuilder.error(
                client,
                tt("help.cmd_no_access", { query: args[0] }),
              ),
            ],
            flags: [MessageFlags.Ephemeral],
          })
          .catch(() => {});
      }
      return message
        .reply({ embeds: [buildCommandDetail(client, command, prefix, false, tt, lang)] })
        .catch(() => {});
    }

    if (categorized.size === 0) {
      return message
        .reply({
          embeds: [
            client.embedBuilder.warning(client, tt("help.none_available")),
          ],
        })
        .catch(() => {});
    }

    const sent = await message
      .reply({
        embeds: [buildHeroEmbed(client, categorized, total, prefix, message.guild, tt)],
        components: [buildCategorySelect(categorized, null, tt), buildHeroActions(false, tt)],
      })
      .catch(() => {});
    if (!sent) return;

    return attachCollector(
      client,
      message,
      sent,
      categorized,
      total,
      prefix,
      { view: "hero", cat: null, pageIdx: 0, hasAccess },
      tt,
      lang,
    );
  },
};

function attachCollector(client, message, sent, categorized, total, prefix, state, tt, lang) {
  const collector = sent.createMessageComponentCollector({
    filter: (i) => i.user.id === message.author.id,
    time: COLLECTOR_MS,
  });

  collector.on("collect", async (interaction) => {
    try {
      if (interaction.customId === "help_cat_select") {
        const cat = interaction.values[0];
        const cmds = categorized.get(cat) || [];
        const totalPages = Math.max(
          1,
          Math.ceil(cmds.length / PER_PAGE_CMDS),
        );
        state.view = "category";
        state.cat = cat;
        state.pageIdx = 0;
        return interaction
          .update({
            embeds: [
              buildCategoryEmbed(
                client,
                cat,
                cmds,
                state.pageIdx,
                totalPages,
                prefix,
                tt,
              ),
            ],
            components: [
              buildCategorySelect(categorized, cat, tt),
              buildCategoryActions(state.pageIdx, totalPages, false, tt),
            ],
          })
          .catch(() => {});
      }

      if (interaction.customId === "help_close") {
        collector.stop("closed");
        return interaction
          .update({
            components: [],
          })
          .then(() => sent.delete().catch(() => {}))
          .catch(() => {});
      }

      if (interaction.customId === "help_home") {
        state.view = "hero";
        state.cat = null;
        state.pageIdx = 0;
        return interaction
          .update({
            embeds: [buildHeroEmbed(client, categorized, total, prefix, message.guild, tt)],
            components: [
              buildCategorySelect(categorized, null, tt),
              buildHeroActions(false, tt),
            ],
          })
          .catch(() => {});
      }

      if (
        interaction.customId === "help_prev" ||
        interaction.customId === "help_next"
      ) {
        if (state.view !== "category") return interaction.deferUpdate().catch(() => {});
        const cmds = categorized.get(state.cat) || [];
        const totalPages = Math.max(
          1,
          Math.ceil(cmds.length / PER_PAGE_CMDS),
        );
        if (interaction.customId === "help_prev" && state.pageIdx > 0)
          state.pageIdx--;
        else if (
          interaction.customId === "help_next" &&
          state.pageIdx < totalPages - 1
        )
          state.pageIdx++;
        return interaction
          .update({
            embeds: [
              buildCategoryEmbed(
                client,
                state.cat,
                cmds,
                state.pageIdx,
                totalPages,
                prefix,
                tt,
              ),
            ],
            components: [
              buildCategorySelect(categorized, state.cat, tt),
              buildCategoryActions(state.pageIdx, totalPages, false, tt),
            ],
          })
          .catch(() => {});
      }

      if (interaction.customId === "help_search") {
        const modalId = `help_search_modal_${interaction.id}`;
        const modal = new ModalBuilder()
          .setCustomId(modalId)
          .setTitle(tt("help.search_modal_title"))
          .addComponents(
            new ActionRowBuilder().addComponents(
              new TextInputBuilder()
                .setCustomId("help_query")
                .setLabel(tt("help.search_input_label"))
                .setPlaceholder(tt("help.search_input_placeholder"))
                .setStyle(TextInputStyle.Short)
                .setMinLength(1)
                .setMaxLength(40)
                .setRequired(true),
            ),
          );

        await interaction.showModal(modal).catch(() => {});
        const submitted = await interaction
          .awaitModalSubmit({
            filter: (i) =>
              i.customId === modalId && i.user.id === message.author.id,
            time: 60_000,
          })
          .catch(() => null);
        if (!submitted) return;

        const q = submitted.fields.getTextInputValue("help_query").trim().toLowerCase();
        const matches = [];
        client.commands.forEach((c) => {
          if (!state.hasAccess(c)) return;
          const hay = [
            c.name,
            ...(c.aliases || []),
            c.description || "",
            c.category || "",
          ]
            .join(" ")
            .toLowerCase();
          if (hay.includes(q)) matches.push(c);
        });
        matches.sort((a, b) => a.name.localeCompare(b.name));

        return submitted
          .reply({
            embeds: [buildSearchResults(client, matches, q, prefix, tt)],
            flags: [MessageFlags.Ephemeral],
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
        components: state.view === "category"
          ? [
              buildCategorySelect(categorized, state.cat, tt),
              buildCategoryActions(
                state.pageIdx,
                Math.max(
                  1,
                  Math.ceil(
                    (categorized.get(state.cat) || []).length / PER_PAGE_CMDS,
                  ),
                ),
                true,
                tt,
              ),
            ]
          : [buildCategorySelect(categorized, null, tt), buildHeroActions(true, tt)],
      })
      .catch(() => {});
  });
}
