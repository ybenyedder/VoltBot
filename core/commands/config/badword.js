const {
  PermissionsBitField,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  MessageFlags,
} = require("discord.js");
const { findBadword, normalizeText } = require("../../utils/badwords");

const PAGE_SIZE = 20;

const invalidateBadwordConfig = (client, guildId) => {
  if (client.invalidateGuildConfig) client.invalidateGuildConfig(guildId);
};

const fmtNumber = (n) => new Intl.NumberFormat("fr-FR").format(n);

module.exports = {
  name: "badword",
  aliases: ["bw", "motinterdit", "antibadword"],
  description:
    "Gère la liste des mots interdits (ajouter / supprimer / lister / activer / désactiver).",
  category: "config",
  usage:
    "+badword add <mot> | +badword remove <mot> | +badword list | +badword on | +badword off",
  userPerms: [PermissionsBitField.Flags.Administrator],
  async execute(client, message, args) {
    const sub = args[0]?.toLowerCase();
    const word = args.slice(1).join("").toLowerCase().trim();

    if (!sub) {
      const embed = client.embedBuilder
        .base(client, message.t("commands.badword.intro_title"), null)
        .addFields(
          {
            name: message.t("commands.badword.field_state"),
            value: "`on` / `off`",
            inline: false,
          },
          {
            name: message.t("commands.badword.field_list"),
            value: "`add <mot>` · `remove <mot>` · `list` · `clear`",
            inline: false,
          },
          {
            name: message.t("commands.badword.field_sanction"),
            value: "`punish <delete|warn|mute|kick|ban|strip|none>`",
            inline: false,
          },
        );
      return message.reply({ embeds: [embed] }).catch(() => {});
    }

    if (sub === "on" || sub === "enable") {
      client.db.updateGuild(message.guild.id, { antiBadWords: 1 });
      client.db.updateAntiraidConfig(message.guild.id, { antiBadWords: 1 });
      invalidateBadwordConfig(client, message.guild.id);
      return message
        .reply({
          embeds: [
            client.embedBuilder
              .success(client, message.t("commands.badword.filter_enabled"))
              .addFields({ name: message.t("commands.badword.field_state"), value: "**on**", inline: true }),
          ],
        })
        .catch(() => {});
    }

    if (sub === "off" || sub === "disable") {
      client.db.updateGuild(message.guild.id, { antiBadWords: 0 });
      client.db.updateAntiraidConfig(message.guild.id, { antiBadWords: 0 });
      invalidateBadwordConfig(client, message.guild.id);
      return message
        .reply({
          embeds: [
            client.embedBuilder
              .success(client, message.t("commands.badword.filter_disabled"))
              .addFields({ name: message.t("commands.badword.field_state"), value: "**off**", inline: true }),
          ],
        })
        .catch(() => {});
    }

    if (sub === "punish" || sub === "sanction") {
      const sanction = args[1]?.toLowerCase();
      const validSanctions = [
        "delete",
        "warn",
        "mute",
        "kick",
        "ban",
        "strip",
        "none",
      ];
      if (!sanction || !validSanctions.includes(sanction)) {
        return message
          .reply({
            embeds: [
              client.embedBuilder.error(
                client,
                message.t("commands.badword.invalid_sanction", { choices: validSanctions.join(", ") }),
              ),
            ],
          })
          .catch(() => {});
      }

      const current = client.db.getAntiraidConfig(message.guild.id) || {};
      const oldSanction = current.antiBadWordsPunishment || "none";
      client.db.updateAntiraidConfig(message.guild.id, {
        antiBadWordsPunishment: sanction,
      });
      return message
        .reply({
          embeds: [
            client.embedBuilder
              .success(client, message.t("commands.badword.sanction_updated"))
              .addFields(
                {
                  name: message.t("commands.badword.field_before"),
                  value: `\`${oldSanction}\``,
                  inline: true,
                },
                {
                  name: message.t("commands.badword.field_after"),
                  value: `\`${sanction}\``,
                  inline: true,
                },
              ),
          ],
        })
        .catch(() => {});
    }

    if (sub === "add") {
      if (!word) {
        return message
          .reply({
            embeds: [
              client.embedBuilder.error(
                client,
                message.t("commands.badword.specify_word_add"),
              ),
            ],
          })
          .catch(() => {});
      }

      const normalizedWord = normalizeText(word).trim();
      const existingWords = client.db.getBadwords(message.guild.id);
      const exists = existingWords.some(
        (row) => normalizeText(row.word).trim() === normalizedWord,
      );
      if (exists) {
        return message
          .reply({
            embeds: [
              client.embedBuilder
                .warning(client, message.t("commands.badword.word_already_present"))
                .addFields({
                  name: message.t("commands.badword.field_word"),
                  value: `\`${word}\``,
                  inline: true,
                }),
            ],
          })
          .catch(() => {});
      }

      client.db.addBadword(message.guild.id, word);
      invalidateBadwordConfig(client, message.guild.id);

      const count = client.db.db
        .prepare("SELECT COUNT(*) as c FROM badwords WHERE guildId = ?")
        .get(message.guild.id).c;
      return message
        .reply({
          embeds: [
            client.embedBuilder
              .success(client, message.t("commands.badword.word_added"))
              .addFields(
                { name: message.t("commands.badword.field_word"), value: `\`${word}\``, inline: true },
                {
                  name: message.t("commands.badword.field_total"),
                  value: `**${fmtNumber(count)}**`,
                  inline: true,
                },
              ),
          ],
        })
        .catch(() => {});
    }

    if (sub === "remove" || sub === "del" || sub === "delete") {
      if (!word) {
        return message
          .reply({
            embeds: [
              client.embedBuilder.error(
                client,
                message.t("commands.badword.specify_word_remove"),
              ),
            ],
          })
          .catch(() => {});
      }

      const words = client.db.getBadwords(message.guild.id);
      const found = findBadword(word, words);
      const targetWord = found?.word || word;
      const result = client.db.removeBadword(message.guild.id, targetWord);
      if (result.changes === 0) {
        return message
          .reply({
            embeds: [
              client.embedBuilder
                .error(client, message.t("commands.badword.word_not_in_list"))
                .addFields({
                  name: message.t("commands.badword.field_word"),
                  value: `\`${word}\``,
                  inline: true,
                }),
            ],
          })
          .catch(() => {});
      }

      invalidateBadwordConfig(client, message.guild.id);
      const count = client.db.db
        .prepare("SELECT COUNT(*) as c FROM badwords WHERE guildId = ?")
        .get(message.guild.id).c;
      return message
        .reply({
          embeds: [
            client.embedBuilder
              .success(client, message.t("commands.badword.word_removed"))
              .addFields(
                { name: message.t("commands.badword.field_word"), value: `\`${targetWord}\``, inline: true },
                {
                  name: message.t("commands.badword.field_total"),
                  value: `**${fmtNumber(count)}**`,
                  inline: true,
                },
              ),
          ],
        })
        .catch(() => {});
    }

    if (sub === "list" || sub === "ls") {
      const words = client.db.db
        .prepare("SELECT word FROM badwords WHERE guildId = ?")
        .all(message.guild.id);

      if (words.length === 0) {
        return message
          .reply({
            embeds: [
              client.embedBuilder.info(
                client,
                message.t("commands.badword.list_empty"),
              ),
            ],
          })
          .catch(() => {});
      }

      const guildSettings = client.db.getGuild(message.guild.id);
      const antiraid = client.db.getAntiraidConfig(message.guild.id);
      const status =
        (antiraid.antiBadWords ?? guildSettings.antiBadWords) > 0
          ? "on"
          : "off";
      const sanction = antiraid.antiBadWordsPunishment || "none";

      const totalPages = Math.max(1, Math.ceil(words.length / PAGE_SIZE));

      const renderPage = (page) => {
        const safe = Math.min(Math.max(0, page), totalPages - 1);
        const slice = words.slice(
          safe * PAGE_SIZE,
          safe * PAGE_SIZE + PAGE_SIZE,
        );
        const list = slice
          .map(
            (w, i) =>
              `\`${(safe * PAGE_SIZE + i + 1).toString().padStart(3, " ")}\` ${w.word}`,
          )
          .join("\n");
        return client.embedBuilder
          .base(client, message.t("commands.badword.list_title"), null)
          .addFields(
            { name: message.t("commands.badword.field_state"), value: `\`${status}\``, inline: true },
            {
              name: message.t("commands.badword.field_total"),
              value: `**${fmtNumber(words.length)}**`,
              inline: true,
            },
            { name: message.t("commands.badword.field_sanction"), value: `\`${sanction}\``, inline: true },
            {
              name: message.t("commands.badword.field_words"),
              value: list.length > 1024 ? list.slice(0, 1020) + "…" : list,
              inline: false,
            },
          )
          .setFooter({ text: message.t("commands.badword.footer_page", { page: safe + 1, total: totalPages }) });
      };

      if (totalPages === 1) {
        return message.reply({ embeds: [renderPage(0)] }).catch(() => {});
      }

      const navRow = (page) =>
        new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId(`bw_prev`)
            .setLabel(message.t("commands.badword.btn_prev"))
            .setStyle(ButtonStyle.Primary)
            .setDisabled(page === 0),
          new ButtonBuilder()
            .setCustomId(`bw_page`)
            .setLabel(`${page + 1}/${totalPages}`)
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(true),
          new ButtonBuilder()
            .setCustomId(`bw_next`)
            .setLabel(message.t("commands.badword.btn_next"))
            .setStyle(ButtonStyle.Primary)
            .setDisabled(page >= totalPages - 1),
        );

      let page = 0;
      const msg = await message
        .reply({ embeds: [renderPage(page)], components: [navRow(page)] })
        .catch(() => {});
      if (!msg) return;

      const collector = msg.createMessageComponentCollector({ time: 120000 });
      collector.on("collect", async (i) => {
        if (i.user.id !== message.author.id) {
          return i
            .reply({
              content: message.t("commands.badword.not_your_menu"),
              flags: [MessageFlags.Ephemeral],
            })
            .catch(() => {});
        }
        if (i.customId === "bw_prev") page = Math.max(0, page - 1);
        if (i.customId === "bw_next") page = Math.min(totalPages - 1, page + 1);
        await i
          .update({ embeds: [renderPage(page)], components: [navRow(page)] })
          .catch(() => {});
        collector.resetTimer();
      });
      collector.on("end", () => {
        msg.edit({ components: [] }).catch(() => {});
      });
      return;
    }

    if (sub === "clear" || sub === "reset") {
      const count = client.db.db
        .prepare("SELECT COUNT(*) as c FROM badwords WHERE guildId = ?")
        .get(message.guild.id).c;
      if (count === 0) {
        return message
          .reply({
            embeds: [client.embedBuilder.warning(client, message.t("commands.badword.list_already_empty"))],
          })
          .catch(() => {});
      }

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`badword_clear_confirm_${message.author.id}`)
          .setLabel(message.t("commands.badword.btn_delete_all"))
          .setStyle(ButtonStyle.Danger),
        new ButtonBuilder()
          .setCustomId(`badword_clear_cancel_${message.author.id}`)
          .setLabel(message.t("commands.badword.btn_cancel"))
          .setStyle(ButtonStyle.Secondary),
      );

      const prompt = await message
        .reply({
          embeds: [
            client.embedBuilder
              .warning(client, message.t("commands.badword.clear_confirm"))
              .addFields(
                {
                  name: message.t("commands.badword.field_words_count"),
                  value: `**${fmtNumber(count)}**`,
                  inline: true,
                },
                { name: message.t("commands.badword.field_delay"), value: message.t("commands.badword.delay_value"), inline: true },
              ),
          ],
          components: [row],
        })
        .catch(() => {});
      if (!prompt) return;

      const collector = prompt.createMessageComponentCollector({
        filter: (i) => i.user.id === message.author.id,
        time: 30000,
        max: 1,
      });

      collector.on("collect", async (i) => {
        if (i.customId.endsWith("cancel_" + message.author.id)) {
          return i
            .update({
              embeds: [client.embedBuilder.info(client, message.t("commands.badword.operation_cancelled"))],
              components: [],
            })
            .catch(() => {});
        }
        client.db.db
          .prepare("DELETE FROM badwords WHERE guildId = ?")
          .run(message.guild.id);
        invalidateBadwordConfig(client, message.guild.id);
        return i
          .update({
            embeds: [
              client.embedBuilder.success(client, message.t("commands.badword.list_cleared")).addFields({
                name: message.t("commands.badword.field_removed"),
                value: `**${fmtNumber(count)}**`,
                inline: true,
              }),
            ],
            components: [],
          })
          .catch(() => {});
      });

      collector.on("end", (collected) => {
        if (collected.size === 0) {
          prompt
            .edit({
              embeds: [
                client.embedBuilder.warning(client, message.t("commands.badword.delay_exceeded")),
              ],
              components: [],
            })
            .catch(() => {});
        }
      });
      return;
    }

    return message
      .reply({
        embeds: [
          client.embedBuilder.error(
            client,
            message.t("commands.badword.unknown_subcommand"),
          ),
        ],
      })
      .catch(() => {});
  },
};
