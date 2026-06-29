const {
  PermissionsBitField,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  MessageFlags,
} = require("discord.js");

const PAGE_SIZE = 20; // 4 rows of 5 toggle buttons (5th row = nav)

module.exports = {
  name: "roleperm",
  aliases: ["rp", "rolepermission"],
  description:
    "Configure les commandes autorisées pour un rôle via un menu interactif.",
  category: "config",
  usage: "+roleperm @role",
  userPerms: [PermissionsBitField.Flags.Administrator],
  async execute(client, message, args) {
    const role =
      message.mentions.roles.first() || message.guild.roles.cache.get(args[0]);
    if (!role)
      return message
        .reply({
          embeds: [client.embedBuilder.error(client, message.t("commands.roleperm.role_not_found"))],
        })
        .catch(() => {});

    const getAllowed = () =>
      client.db.db
        .prepare(
          "SELECT commandName FROM role_permissions WHERE guildId = ? AND roleId = ?",
        )
        .all(message.guild.id, role.id)
        .map((r) => r.commandName);

    const categories = [
      ...new Set(client.commands.map((c) => c.category).filter((c) => c)),
    ].sort();

    const buildCatOptions = () => {
      const allowed = getAllowed();
      return categories.map((cat) => {
        const cmds = client.commands.filter((c) => c.category === cat);
        const allowedCount = cmds.filter((c) => allowed.includes(c.name)).size;
        return {
          label: cat.charAt(0).toUpperCase() + cat.slice(1),
          value: cat,
          description: message.t("commands.roleperm.cat_allowed_count", { allowed: allowedCount, total: cmds.size }),
        };
      });
    };

    const buildCatGrid = (allowed) => {
      // 2-col grid of categories with autorisé/total
      const rows = categories.map((cat) => {
        const cmds = client.commands.filter((c) => c.category === cat);
        const a = cmds.filter((c) => allowed.includes(c.name)).size;
        const label = cat.charAt(0).toUpperCase() + cat.slice(1);
        return { name: label, value: `\`${a}/${cmds.size}\``, inline: true };
      });
      return rows;
    };

    const buildRootView = () => {
      const allowed = getAllowed();
      const embed = client.embedBuilder
        .base(client, message.t("commands.roleperm.root_title", { role: role.name }), null)
        .addFields(
          {
            name: message.t("commands.roleperm.field_role"),
            value: `<@&${role.id}>`,
            inline: true,
          },
          {
            name: message.t("commands.roleperm.field_allowed"),
            value: `**${allowed.length}**`,
            inline: true,
          },
          {
            name: message.t("commands.roleperm.field_categories"),
            value: `${categories.length}`,
            inline: true,
          },
          ...buildCatGrid(allowed),
        )
        .setFooter({ text: message.t("commands.roleperm.footer_role_id", { id: role.id }) });

      const catMenu = new StringSelectMenuBuilder()
        .setCustomId("roleperm_cat")
        .setPlaceholder(message.t("commands.roleperm.choose_category"))
        .addOptions(buildCatOptions());
      return {
        embeds: [embed],
        components: [new ActionRowBuilder().addComponents(catMenu)],
      };
    };

    const buildCategoryView = (cat, page = 0) => {
      const cmds = [
        ...client.commands.filter((c) => c.category === cat).values(),
      ];
      const allowed = getAllowed();
      const totalPages = Math.max(1, Math.ceil(cmds.length / PAGE_SIZE));
      const safePage = Math.min(Math.max(0, page), totalPages - 1);
      const slice = cmds.slice(
        safePage * PAGE_SIZE,
        safePage * PAGE_SIZE + PAGE_SIZE,
      );

      // Toggle buttons: arrange into rows of 5
      const toggleRows = [];
      for (let i = 0; i < slice.length; i += 5) {
        const row = new ActionRowBuilder();
        for (const cmd of slice.slice(i, i + 5)) {
          const on = allowed.includes(cmd.name);
          row.addComponents(
            new ButtonBuilder()
              .setCustomId(`roleperm_tog_${cat}_${safePage}_${cmd.name}`)
              .setLabel(cmd.name)
              .setStyle(on ? ButtonStyle.Success : ButtonStyle.Secondary),
          );
        }
        toggleRows.push(row);
      }

      // Nav row
      const navRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`roleperm_back`)
          .setLabel(message.t("commands.roleperm.btn_back"))
          .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId(`roleperm_prev_${cat}_${safePage}`)
          .setLabel(message.t("commands.roleperm.btn_prev"))
          .setStyle(ButtonStyle.Primary)
          .setDisabled(safePage === 0),
        new ButtonBuilder()
          .setCustomId(`roleperm_page`)
          .setLabel(`${safePage + 1}/${totalPages}`)
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(true),
        new ButtonBuilder()
          .setCustomId(`roleperm_next_${cat}_${safePage}`)
          .setLabel(message.t("commands.roleperm.btn_next"))
          .setStyle(ButtonStyle.Primary)
          .setDisabled(safePage >= totalPages - 1),
      );

      // 2-col grid of perms with on/off
      const grid = slice.map((c) => ({
        name: c.name,
        value: allowed.includes(c.name) ? "`on`" : "`off`",
        inline: true,
      }));

      const allowedInCat = cmds.filter((c) => allowed.includes(c.name)).length;
      const catEmbed = client.embedBuilder
        .base(client, message.t("commands.roleperm.cat_title", { role: role.name, cat }), null)
        .addFields(
          {
            name: message.t("commands.roleperm.field_role"),
            value: `<@&${role.id}>`,
            inline: true,
          },
          {
            name: message.t("commands.roleperm.field_allowed"),
            value: `**${allowedInCat}**/${cmds.length}`,
            inline: true,
          },
          {
            name: message.t("commands.roleperm.field_page"),
            value: `${safePage + 1}/${totalPages}`,
            inline: true,
          },
          ...grid,
        )
        .setFooter({ text: message.t("commands.roleperm.footer_toggle") });

      return {
        embeds: [catEmbed],
        components: [...toggleRows, navRow],
      };
    };

    const rootView = buildRootView();
    const msg = await message.reply(rootView).catch(() => {});
    if (!msg) return;

    const collector = msg.createMessageComponentCollector({ time: 120000 });

    collector.on("collect", async (i) => {
      if (i.user.id !== message.author.id) {
        return i
          .reply({
            content: message.t("commands.roleperm.not_your_menu"),
            flags: [MessageFlags.Ephemeral],
          })
          .catch(() => {});
      }

      if (i.customId === "roleperm_cat") {
        const selectedCat = i.values[0];
        await i.update(buildCategoryView(selectedCat, 0)).catch(() => {});
        collector.resetTimer();
        return;
      }

      if (i.customId === "roleperm_back") {
        await i.update(buildRootView()).catch(() => {});
        collector.resetTimer();
        return;
      }

      if (
        i.customId.startsWith("roleperm_prev_") ||
        i.customId.startsWith("roleperm_next_")
      ) {
        const parts = i.customId.split("_");
        const cat = parts[2];
        const page = parseInt(parts[3], 10);
        const next = i.customId.startsWith("roleperm_next_")
          ? page + 1
          : page - 1;
        await i.update(buildCategoryView(cat, next)).catch(() => {});
        collector.resetTimer();
        return;
      }

      if (i.customId.startsWith("roleperm_tog_")) {
        const parts = i.customId.split("_");
        const cat = parts[2];
        const page = parseInt(parts[3], 10);
        const cmd = parts.slice(4).join("_");

        const allowed = getAllowed();
        if (allowed.includes(cmd)) {
          client.db.db
            .prepare(
              "DELETE FROM role_permissions WHERE guildId = ? AND roleId = ? AND commandName = ?",
            )
            .run(message.guild.id, role.id, cmd);
        } else {
          client.db.db
            .prepare(
              "INSERT OR IGNORE INTO role_permissions (guildId, roleId, commandName) VALUES (?, ?, ?)",
            )
            .run(message.guild.id, role.id, cmd);
        }

        await i.update(buildCategoryView(cat, page)).catch(() => {});
        collector.resetTimer();
      }
    });

    collector.on("end", () => {
      msg.edit({ components: [] }).catch(() => {});
    });
  },
};
