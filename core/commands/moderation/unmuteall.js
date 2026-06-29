const { PermissionsBitField } = require("discord.js");
const sanctionUtils = require("../../utils/sanctionUtils");

const fmtNum = (n) => new Intl.NumberFormat("fr-FR").format(n);

module.exports = {
  name: "unmuteall",
  description:
    "Démute (libère la parole) de tous les membres du salon vocal où vous êtes.",
  category: "moderation",
  usage: "+unmuteall",
  userPerms: [PermissionsBitField.Flags.MuteMembers],
  botPerms: [PermissionsBitField.Flags.MuteMembers],
  async execute(client, message, args) {
    const voiceChannel = message.member.voice.channel;
    if (!voiceChannel) {
      return message
        .reply({
          embeds: [
            client.embedBuilder.error(client, message.t("commands.unmuteall.join_voice")),
          ],
        })
        .catch(() => {});
    }

    const membersInChannel = voiceChannel.members.filter((m) => !m.user.bot);

    if (membersInChannel.size === 0) {
      return message
        .reply({
          embeds: [client.embedBuilder.info(client, message.t("commands.unmuteall.no_target"))],
        })
        .catch(() => {});
    }

    const total = membersInChannel.size;
    const start = Date.now();
    const statusMsg = await message
      .reply({
        embeds: [client.embedBuilder.info(client, `0/${fmtNum(total)}`)],
      })
      .catch(() => null);

    let count = 0;
    let failed = 0;
    let processed = 0;
    for (const member of membersInChannel.values()) {
      try {
        await member.voice.setMute(
          false,
          `UnmuteAll par ${message.author.tag}`,
        );
        await sanctionUtils.sendSanctionLiftDm(
          client,
          member,
          message.guild,
          "mute vocal",
          `UnmuteAll par ${message.author.tag}`,
        );
        count++;
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
                `${fmtNum(processed)}/${fmtNum(total)}`,
              ),
            ],
          })
          .catch(() => {});
      }
    }

    const elapsed = Math.max(1, Math.round((Date.now() - start) / 1000));
    const finalEmbed = client.embedBuilder
      .success(client, "​")
      .setDescription(null)
      .setAuthor({ name: message.t("commands.unmuteall.title") })
      .addFields(
        { name: message.t("commands.unmuteall.field_channel"), value: `<#${voiceChannel.id}>`, inline: true },
        { name: message.t("commands.unmuteall.field_affected"), value: fmtNum(count), inline: true },
        { name: message.t("commands.unmuteall.field_failed"), value: fmtNum(failed), inline: true },
        { name: message.t("commands.unmuteall.field_duration"), value: message.t("commands.unmuteall.duration_value", { s: elapsed }), inline: true },
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
