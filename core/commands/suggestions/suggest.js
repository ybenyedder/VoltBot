const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ComponentType,
} = require("discord.js");
const { t } = require("../../utils/i18n");

const VOTE_PREFIX = "suggest_vote";

const buildVoteRow = (
  msgId,
  counts = { up: 0, down: 0, mid: 0 },
  lang = "fr",
) =>
  new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`${VOTE_PREFIX}:up:${msgId}`)
      .setLabel(`${t(lang, "commands.suggest.vote_up")} (${counts.up})`)
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId(`${VOTE_PREFIX}:down:${msgId}`)
      .setLabel(`${t(lang, "commands.suggest.vote_down")} (${counts.down})`)
      .setStyle(ButtonStyle.Danger),
    new ButtonBuilder()
      .setCustomId(`${VOTE_PREFIX}:mid:${msgId}`)
      .setLabel(`${t(lang, "commands.suggest.vote_mid")} (${counts.mid})`)
      .setStyle(ButtonStyle.Secondary),
  );

const ensureVoteTable = (client) => {
  try {
    client.db.db
      .prepare(
        "CREATE TABLE IF NOT EXISTS suggestion_votes (msgId TEXT NOT NULL, userId TEXT NOT NULL, vote TEXT NOT NULL, PRIMARY KEY (msgId, userId))",
      )
      .run();
  } catch (e) {}
};

const ensureSuggestionTable = (client) => {
  try {
    client.db.db
      .prepare(
        "CREATE TABLE IF NOT EXISTS suggestions (msgId TEXT PRIMARY KEY, guildId TEXT NOT NULL, userId TEXT NOT NULL, status TEXT)",
      )
      .run();
  } catch (e) {}
};

const tallyVotes = (client, msgId) => {
  try {
    const rows = client.db.db
      .prepare(
        "SELECT vote, COUNT(*) AS c FROM suggestion_votes WHERE msgId = ? GROUP BY vote",
      )
      .all(msgId);
    const counts = { up: 0, down: 0, mid: 0 };
    for (const r of rows)
      if (counts[r.vote] !== undefined) counts[r.vote] = r.c;
    return counts;
  } catch (e) {
    return { up: 0, down: 0, mid: 0 };
  }
};

const quoteContent = (text) =>
  String(text)
    .split("\n")
    .map((l) => `> ${l}`)
    .join("\n");

const nextSuggestionOrdinal = (client, guildId) => {
  try {
    ensureSuggestionTable(client);
    const row = client.db.db
      .prepare("SELECT COUNT(*) AS c FROM suggestions WHERE guildId = ?")
      .get(guildId);
    return (row?.c || 0) + 1;
  } catch (e) {
    return 1;
  }
};

const attachVoteCollector = (client, suggestMsg, lang = "fr") => {
  ensureVoteTable(client);
  const collector = suggestMsg.createMessageComponentCollector({
    componentType: ComponentType.Button,
    filter: (i) =>
      i.customId.startsWith(`${VOTE_PREFIX}:`) &&
      i.customId.endsWith(`:${suggestMsg.id}`),
  });

  collector.on("collect", async (interaction) => {
    try {
      const [, kind] = interaction.customId.split(":");
      if (!["up", "down", "mid"].includes(kind)) return;

      client.db.db
        .prepare(
          "INSERT INTO suggestion_votes (msgId, userId, vote) VALUES (?, ?, ?) ON CONFLICT(msgId, userId) DO UPDATE SET vote = excluded.vote",
        )
        .run(suggestMsg.id, interaction.user.id, kind);

      const counts = tallyVotes(client, suggestMsg.id);
      await interaction
        .update({ components: [buildVoteRow(suggestMsg.id, counts, lang)] })
        .catch(() => {});
    } catch (e) {
      await interaction
        .reply({
          embeds: [
            client.embedBuilder.error(
              client,
              t(lang, "commands.suggest.vote_failed"),
            ),
          ],
          ephemeral: true,
        })
        .catch(() => {});
    }
  });
};

const postSuggestion = async (
  client,
  guild,
  author,
  channel,
  content,
  lang = "fr",
) => {
  const ordinal = nextSuggestionOrdinal(client, guild.id);

  const embed = client.embedBuilder
    .premium(
      client,
      t(lang, "commands.suggest.suggestion_title", { ordinal }),
      quoteContent(content),
      author.displayAvatarURL({ size: 256 }),
    )
    .setAuthor({
      name: `${author.tag} · #${ordinal}`,
      iconURL: author.displayAvatarURL({ size: 64 }),
    })
    .addFields(
      {
        name: t(lang, "commands.suggest.field_author"),
        value: `<@${author.id}>`,
        inline: true,
      },
      {
        name: "Statut",
        value: `\`${t(lang, "commands.suggest.status_pending")}\``,
        inline: true,
      },
      {
        name: t(lang, "commands.suggest.field_votes"),
        value: "`0`",
        inline: true,
      },
    );

  const suggestMsg = await channel.send({ embeds: [embed] }).catch(() => null);
  if (!suggestMsg) return null;

  await suggestMsg
    .edit({
      embeds: [embed],
      components: [buildVoteRow(suggestMsg.id, undefined, lang)],
    })
    .catch(() => {});

  try {
    ensureSuggestionTable(client);
    client.db.db
      .prepare(
        "INSERT INTO suggestions (msgId, guildId, userId) VALUES (?, ?, ?)",
      )
      .run(suggestMsg.id, guild.id, author.id);
  } catch (e) {}

  attachVoteCollector(client, suggestMsg, lang);
  return suggestMsg;
};

