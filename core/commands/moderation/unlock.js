const { PermissionsBitField } = require("discord.js");

module.exports = {
  name: "unlock",
  aliases: ["ouvrir"],
  description: "Déverrouille le salon actuel.",
  category: "moderation",
  usage: "+unlock [#salon|all]",
  userPerms: [PermissionsBitField.Flags.ManageChannels],
  botPerms: [PermissionsBitField.Flags.ManageChannels],
  async execute(client, message, args) {
    const target =
      args[0] === "all"
        ? "all"
        : message.mentions.channels.first() || message.channel;

    if (target === "all") {
      const channels = message.guild.channels.cache.filter((c) => c.type === 0);
      const total = channels.size;
      const statusMsg = await message
        .reply({
          embeds: [
            client.embedBuilder.info(
              client,
              message.t("commands.unlock.unlocking_progress_start", { total }),
            ),
          ],
        })
        .catch(() => null);

      let count = 0;
      let processed = 0;
      for (const channel of channels.values()) {
        try {
          await channel.permissionOverwrites.edit(
            message.guild.roles.everyone,
            { SendMessages: null },
          );
          count++;
        } catch (e) {
          if (e && (e.status === 429 || e.code === 429)) {
            const retryMs = Math.min(
              5000,
              Math.max(500, Number(e.retry_after || e.retryAfter || 1) * 1000),
            );
            await new Promise((r) => setTimeout(r, retryMs));
          }
        }
        processed++;
        if (processed % 5 === 0) {
          await new Promise((r) => setTimeout(r, 150));
        }
        if (statusMsg && total > 20 && processed % 10 === 0) {
          await statusMsg
            .edit({
              embeds: [
                client.embedBuilder.info(
                  client,
                  message.t("commands.unlock.progress", { processed, total }),
                ),
              ],
            })
            .catch(() => {});
        }
      }

      const finalEmbed = client.embedBuilder.success(
        client,
        message.t("commands.unlock.channels_unlocked", { count, total }),
      );
      if (statusMsg)
        await statusMsg
          .edit({ embeds: [finalEmbed] })
          .catch(() =>
            message.channel.send({ embeds: [finalEmbed] }).catch(() => {}),
          );
      else await message.channel.send({ embeds: [finalEmbed] }).catch(() => {});
      return;
    }

    try {
      await target.permissionOverwrites.edit(message.guild.roles.everyone, {
        SendMessages: null,
      });
      await message
        .reply({
          embeds: [
            client.embedBuilder.success(
              client,
              message.t("commands.unlock.channel_unlocked", { channel: `<#${target.id}>` }),
            ),
          ],
        })
        .catch(() => {});
    } catch (err) {
      await message
        .reply({
          embeds: [
            client.embedBuilder.error(
              client,
              message.t("commands.unlock.unlock_failed"),
            ),
          ],
        })
        .catch(() => {});
    }
  },
};
