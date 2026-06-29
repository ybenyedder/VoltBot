const { PermissionsBitField, ChannelType } = require("discord.js");
const permissions = require("../../utils/permissions");

const fmtDuration = (ms) => {
  const s = Math.max(0, Math.round(ms / 1000));
  if (s < 60) return `${s} s`;
  const m = Math.floor(s / 60);
  const rs = s % 60;
  return rs ? `${m} min ${rs} s` : `${m} min`;
};

module.exports = {
  name: "unlockdown",
  description: "Déverrouille CHAQUE salon texte du serveur après un lockdown.",
  category: "config",
  usage: "unlockdown",
  userPerms: [PermissionsBitField.Flags.Administrator],
  botPerms: [PermissionsBitField.Flags.ManageChannels],
  async execute(client, message, args) {
    if (!permissions.isAdmin(message)) {
      return message
        .reply({
          embeds: [
            client.embedBuilder.error(client, message.t("commands.unlockdown.admin_only")),
          ],
        })
        .catch(() => {});
    }

    const channels = [
      ...message.guild.channels.cache
        .filter((c) => c.type === ChannelType.GuildText)
        .values(),
    ];
    const total = channels.length;

    const loading = await message
      .reply({
        embeds: [
          client.embedBuilder.info(
            client,
            message.t("commands.unlockdown.in_progress_start", { total }),
          ),
        ],
      })
      .catch(() => {});

    const start = Date.now();
    let unlocked = 0;
    let failed = 0;

    for (let idx = 0; idx < channels.length; idx++) {
      const channel = channels[idx];
      try {
        await channel.permissionOverwrites.edit(message.guild.roles.everyone, {
          SendMessages: null,
        });
        unlocked++;
      } catch (e) {
        failed++;
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

      if (loading && ((idx + 1) % 5 === 0 || idx + 1 === total)) {
        await loading
          .edit({
            embeds: [
              client.embedBuilder.info(
                client,
                message.t("commands.unlockdown.in_progress", { done: idx + 1, total }),
              ),
            ],
          })
          .catch(() => {});
      }
    }

    const done = {
      embeds: [
        client.embedBuilder.success(client, message.t("commands.unlockdown.done")).addFields(
          {
            name: message.t("commands.unlockdown.field_unlocked"),
            value: `**${unlocked}**`,
            inline: true,
          },
          { name: message.t("commands.unlockdown.field_failed"), value: `${failed}`, inline: true },
          {
            name: message.t("commands.unlockdown.field_duration"),
            value: fmtDuration(Date.now() - start),
            inline: true,
          },
        ),
      ],
    };
    if (loading) await loading.edit(done).catch(() => {});
    else await message.channel.send(done).catch(() => {});
  },
};
