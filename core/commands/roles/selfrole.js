const {
  PermissionsBitField,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
} = require("discord.js");
const permissions = require("../../utils/permissions");

const PER_PAGE = 6;
// Whitelist + length cap for user-supplied category. Keeps it embed-safe
// (Discord field name 256 char hard-limit) and avoids accidental formatting
// breakage from backticks / special chars rendered inside `code` blocks.
const CATEGORY_REGEX = /^[a-z0-9_-]{2,24}$/;
const LABEL_MAX = 80;

function resolveRole(message, token) {
  if (!token && !message.mentions.roles.size) return null;
  const fromMention = message.mentions.roles.first();
  if (fromMention) return fromMention;
  if (!token) return null;
  const id = token.replace(/[<@&>]/g, "");
  return message.guild.roles.cache.get(id) || null;
}

function groupByCategory(rows) {
  const map = new Map();
  for (const row of rows) {
    const key = row.category || "divers";
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(row);
  }
  return [...map.entries()].map(([name, items]) => ({ name, items }));
}

function buildListEmbed(client, message, categories, page, totalPages) {
  const slice = categories.slice(page * PER_PAGE, (page + 1) * PER_PAGE);
  const totalRoles = categories.reduce((a, c) => a + c.items.length, 0);
  const embed = client.embedBuilder
    .premium(
      client,
      message.t("commands.selfrole.list_title"),
      message.t("commands.selfrole.list_description", { total: totalRoles, categories: categories.length }),
    )
    .addFields(
      slice.map((cat) => {
        const lines = cat.items
          .map((r) => {
            const role = message.guild.roles.cache.get(r.roleId);
            const prefix = r.emoji ? `${r.emoji} ` : "";
            const display = role ? `${role}` : message.t("commands.selfrole.deleted_role");
            return `${prefix}${display} — \`${r.label}\``;
          })
          .join("\n")
          .slice(0, 1024);
        const title =
          cat.name.charAt(0).toUpperCase() + cat.name.slice(1);
        return {
          name: `${title} · ${cat.items.length}`,
          value: lines || message.t("commands.selfrole.empty"),
          inline: false,
        };
      }),
    );
  if (totalPages > 1)
    embed.setFooter({ text: `Page ${page + 1}/${totalPages}` });
  return embed;
}

function buildRow(message, page, totalPages, userId, disabled = false) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`selfrole_prev_${userId}`)
      .setLabel(message.t("commands.selfrole.btn_previous"))
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(disabled || page === 0),
    new ButtonBuilder()
      .setCustomId(`selfrole_page_${userId}`)
      .setLabel(`Page ${page + 1}/${totalPages}`)
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(true),
    new ButtonBuilder()
      .setCustomId(`selfrole_next_${userId}`)
      .setLabel(message.t("commands.selfrole.btn_next"))
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(disabled || page >= totalPages - 1),
  );
}

function botHierarchyError(message, role) {
  if (message.guild.members.me.roles.highest.position <= role.position) {
    return message.t("commands.selfrole.role_higher_than_bot");
  }
  if (!role.editable) {
    return message.t("commands.selfrole.role_not_manageable");
  }
  return null;
}

