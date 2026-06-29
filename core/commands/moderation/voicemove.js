const { PermissionsBitField } = require("discord.js");

const fmtNum = (n) => new Intl.NumberFormat("fr-FR").format(n);

module.exports = {
  name: "voicemove",
  aliases: ["vm", "move"],
  description: "Déplace un membre ou tous les membres d'un salon vocal.",
  category: "moderation",
  usage: "+voicemove <membre/channel> [channel]",
  userPerms: [PermissionsBitField.Flags.MoveMembers],
  botPerms: [PermissionsBitField.Flags.MoveMembers],
  async execute(client, message, args) {
    if (!args[0])
      return message
        .reply({
          embeds: [
            client.embedBuilder.error(
              client,
              message.t("commands.voicemove.missing_args"),
            ),
          ],
        })
        .catch(() => {});

    const targetMember =
      message.mentions.members.first() ||
      message.guild.members.cache.get(args[0]);

    // Cas 1 : Déplacer un membre spécifique
    if (targetMember) {
      const destination =
        message.mentions.channels
          .filter((c) => c.id !== targetMember.id)
          .first() || message.guild.channels.cache.get(args[1]);
      if (!destination || destination.type !== 2)
        return message
          .reply({
            embeds: [
              client.embedBuilder.error(
                client,
                message.t("commands.voicemove.invalid_destination"),
              ),
            ],
          })
          .catch(() => {});

      if (!targetMember.voice.channel)
        return message
          .reply({
            embeds: [client.embedBuilder.error(client, message.t("commands.voicemove.target_no_voice"))],
          })
          .catch(() => {});

      try {
        await targetMember.voice.setChannel(destination);
        const ts = Math.floor(Date.now() / 1000);
        return message
          .reply({
            embeds: [
              client.embedBuilder
                .success(client, "​")
                .setDescription(null)
                .setAuthor({ name: message.t("commands.voicemove.single_title") })
                .addFields(
                  {
                    name: message.t("commands.voicemove.field_target"),
                    value: `<@${targetMember.id}>`,
                    inline: true,
                  },
                  {
                    name: message.t("commands.voicemove.field_channel"),
                    value: `<#${destination.id}>`,
                    inline: true,
                  },
                  { name: message.t("commands.voicemove.field_date"), value: `<t:${ts}:R>`, inline: true },
                ),
            ],
          })
          .catch(() => {});
      } catch (err) {
        return message
          .reply({
            embeds: [client.embedBuilder.error(client, message.t("commands.voicemove.move_failed"))],
          })
          .catch(() => {});
      }
    }

    // Cas 2 : Déplacer tout un salon
    const sourceChannel =
      message.guild.channels.cache.get(args[0]) ||
      message.mentions.channels.first();
    const destChannel =
      message.guild.channels.cache.get(args[1]) ||
      message.mentions.channels.last();

    if (
      sourceChannel &&
      sourceChannel.type === 2 &&
      destChannel &&
      destChannel.type === 2
    ) {
      const members = sourceChannel.members;
      if (members.size === 0)
        return message
          .reply({
            embeds: [client.embedBuilder.error(client, message.t("commands.voicemove.source_empty"))],
          })
          .catch(() => {});

      const total = members.size;
      const start = Date.now();
      const statusMsg = await message
        .reply({
          embeds: [client.embedBuilder.info(client, `0/${fmtNum(total)}`)],
        })
        .catch(() => null);

      let count = 0;
      let failed = 0;
      let processed = 0;
      for (const member of members.values()) {
        try {
          await member.voice.setChannel(destChannel);
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
        .setAuthor({ name: message.t("commands.voicemove.mass_title") })
        .addFields(
          { name: message.t("commands.voicemove.field_source"), value: `<#${sourceChannel.id}>`, inline: true },
          {
            name: message.t("commands.voicemove.field_destination"),
            value: `<#${destChannel.id}>`,
            inline: true,
          },
          { name: message.t("commands.voicemove.field_affected"), value: fmtNum(count), inline: true },
          { name: message.t("commands.voicemove.field_failed"), value: fmtNum(failed), inline: true },
          { name: message.t("commands.voicemove.field_duration"), value: message.t("commands.voicemove.duration_value", { s: elapsed }), inline: true },
        );
      if (statusMsg)
        return statusMsg
          .edit({ embeds: [finalEmbed] })
          .catch(() =>
            message.channel.send({ embeds: [finalEmbed] }).catch(() => {}),
          );
      return message.channel.send({ embeds: [finalEmbed] }).catch(() => {});
    }

    message
      .reply({
        embeds: [
          client.embedBuilder.error(
            client,
            message.t("commands.voicemove.invalid_args"),
          ),
        ],
      })
      .catch(() => {});
  },
};
