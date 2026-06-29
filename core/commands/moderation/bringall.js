const { PermissionsBitField } = require("discord.js");
const permissions = require("../../utils/permissions");

module.exports = {
  name: "bringall",
  aliases: ["dragall", "moveall"],
  description:
    "Déplace tous les utilisateurs connectés en vocal vers un seul salon.",
  category: "moderation",
  usage: "+bringall [salon]",
  userPerms: [PermissionsBitField.Flags.MoveMembers],
  botPerms: [PermissionsBitField.Flags.MoveMembers],
  async execute(client, message, args) {
    let targetChannel =
      message.mentions.channels.first() ||
      message.guild.channels.cache.get(args[0]);

    if (!targetChannel) {
      if (message.member.voice.channel) {
        targetChannel = message.member.voice.channel;
      } else {
        return message
          .reply({
            embeds: [
              client.embedBuilder.error(
                client,
                message.t("commands.bringall.no_channel"),
              ),
            ],
          })
          .catch(() => {});
      }
    }

    if (!targetChannel.isVoiceBased())
      return message
        .reply({
          embeds: [
            client.embedBuilder.error(
              client,
              message.t("commands.bringall.not_voice"),
            ),
          ],
        })
        .catch(() => {});

    const vocalMembers = message.guild.members.cache.filter(
      (m) => m.voice.channelId && m.voice.channelId !== targetChannel.id,
    );

    if (vocalMembers.size === 0)
      return message
        .reply({
          embeds: [
            client.embedBuilder.error(
              client,
              message.t("commands.bringall.no_one"),
            ),
          ],
        })
        .catch(() => {});

    const total = vocalMembers.size;
    const statusMsg = await message
      .reply({
        embeds: [
          client.embedBuilder.info(
            client,
            message.t("commands.bringall.moving", {
              total,
              channel: targetChannel.name,
            }),
          ),
        ],
      })
      .catch(() => null);

    let count = 0;
    let processed = 0;
    for (const [, member] of vocalMembers) {
      try {
        await member.voice.setChannel(targetChannel);
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
        await new Promise((r) => setTimeout(r, 120));
      }
      if (statusMsg && total > 20 && processed % 10 === 0) {
        await statusMsg
          .edit({
            embeds: [
              client.embedBuilder.info(
                client,
                message.t("commands.bringall.progress", { processed, total }),
              ),
            ],
          })
          .catch(() => {});
      }
    }

    const finalEmbed = client.embedBuilder.success(
      client,
      message.t("commands.bringall.done", {
        count,
        total,
        channel: targetChannel.name,
      }),
    );
    if (statusMsg)
      await statusMsg
        .edit({ embeds: [finalEmbed] })
        .catch(() =>
          message.channel.send({ embeds: [finalEmbed] }).catch(() => {}),
        );
    else await message.channel.send({ embeds: [finalEmbed] }).catch(() => {});
  },
};
