const {
  PermissionsBitField,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
} = require("discord.js");

const fmtDuration = (ms) => {
  const s = Math.max(0, Math.round(ms / 1000));
  if (s < 60) return `${s} s`;
  const m = Math.floor(s / 60);
  const rs = s % 60;
  return rs ? `${m} min ${rs} s` : `${m} min`;
};

module.exports = {
  name: "lockall",
  aliases: ["raidlock"],
  description: "Verrouille CHAQUE salon texte du serveur en cas de raid.",
  category: "config",
  usage: "+lockall",
  userPerms: [PermissionsBitField.Flags.Administrator],
  botPerms: [PermissionsBitField.Flags.ManageChannels],
  async execute(client, message, args) {
    const confirmEmbed = client.embedBuilder
      .warning(
        client,
        message.t("commands.lockdown.confirm_warning"),
      )
      .addFields({ name: message.t("commands.lockdown.field_delay"), value: "30 s", inline: true });

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`lockdown_confirm_${message.author.id}`)
        .setLabel(message.t("commands.lockdown.btn_lock"))
        .setStyle(ButtonStyle.Danger),
      new ButtonBuilder()
        .setCustomId(`lockdown_cancel_${message.author.id}`)
        .setLabel(message.t("commands.lockdown.btn_cancel"))
        .setStyle(ButtonStyle.Secondary),
    );

    const prompt = await message
      .reply({ embeds: [confirmEmbed], components: [row] })
      .catch(() => {});
    if (!prompt) return;

    const collector = prompt.createMessageComponentCollector({
      filter: (i) =>
        i.user.id === message.author.id &&
        (i.customId === `lockdown_confirm_${message.author.id}` ||
          i.customId === `lockdown_cancel_${message.author.id}`),
      time: 30000,
      max: 1,
    });

    collector.on("collect", async (i) => {
      if (i.customId.startsWith("lockdown_cancel")) {
        return i
          .update({
            embeds: [client.embedBuilder.info(client, message.t("commands.lockdown.cancelled"))],
            components: [],
          })
          .catch(() => {});
      }

      await i
        .update({
          embeds: [client.embedBuilder.info(client, message.t("commands.lockdown.locking_in_progress"))],
          components: [],
        })
        .catch(() => {});

      const start = Date.now();
      const channels = [
        ...message.guild.channels.cache
          .filter((c) => c.type === ChannelType.GuildText)
          .values(),
      ];
      const total = channels.length;
      let locked = 0;
      let failed = 0;

      for (let idx = 0; idx < channels.length; idx++) {
        const channel = channels[idx];
        try {
          await channel.permissionOverwrites.edit(
            message.guild.roles.everyone,
            { SendMessages: false },
          );
          locked++;
        } catch (e) {
          failed++;
          client.logger?.error(
            `[LOCKDOWN] Failed to edit permissions for channel ${channel.id}: ${e.message}`,
          );
          if (e && (e.status === 429 || e.code === 429)) {
            const retryMs = Math.min(
              5000,
              Math.max(500, Number(e.retry_after || e.retryAfter || 1) * 1000),
            );
            await new Promise((r) => setTimeout(r, retryMs));
          }
        }

        // Throttle channel-permission ops (heavy bucket)
        if ((idx + 1) % 5 === 0) {
          await new Promise((r) => setTimeout(r, 150));
        }

        if ((idx + 1) % 5 === 0 || idx + 1 === channels.length) {
          await prompt
            .edit({
              embeds: [
                client.embedBuilder.info(
                  client,
                  message.t("commands.lockdown.progress", { done: idx + 1, total }),
                ),
              ],
            })
            .catch(() => {});
        }
      }

      await prompt
        .edit({
          embeds: [
            client.embedBuilder
              .success(client, message.t("commands.lockdown.applied"))
              .addFields(
                {
                  name: message.t("commands.lockdown.field_locked"),
                  value: `**${locked}**`,
                  inline: true,
                },
                { name: message.t("commands.lockdown.field_failed"), value: `${failed}`, inline: true },
                {
                  name: message.t("commands.lockdown.field_duration"),
                  value: fmtDuration(Date.now() - start),
                  inline: true,
                },
              ),
          ],
        })
        .catch(() => {});
    });

    collector.on("end", (collected) => {
      if (collected.size === 0) {
        prompt
          .edit({
            embeds: [
              client.embedBuilder.warning(client, message.t("commands.lockdown.timed_out")),
            ],
            components: [],
          })
          .catch(() => {});
      }
    });
  },
};
