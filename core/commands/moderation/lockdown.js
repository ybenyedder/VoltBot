const { PermissionsBitField, ChannelType } = require("discord.js");

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

module.exports = {
  name: "lockdown",
  aliases: ["catlock"],
  description:
    "Verrouille tous les salons d'une catégorie. Cible la catégorie courante par défaut.",
  category: "moderation",
  usage: "+lockdown [<category_id|#salon|all|off>] [off]",
  userPerms: [PermissionsBitField.Flags.ManageChannels],
  botPerms: [PermissionsBitField.Flags.ManageChannels],
  async execute(client, message, args) {
    const last = args[args.length - 1]?.toLowerCase();
    const unlock = last === "off" || last === "unlock";
    const positional = unlock ? args.slice(0, -1) : args;
    const target = (positional[0] || "").toLowerCase();

    let scopeChannels = null;
    let scopeLabel = "";

    if (target === "all") {
      scopeChannels = message.guild.channels.cache.filter(
        (c) => c.type === ChannelType.GuildText,
      );
      scopeLabel = message.t("commands.lockdown.scope_whole_server");
    } else {
      let category = null;
      if (positional[0] && /^\d{17,20}$/.test(positional[0])) {
        const ch = message.guild.channels.cache.get(positional[0]);
        if (ch && ch.type === ChannelType.GuildCategory) category = ch;
        else if (ch && ch.parent) category = ch.parent;
      } else if (message.mentions.channels.first()) {
        const m = message.mentions.channels.first();
        category = m.type === ChannelType.GuildCategory ? m : m.parent;
      } else {
        category = message.channel.parent;
      }

      if (!category) {
        return message
          .reply({
            embeds: [
              client.embedBuilder.error(
                client,
                message.t("commands.lockdown.no_category"),
              ),
            ],
          })
          .catch(() => {});
      }

      scopeChannels = message.guild.channels.cache.filter(
        (c) => c.parentId === category.id && c.type === ChannelType.GuildText,
      );
      scopeLabel = message.t("commands.lockdown.scope_category", { name: category.name });
    }

    const total = scopeChannels.size;
    if (total === 0) {
      return message
        .reply({
          embeds: [
            client.embedBuilder.warning(client, message.t("commands.lockdown.no_text_channel")),
          ],
        })
        .catch(() => {});
    }

    const action = unlock
      ? message.t("commands.lockdown.action_unlock")
      : message.t("commands.lockdown.action_lock");
    const statusMsg = await message
      .reply({
        embeds: [
          client.embedBuilder.info(
            client,
            message.t("commands.lockdown.status", {
              action,
              total,
              scope: scopeLabel,
            }),
          ),
        ],
      })
      .catch(() => null);

    let count = 0;
    let processed = 0;
    const everyone = message.guild.roles.everyone;
    const reasonTag = `[LOCKDOWN:${unlock ? "off" : "on"}] ${message.author.tag}`;

    for (const channel of scopeChannels.values()) {
      try {
        await channel.permissionOverwrites.edit(
          everyone,
          { SendMessages: unlock ? null : false },
          { reason: reasonTag },
        );
        count++;
      } catch (e) {
        if (e && (e.status === 429 || e.code === 429)) {
          const retryMs = Math.min(
            5000,
            Math.max(500, Number(e.retry_after || e.retryAfter || 1) * 1000),
          );
          await sleep(retryMs);
        }
      }
      processed++;
      if (processed % 5 === 0) await sleep(150);
      if (statusMsg && total > 20 && processed % 10 === 0) {
        await statusMsg
          .edit({
            embeds: [
              client.embedBuilder.info(
                client,
                message.t("commands.lockdown.progress", { processed, total }),
              ),
            ],
          })
          .catch(() => {});
      }
    }

    const finalEmbed = client.embedBuilder
      .success(
        client,
        unlock
          ? message.t("commands.lockdown.result_unlocked", { count, total })
          : message.t("commands.lockdown.result_locked", { count, total }),
      )
      .addFields(
        { name: message.t("commands.lockdown.field_scope"), value: scopeLabel, inline: true },
        { name: message.t("commands.lockdown.field_moderator"), value: `${message.author}`, inline: true },
      );

    if (statusMsg)
      await statusMsg
        .edit({ embeds: [finalEmbed] })
        .catch(() =>
          message.channel.send({ embeds: [finalEmbed] }).catch(() => {}),
        );
    else
      await message.channel.send({ embeds: [finalEmbed] }).catch(() => {});

    try {
      const gs = client.db.getGuild(message.guild.id);
      if (gs && gs.modLogsChannel) {
        const logChannel = message.guild.channels.cache.get(gs.modLogsChannel);
        if (logChannel)
          logChannel.send({ embeds: [finalEmbed] }).catch(() => {});
      }
    } catch (_) {}
  },
};