module.exports = {
  name: "suggest",
  aliases: ["suggestion"],
  description: "Propose une suggestion pour le serveur.",
  category: "suggestions",
  usage: "+suggest [idée]",
  async execute(client, message, args) {
    let suggestChannelId;
    try {
      suggestChannelId = client.db.getGuild(message.guild.id).suggestChannel;
    } catch (e) {
      suggestChannelId = null;
    }

    if (!suggestChannelId) {
      return message
        .reply({
          embeds: [
            client.embedBuilder.error(
              client,
              message.t("commands.suggest.system_not_configured"),
            ),
          ],
        })
        .catch(() => {});
    }

    const channel = message.guild.channels.cache.get(suggestChannelId);
    if (!channel) {
      return message
        .reply({
          embeds: [
            client.embedBuilder.error(
              client,
              message.t("commands.suggest.channel_not_found"),
            ),
          ],
        })
        .catch(() => {});
    }

    const inline = args.join(" ").trim();

    if (inline) {
      const posted = await postSuggestion(
        client,
        message.guild,
        message.author,
        channel,
        inline,
        message.lang,
      );
      if (!posted) {
        return message
          .reply({
            embeds: [
              client.embedBuilder.error(
                client,
                message.t("commands.suggest.send_failed"),
              ),
            ],
          })
          .catch(() => {});
      }
      if (message.guild && message.deletable)
        await message.delete().catch(() => {});
      return;
    }

    const openId = `suggest_open:${message.author.id}:${Date.now()}`;
    const modalId = `suggest_modal:${message.author.id}:${Date.now()}`;

    const openRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(openId)
        .setLabel(message.t("commands.suggest.open_form"))
        .setStyle(ButtonStyle.Primary),
    );

    if (message.guild && message.deletable)
      await message.delete().catch(() => {});

    const prompt = await message.channel
      .send({
        embeds: [
          client.embedBuilder.info(
            client,
            message.t("commands.suggest.click_button"),
          ),
        ],
        components: [openRow],
      })
      .catch(() => null);
    if (!prompt) return;

    const btnInteraction = await prompt
      .awaitMessageComponent({
        componentType: ComponentType.Button,
        filter: (i) => i.customId === openId && i.user.id === message.author.id,
        time: 120_000,
      })
      .catch(() => null);

    if (!btnInteraction) {
      return prompt
        .edit({
          embeds: [
            client.embedBuilder.warning(
              client,
              message.t("commands.suggest.form_expired"),
            ),
          ],
          components: [],
        })
        .catch(() => {});
    }

    const modal = new ModalBuilder()
      .setCustomId(modalId)
      .setTitle(message.t("commands.suggest.modal_title"))
      .addComponents(
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId("suggest_content")
            .setLabel(message.t("commands.suggest.input_content_label"))
            .setPlaceholder(
              message.t("commands.suggest.input_content_placeholder"),
            )
            .setStyle(TextInputStyle.Paragraph)
            .setMinLength(5)
            .setMaxLength(1500)
            .setRequired(true),
        ),
      );

    await btnInteraction.showModal(modal).catch(() => {});

    const submitted = await btnInteraction
      .awaitModalSubmit({
        filter: (i) =>
          i.customId === modalId && i.user.id === message.author.id,
        time: 300_000,
      })
      .catch(() => null);

    await prompt.delete().catch(() => {});

    if (!submitted) return;

    const content = submitted.fields
      .getTextInputValue("suggest_content")
      .trim();
    if (!content) {
      return submitted
        .reply({
          embeds: [
            client.embedBuilder.error(
              client,
              message.t("commands.suggest.empty_suggestion"),
            ),
          ],
          ephemeral: true,
        })
        .catch(() => {});
    }

    const posted = await postSuggestion(
      client,
      message.guild,
      message.author,
      channel,
      content,
      message.lang,
    );
    if (!posted) {
      return submitted
        .reply({
          embeds: [
            client.embedBuilder.error(
              client,
              message.t("commands.suggest.send_failed"),
            ),
          ],
          ephemeral: true,
        })
        .catch(() => {});
    }

    return submitted
      .reply({
        embeds: [
          client.embedBuilder.success(
            client,
            message.t("commands.suggest.published", { channel: channel }),
          ),
        ],
        ephemeral: true,
      })
      .catch(() => {});
  },

  _internals: {
    buildVoteRow,
    attachVoteCollector,
    tallyVotes,
    ensureVoteTable,
    ensureSuggestionTable,
  },
};