async function handleAdd(client, message, args) {
  if (!permissions.isAdmin(message, client)) {
    return message
      .reply({
        embeds: [
          client.embedBuilder.error(client, message.t("commands.selfrole.admin_only")),
        ],
      })
      .catch(() => {});
  }

  const category = (args[1] || "").toLowerCase();
  if (!category) {
    return message
      .reply({
        embeds: [
          client.embedBuilder.error(
            client,
            message.t("commands.selfrole.category_required"),
          ),
        ],
      })
      .catch(() => {});
  }
  if (!CATEGORY_REGEX.test(category)) {
    return message
      .reply({
        embeds: [
          client.embedBuilder.error(
            client,
            message.t("commands.selfrole.category_invalid"),
          ),
        ],
      })
      .catch(() => {});
  }

  const role =
    message.mentions.roles.first() || resolveRole(message, args[2]);
  if (!role) {
    return message
      .reply({
        embeds: [client.embedBuilder.error(client, message.t("commands.selfrole.role_not_found"))],
      })
      .catch(() => {});
  }

  const mentionIdx = args.findIndex(
    (a) => a.includes(role.id) || a.startsWith("<@&"),
  );
  const labelStart = mentionIdx >= 0 ? mentionIdx + 1 : 3;
  const label = args.slice(labelStart).join(" ").trim();
  if (!label) {
    return message
      .reply({
        embeds: [
          client.embedBuilder.error(
            client,
            message.t("commands.selfrole.label_required"),
          ),
        ],
      })
      .catch(() => {});
  }

  if (role.managed || role.id === message.guild.id) {
    return message
      .reply({
        embeds: [
          client.embedBuilder.error(client, message.t("commands.selfrole.role_cannot_register")),
        ],
      })
      .catch(() => {});
  }

  const hierarchyErr = botHierarchyError(message, role);
  if (hierarchyErr) {
    return message
      .reply({
        embeds: [client.embedBuilder.error(client, hierarchyErr)],
      })
      .catch(() => {});
  }

  const existing = client.db.getSelfRole(message.guild.id, role.id);
  if (existing) {
    return message
      .reply({
        embeds: [
          client.embedBuilder.warning(client, message.t("commands.selfrole.already_registered")),
        ],
      })
      .catch(() => {});
  }

  try {
    const safeLabel = label.slice(0, LABEL_MAX);
    client.db.addSelfRole(
      message.guild.id,
      category,
      safeLabel,
      role.id,
      null,
      message.author.id,
    );
    const embed = client.embedBuilder
      .success(client, message.t("commands.selfrole.registered"))
      .addFields(
        { name: message.t("commands.selfrole.field_category"), value: `\`${category}\``, inline: true },
        { name: message.t("commands.selfrole.field_role"), value: `${role}`, inline: true },
        { name: message.t("commands.selfrole.field_label"), value: `\`${safeLabel}\``, inline: true },
        { name: message.t("commands.selfrole.field_author"), value: `${message.author}`, inline: true },
      );
    return message.reply({ embeds: [embed] }).catch(() => {});
  } catch (err) {
    return message
      .reply({
        embeds: [
          client.embedBuilder.error(client, message.t("commands.selfrole.register_failed")),
        ],
      })
      .catch(() => {});
  }
}

async function handleDel(client, message, args) {
  if (!permissions.isAdmin(message, client)) {
    return message
      .reply({
        embeds: [
          client.embedBuilder.error(client, message.t("commands.selfrole.admin_only")),
        ],
      })
      .catch(() => {});
  }

  const role =
    message.mentions.roles.first() || resolveRole(message, args[1]);
  if (!role) {
    return message
      .reply({
        embeds: [client.embedBuilder.error(client, message.t("commands.selfrole.role_not_found"))],
      })
      .catch(() => {});
  }

  const existing = client.db.getSelfRole(message.guild.id, role.id);
  if (!existing) {
    return message
      .reply({
        embeds: [
          client.embedBuilder.warning(client, message.t("commands.selfrole.not_registered")),
        ],
      })
      .catch(() => {});
  }

  client.db.removeSelfRole(message.guild.id, role.id);
  const embed = client.embedBuilder
    .success(client, message.t("commands.selfrole.unregistered"))
    .addFields(
      { name: message.t("commands.selfrole.field_role"), value: `${role}`, inline: true },
      { name: message.t("commands.selfrole.field_category"), value: `\`${existing.category}\``, inline: true },
      { name: message.t("commands.selfrole.field_author"), value: `${message.author}`, inline: true },
    );
  return message.reply({ embeds: [embed] }).catch(() => {});
}

async function handleList(client, message) {
  const rows = client.db.listSelfRoles(message.guild.id);
  if (!rows.length) {
    return message
      .reply({
        embeds: [
          client.embedBuilder.info(
            client,
            message.t("commands.selfrole.no_selfroles"),
          ),
        ],
      })
      .catch(() => {});
  }

  const categories = groupByCategory(rows);
  const totalPages = Math.max(1, Math.ceil(categories.length / PER_PAGE));
  let page = 0;

  const reply = await message
    .reply({
      embeds: [buildListEmbed(client, message, categories, page, totalPages)],
      components:
        totalPages > 1 ? [buildRow(message, page, totalPages, message.author.id)] : [],
    })
    .catch(() => null);

  if (!reply || totalPages <= 1) return;

  const collector = reply.createMessageComponentCollector({
    componentType: ComponentType.Button,
    time: 120_000,
  });

  collector.on("collect", async (i) => {
    if (i.user.id !== message.author.id) {
      return i
        .reply({
          embeds: [
            client.embedBuilder.error(client, message.t("commands.selfrole.author_only")),
          ],
          ephemeral: true,
        })
        .catch(() => {});
    }
    if (i.customId.startsWith("selfrole_prev_"))
      page = Math.max(0, page - 1);
    else if (i.customId.startsWith("selfrole_next_"))
      page = Math.min(totalPages - 1, page + 1);

    await i
      .update({
        embeds: [buildListEmbed(client, message, categories, page, totalPages)],
        components: [buildRow(message, page, totalPages, message.author.id)],
      })
      .catch(() => {});
  });

  collector.on("end", () => {
    reply
      .edit({
        components: [buildRow(message, page, totalPages, message.author.id, true)],
      })
      .catch(() => {});
  });
}

