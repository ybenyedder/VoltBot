const {
  PermissionFlagsBits,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require("discord.js");

module.exports = {
  name: "ndd",
  description: "Configure la protection contre les noms de domaine",
  category: "antiraid",
  usage: "ndd",
  userPerms: [PermissionFlagsBits.Administrator],
  botPerms: [PermissionFlagsBits.ManageMessages],
  async execute(client, message, args) {
    const guildSettings = client.db.getGuild(message.guild.id);
    const ndd = guildSettings.ndd || { enabled: false, whitelist: [] };
    const p = client.config.prefix;

    if (!args[0]) {
      const embed = client.embedBuilder
        .base(client, "NDD")
        .setDescription(null)
        .addFields(
          {
            name: message.t("commands.ndd.field_status"),
            value: ndd.enabled
              ? message.t("commands.ndd.enabled")
              : message.t("commands.ndd.disabled"),
            inline: true,
          },
          {
            name: message.t("commands.ndd.field_whitelist"),
            value: `\`${ndd.whitelist.length}\``,
            inline: true,
          },
          {
            name: message.t("commands.ndd.field_description"),
            value: message.t("commands.ndd.description_value"),
            inline: false,
          },
          {
            name: message.t("commands.ndd.field_commands"),
            value: `\`${p}ndd enable\` \`${p}ndd disable\` \`${p}ndd add <domaine>\` \`${p}ndd remove <domaine>\` \`${p}ndd list\``,
            inline: false,
          },
        );
      return message.reply({ embeds: [embed] }).catch(() => {});
    }

    if (args[0] === "enable") {
      if (ndd.enabled)
        return message
          .reply({
            embeds: [
              client.embedBuilder.warning(
                client,
                message.t("commands.ndd.module_already_enabled"),
              ),
            ],
          })
          .catch(() => {});
      client.db.updateGuild(message.guild.id, {
        ndd: { ...ndd, enabled: true },
      });
      return message
        .reply({
          embeds: [
            client.embedBuilder.success(
              client,
              message.t("commands.ndd.ndd_enabled"),
            ),
          ],
        })
        .catch(() => {});
    }

    if (args[0] === "disable") {
      if (!ndd.enabled)
        return message
          .reply({
            embeds: [
              client.embedBuilder.warning(
                client,
                message.t("commands.ndd.module_already_disabled"),
              ),
            ],
          })
          .catch(() => {});
      client.db.updateGuild(message.guild.id, {
        ndd: { ...ndd, enabled: false },
      });
      return message
        .reply({
          embeds: [
            client.embedBuilder.warning(
              client,
              message.t("commands.ndd.ndd_disabled"),
            ),
          ],
        })
        .catch(() => {});
    }

    if (args[0] === "add" && args[1]) {
      const domain = args[1].toLowerCase();
      if (!ndd.whitelist.includes(domain)) {
        ndd.whitelist.push(domain);
        client.db.updateGuild(message.guild.id, { ndd });
        return message
          .reply({
            embeds: [
              client.embedBuilder.success(
                client,
                message.t("commands.ndd.domain_added", { domain }),
              ),
            ],
          })
          .catch(() => {});
      }
      return message
        .reply({
          embeds: [
            client.embedBuilder.warning(
              client,
              message.t("commands.ndd.domain_already_whitelisted"),
            ),
          ],
        })
        .catch(() => {});
    }

    if (args[0] === "remove" && args[1]) {
      const domain = args[1].toLowerCase();
      const index = ndd.whitelist.indexOf(domain);
      if (index > -1) {
        ndd.whitelist.splice(index, 1);
        client.db.updateGuild(message.guild.id, { ndd });
        return message
          .reply({
            embeds: [
              client.embedBuilder.success(
                client,
                message.t("commands.ndd.domain_removed", { domain }),
              ),
            ],
          })
          .catch(() => {});
      }
      return message
        .reply({
          embeds: [
            client.embedBuilder.error(
              client,
              message.t("commands.ndd.domain_not_whitelisted"),
            ),
          ],
        })
        .catch(() => {});
    }

    if (args[0] === "list") {
      const whitelist = ndd.whitelist;
      const perPage = 10;
      const pages = Math.max(1, Math.ceil(whitelist.length / perPage));
      let page = 0;

      const buildEmbed = (p2) => {
        const slice = whitelist.slice(p2 * perPage, (p2 + 1) * perPage);
        const embed = client.embedBuilder
          .base(client, message.t("commands.ndd.list_title"))
          .setDescription(null)
          .addFields({
            name: message.t("commands.ndd.field_total"),
            value: `\`${whitelist.length}\``,
            inline: true,
          });
        if (slice.length) {
          embed.addFields(
            slice.map((d, i) => ({
              name: `#${p2 * perPage + i + 1}`,
              value: `\`${d}\``,
              inline: true,
            })),
          );
        } else {
          embed.addFields({
            name: message.t("commands.ndd.field_list"),
            value: message.t("commands.ndd.list_empty"),
            inline: false,
          });
        }
        return embed;
      };

      const buildRow = (p2, disabled = false) =>
        new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId("ndd_prev")
            .setLabel(message.t("commands.ndd.btn_prev"))
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(disabled || p2 === 0),
          new ButtonBuilder()
            .setCustomId("ndd_page")
            .setLabel(
              message.t("commands.ndd.btn_page", {
                current: p2 + 1,
                total: pages,
              }),
            )
            .setStyle(ButtonStyle.Primary)
            .setDisabled(true),
          new ButtonBuilder()
            .setCustomId("ndd_next")
            .setLabel(message.t("commands.ndd.btn_next"))
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(disabled || p2 >= pages - 1),
        );

      const payload =
        pages > 1
          ? { embeds: [buildEmbed(page)], components: [buildRow(page)] }
          : { embeds: [buildEmbed(page)] };
      const msg = await message.reply(payload).catch(() => null);
      if (!msg || pages <= 1) return;

      const collector = msg.createMessageComponentCollector({
        filter: (i) => i.user.id === message.author.id,
        time: 120000,
      });
      collector.on("collect", async (i) => {
        if (i.customId === "ndd_prev") page = Math.max(0, page - 1);
        if (i.customId === "ndd_next") page = Math.min(pages - 1, page + 1);
        await i
          .update({ embeds: [buildEmbed(page)], components: [buildRow(page)] })
          .catch(() => {});
      });
      collector.on("end", () => {
        msg.edit({ components: [buildRow(page, true)] }).catch(() => {});
      });
      return;
    }

    message
      .reply({
        embeds: [
          client.embedBuilder.error(
            client,
            message.t("commands.ndd.usage", { p }),
          ),
        ],
      })
      .catch(() => {});
  },
};
