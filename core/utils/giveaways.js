const {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require("discord.js");
const { t } = require("./i18n");

function parseJsonArray(value) {
  if (Array.isArray(value)) return value;
  try {
    const parsed = JSON.parse(value || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function shuffle(values) {
  return [...values].sort(() => Math.random() - 0.5);
}

const nfFr = new Intl.NumberFormat("fr-FR");

function buildGiveawayEmbed(client, guild, giveaway, state = "active", lang = "fr") {
  const requirements = parseJsonArray(giveaway.requirements);
  const winners = parseJsonArray(giveaway.winners);
  const participantsCount = giveaway.participantsCount || 0;
  const host = giveaway.hostId
    ? `<@${giveaway.hostId}>`
    : t(lang, "utils.giveaways.host_unknown");
  const endsAt = Number(giveaway.endsAt || Date.now());
  const winnersCount = Math.max(1, Number(giveaway.winnersCount) || 1);

  const embed = new EmbedBuilder()
    .setColor(
      state === "ended" ? "#2B2D31" : client.embedBuilder.getTheme(client),
    )
    .setTitle(giveaway.prize)
    .setTimestamp(state === "ended" ? Date.now() : endsAt);

  if (state === "ended") {
    const winnerLine = winners.length
      ? winners.map((id) => `**<@${id}>**`).join("\n")
      : t(lang, "utils.giveaways.no_participant");
    const rerollHint = giveaway.messageId
      ? t(lang, "utils.giveaways.reroll_hint", {
          guildId: giveaway.guildId,
          channelId: giveaway.channelId,
          messageId: giveaway.messageId,
        })
      : "";
    embed.setDescription(
      t(lang, "utils.giveaways.ended_desc", {
        winnerLine,
        rerollHint,
      }),
    );
    embed.addFields(
      {
        name: t(lang, "utils.giveaways.field_winners"),
        value: `\`${nfFr.format(winners.length)} / ${nfFr.format(winnersCount)}\``,
        inline: true,
      },
      {
        name: t(lang, "utils.giveaways.field_participants"),
        value: `\`${nfFr.format(participantsCount)}\``,
        inline: true,
      },
      { name: t(lang, "utils.giveaways.field_host"), value: host, inline: true },
    );
  } else {
    embed.setDescription(t(lang, "utils.giveaways.active_desc"));
    embed.addFields(
      {
        name: t(lang, "utils.giveaways.field_winners"),
        value: `\`${nfFr.format(winnersCount)}\``,
        inline: true,
      },
      {
        name: t(lang, "utils.giveaways.field_end"),
        value: `<t:${Math.floor(endsAt / 1000)}:R>`,
        inline: true,
      },
      { name: t(lang, "utils.giveaways.field_host"), value: host, inline: true },
    );
  }

  const authorName =
    state === "ended"
      ? t(lang, "utils.giveaways.author_ended")
      : t(lang, "utils.giveaways.author_active");
  if (guild?.iconURL())
    embed.setAuthor({
      name: `${authorName} · ${guild.name}`,
      iconURL: guild.iconURL({ size: 64 }),
    });
  else embed.setAuthor({ name: authorName });

  if (requirements.length > 0) {
    embed.addFields({
      name: t(lang, "utils.giveaways.field_conditions"),
      value: requirements
        .map((id) => `<@&${id}>`)
        .join(" · ")
        .substring(0, 1024),
      inline: false,
    });
  }

  embed.setFooter({
    text:
      state === "ended"
        ? t(lang, "utils.giveaways.footer_ended", {
            count: nfFr.format(participantsCount),
          })
        : t(lang, "utils.giveaways.footer_active", {
            count: nfFr.format(winnersCount),
          }),
  });

  return embed;
}

function buildGiveawayRow(disabled = false, entryCount = 0, lang = "fr") {
  const label = disabled
    ? t(lang, "utils.giveaways.btn_ended")
    : entryCount > 0
      ? t(lang, "utils.giveaways.btn_join_count", {
          count: nfFr.format(entryCount),
        })
      : t(lang, "utils.giveaways.btn_join");
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("giveaway_join")
      .setLabel(label)
      .setStyle(disabled ? ButtonStyle.Secondary : ButtonStyle.Success)
      .setDisabled(disabled),
  );
}

async function userMeetsRequirements(guild, userId, requirements) {
  if (!requirements.length) return true;
  const member = await guild.members.fetch(userId).catch(() => null);
  if (!member) return false;
  return requirements.every((roleId) => member.roles.cache.has(roleId));
}

async function collectParticipants(client, giveaway, message) {
  const guild = message.guild || client.guilds.cache.get(giveaway.guildId);
  const requirements = parseJsonArray(giveaway.requirements);
  const ids = new Set(client.db.getGiveawayEntries(giveaway.messageId));

  const valid = [];
  for (const userId of ids) {
    if (await userMeetsRequirements(guild, userId, requirements))
      valid.push(userId);
  }

  return valid;
}

async function createGiveaway(
  client,
  {
    channel,
    guild,
    prize,
    winnersCount,
    durationMs,
    endsAt,
    hostId,
    requirements = [],
  },
) {
  const endTime = endsAt || Date.now() + durationMs;
  const giveaway = {
    prize: String(prize || "").trim(),
    winnersCount: Math.max(1, parseInt(winnersCount) || 1),
    endsAt: endTime,
    hostId,
    requirements,
  };

  const lang = (client.db.getGuild(guild.id) || {}).language || "fr";

  const message = await channel.send({
    embeds: [buildGiveawayEmbed(client, guild, giveaway, "active", lang)],
    components: [buildGiveawayRow(false, 0, lang)],
  });

  client.db.createGiveaway(
    message.id,
    channel.id,
    guild.id,
    giveaway.prize,
    giveaway.winnersCount,
    endTime,
    hostId,
    requirements,
  );

  return {
    message,
    giveaway: {
      ...giveaway,
      messageId: message.id,
      channelId: channel.id,
      guildId: guild.id,
    },
  };
}

async function endGiveaway(client, messageId, options = {}) {
  const giveaway = client.db.getGiveaway(messageId, options.guildId);
  if (!giveaway) return { ok: false, reason: "not_found" };
  if (giveaway.ended && !options.reroll)
    return { ok: false, reason: "already_ended", giveaway };

  const guild = client.guilds.cache.get(giveaway.guildId);
  if (!guild) {
    // Mark ended so the 10s scheduler stops retrying a giveaway whose guild
    // is no longer reachable (kicked, deleted, etc.).
    if (!giveaway.ended)
      client.db.endGiveaway(giveaway.messageId, [], 0);
    return { ok: false, reason: "guild_missing", giveaway };
  }

  const lang = (client.db.getGuild(giveaway.guildId) || {}).language || "fr";

  const channel = guild.channels.cache.get(giveaway.channelId);
  if (!channel) {
    if (!giveaway.ended)
      client.db.endGiveaway(giveaway.messageId, [], 0);
    return { ok: false, reason: "channel_missing", giveaway };
  }

  const message = await channel.messages
    .fetch(giveaway.messageId)
    .catch(() => null);
  if (!message) {
    if (!giveaway.ended)
      client.db.endGiveaway(giveaway.messageId, [], 0);
    return { ok: false, reason: "message_missing", giveaway };
  }

  const participants = await collectParticipants(client, giveaway, message);
  const requestedWinners = Math.max(1, Number(giveaway.winnersCount) || 1);
  // Cap at participants.length to avoid slicing more than available.
  const winners = shuffle(participants).slice(
    0,
    Math.min(requestedWinners, participants.length),
  );
  const endedGiveaway = {
    ...giveaway,
    winners,
    participantsCount: participants.length,
  };

  client.db.endGiveaway(giveaway.messageId, winners, participants.length);

  await message
    .edit({
      content: t(lang, "utils.giveaways.msg_ended"),
      embeds: [buildGiveawayEmbed(client, guild, endedGiveaway, "ended", lang)],
      components: [buildGiveawayRow(true, 0, lang)],
    })
    .catch(() => {});

  if (winners.length === 0) {
    await channel
      .send({
        content: t(lang, "utils.giveaways.no_winner", {
          prize: giveaway.prize,
        }),
        reply: { messageReference: giveaway.messageId, failIfNotExists: false },
        allowedMentions: { parse: [] },
      })
      .catch(() => {});
  } else {
    const mentions = winners.map((id) => `<@${id}>`).join(", ");
    await channel
      .send({
        content: t(lang, "utils.giveaways.winner_announce", {
          mentions,
          prize: giveaway.prize,
        }),
        reply: { messageReference: giveaway.messageId, failIfNotExists: false },
        allowedMentions: { users: winners },
      })
      .catch(() => {});
  }

  return { ok: true, giveaway: endedGiveaway, participants, winners };
}

async function rerollGiveaway(client, messageId, guildId) {
  const giveaway = client.db.getGiveaway(messageId, guildId);
  if (!giveaway) return { ok: false, reason: "not_found" };
  if (!giveaway.ended) return { ok: false, reason: "not_ended", giveaway };

  const guild = client.guilds.cache.get(giveaway.guildId);
  const channel = guild?.channels.cache.get(giveaway.channelId);
  const message = await channel?.messages
    .fetch(giveaway.messageId)
    .catch(() => null);
  if (!guild || !channel || !message)
    return { ok: false, reason: "message_missing", giveaway };

  const lang = (client.db.getGuild(giveaway.guildId) || {}).language || "fr";

  const participants = await collectParticipants(client, giveaway, message);
  if (participants.length === 0) {
    await channel
      .send(
        t(lang, "utils.giveaways.reroll_no_participants", {
          prize: giveaway.prize,
        }),
      )
      .catch(() => {});
    return { ok: false, reason: "no_participants", giveaway };
  }

  // Strictly exclude previous winners. If pool is empty, no reroll happens.
  const previousWinners = new Set(parseJsonArray(giveaway.winners));
  const pool = participants.filter((id) => !previousWinners.has(id));
  if (pool.length === 0) {
    await channel
      .send(
        t(lang, "utils.giveaways.reroll_pool_exhausted", {
          prize: giveaway.prize,
        }),
      )
      .catch(() => {});
    return { ok: false, reason: "pool_exhausted", giveaway };
  }

  const requestedWinners = Math.max(1, Number(giveaway.winnersCount) || 1);
  const winners = shuffle(pool).slice(
    0,
    Math.min(requestedWinners, pool.length),
  );

  client.db.endGiveaway(giveaway.messageId, winners, participants.length);

  const rerolledGiveaway = {
    ...giveaway,
    winners,
    participantsCount: participants.length,
  };
  await message
    .edit({
      content: t(lang, "utils.giveaways.msg_ended_rerolled"),
      embeds: [
        buildGiveawayEmbed(client, guild, rerolledGiveaway, "ended", lang),
      ],
      components: [buildGiveawayRow(true, 0, lang)],
    })
    .catch(() => {});

  await channel
    .send({
      content: t(lang, "utils.giveaways.reroll_announce", {
        prize: giveaway.prize,
        mentions: winners.map((id) => `<@${id}>`).join(", "),
      }),
      reply: { messageReference: giveaway.messageId, failIfNotExists: false },
      allowedMentions: { users: winners },
    })
    .catch(() => {});

  return { ok: true, giveaway: rerolledGiveaway, participants, winners };
}

async function joinGiveaway(interaction, client) {
  const giveaway = client.db.getActiveGiveaway(interaction.message.id);
  if (!giveaway) return { ok: false, reason: "ended" };

  const requirements = parseJsonArray(giveaway.requirements);
  if (
    !(await userMeetsRequirements(
      interaction.guild,
      interaction.user.id,
      requirements,
    ))
  ) {
    return { ok: false, reason: "requirements" };
  }

  const alreadyJoined = client.db.hasGiveawayEntry(
    giveaway.messageId,
    interaction.user.id,
  );
  if (!alreadyJoined)
    client.db.addGiveawayEntry(
      giveaway.messageId,
      giveaway.guildId,
      interaction.user.id,
    );

  // Refresh button label with live entry count
  if (!alreadyJoined) {
    try {
      const lang =
        (client.db.getGuild(giveaway.guildId) || {}).language || "fr";
      const entries = client.db.getGiveawayEntries(giveaway.messageId) || [];
      await interaction.message
        .edit({ components: [buildGiveawayRow(false, entries.length, lang)] })
        .catch(() => {});
    } catch (e) {}
  }

  return { ok: true, alreadyJoined };
}

module.exports = {
  createGiveaway,
  endGiveaway,
  rerollGiveaway,
  joinGiveaway,
  buildGiveawayEmbed,
  buildGiveawayRow,
  parseJsonArray,
};