async function handleAssign(client, message, args, mode) {
  const role =
    message.mentions.roles.first() || resolveRole(message, args[1]);
  if (!role) {
    return message
      .reply({
        embeds: [client.embedBuilder.error(client, message.t("commands.selfrole.role_not_found"))],
      })
      .catch(() => {});
  }

  const entry = client.db.getSelfRole(message.guild.id, role.id);
  if (!entry) {
    return message
      .reply({
        embeds: [
          client.embedBuilder.error(
            client,
            message.t("commands.selfrole.not_self_assignable"),
          ),
        ],
      })
      .catch(() => {});
  }

  const hierarchyErr = botHierarchyError(message, role);
  if (hierarchyErr) {
    return message
      .reply({
        embeds: [client.embedBuilder.error(client, hierarchyErr)],
      })
      .catch(() => {});
  }

  const member = message.member;
  const has = member.roles.cache.has(role.id);

  if (mode === "get") {
    if (has) {
      return message
        .reply({
          embeds: [
            client.embedBuilder.warning(client, message.t("commands.selfrole.already_have_role")),
          ],
        })
        .catch(() => {});
    }
    try {
      await member.roles.add(role, `Auto-attribution par ${message.author.tag}`);
      const embed = client.embedBuilder
        .success(client, message.t("commands.selfrole.role_assigned"))
        .addFields(
          { name: message.t("commands.selfrole.field_role"), value: `${role}`, inline: true },
          { name: message.t("commands.selfrole.field_category"), value: `\`${entry.category}\``, inline: true },
          { name: message.t("commands.selfrole.field_member"), value: `${message.author}`, inline: true },
        );
      return message.reply({ embeds: [embed] }).catch(() => {});
    } catch (err) {
      return message
        .reply({
          embeds: [
            client.embedBuilder.error(
              client,
              message.t("commands.selfrole.assign_failed"),
            ),
          ],
        })
        .catch(() => {});
    }
  }

  // drop
  if (!has) {
    return message
      .reply({
        embeds: [client.embedBuilder.warning(client, message.t("commands.selfrole.dont_have_role"))],
      })
      .catch(() => {});
  }
  try {
    await member.roles.remove(
      role,
      `Auto-retrait par ${message.author.tag}`,
    );
    const embed = client.embedBuilder
      .success(client, message.t("commands.selfrole.role_removed"))
      .addFields(
        { name: message.t("commands.selfrole.field_role"), value: `${role}`, inline: true },
        { name: message.t("commands.selfrole.field_category"), value: `\`${entry.category}\``, inline: true },
        { name: message.t("commands.selfrole.field_member"), value: `${message.author}`, inline: true },
      );
    return message.reply({ embeds: [embed] }).catch(() => {});
  } catch (err) {
    return message
      .reply({
        embeds: [
          client.embedBuilder.error(
            client,
            message.t("commands.selfrole.remove_failed"),
          ),
        ],
      })
      .catch(() => {});
  }
}

module.exports = {
  name: "selfrole",
  aliases: ["sr"],
  description:
    "Gère les rôles auto-attribuables (add, del, list, get, give, drop).",
  category: "roles",
  usage:
    "+selfrole <add|del|list|get|give|drop> [catégorie] [@role] [label]",
  botPerms: [PermissionsBitField.Flags.ManageRoles],
  async execute(client, message, args) {
    const sub = (args[0] || "list").toLowerCase();

    switch (sub) {
      case "add":
        return handleAdd(client, message, args);
      case "del":
      case "delete":
      case "remove":
        return handleDel(client, message, args);
      case "list":
      case "ls":
        return handleList(client, message);
      case "get":
      case "give":
        return handleAssign(client, message, args, "get");
      case "drop":
      case "leave":
        return handleAssign(client, message, args, "drop");
      default:
        return message
          .reply({
            embeds: [
              client.embedBuilder.error(
                client,
                message.t("commands.selfrole.invalid_subcommand"),
              ),
            ],
          })
          .catch(() => {});
    }
  },
};
