const { PermissionsBitField } = require("discord.js");

module.exports = {
  name: "bring",
  description: "Ramène un utilisateur dans votre salon vocal.",
  category: "voice",
  usage: "+bring <@user> [@user2 ...]",
  async execute(client, message, args) {
    const vc = message.member.voice.channel;
    if (!vc)
      return message
        .reply({
          embeds: [
            client.embedBuilder.error(client, message.t("commands.bring.join_vc")),
          ],
        })
        .catch(() => {});

    const owners = process.env.OWNER_ID
      ? process.env.OWNER_ID.split(",").map((id) => id.trim())
      : [];
    const isAdmin =
      message.member.permissions.has(PermissionsBitField.Flags.Administrator) ||
      owners.includes(message.author.id);

    const pvData =
      (client.pvMap && client.pvMap.get(vc.id)) || null;
    if (pvData) {
      if (pvData.ownerId !== message.author.id && !isAdmin) {
        return message
          .reply({
            embeds: [
              client.embedBuilder.error(
                client,
                message.t("commands.bring.owner_or_admin"),
              ),
            ],
          })
          .catch(() => {});
      }
    } else {
      if (
        !message.member.permissions.has(
          PermissionsBitField.Flags.MoveMembers,
        ) &&
        !isAdmin
      ) {
        return message
          .reply({
            embeds: [
              client.embedBuilder.error(
                client,
                message.t("commands.bring.missing_move_perm"),
              ),
            ],
          })
          .catch(() => {});
      }
    }

    const targets = [];
    const seen = new Set();
    message.mentions.members.forEach((m) => {
      if (!seen.has(m.id)) {
        seen.add(m.id);
        targets.push(m);
      }
    });
    for (const a of args) {
      const m = message.guild.members.cache.get(a);
      if (m && !seen.has(m.id)) {
        seen.add(m.id);
        targets.push(m);
      }
    }

    if (targets.length === 0)
      return message
        .reply({
          embeds: [
            client.embedBuilder.error(
              client,
              message.t("commands.bring.target_not_found"),
            ),
          ],
        })
        .catch(() => {});

    const buildStatus = (state, pulled, failed, total) =>
      client.embedBuilder[state === "done" ? "success" : "info"](
        client,
        state === "done"
          ? message.t("commands.bring.operation_done")
          : message.t("commands.bring.processing", { current: pulled + failed, total }),
      )
        .setAuthor({
          name: message.t("commands.bring.author"),
          iconURL: client.user.displayAvatarURL(),
        })
        .addFields(
          { name: message.t("commands.bring.field_channel"), value: `${vc}`, inline: true },
          { name: message.t("commands.bring.field_pulled"), value: `\`${pulled}\``, inline: true },
          { name: message.t("commands.bring.field_failed"), value: `\`${failed}\``, inline: true },
        );

    let reply;
    if (targets.length > 1) {
      reply = await message
        .reply({ embeds: [buildStatus("progress", 0, 0, targets.length)] })
        .catch(() => null);
    }

    let pulled = 0;
    let failed = 0;
    for (const target of targets) {
      if (!target.voice.channel) {
        failed++;
      } else if (target.voice.channelId === vc.id) {
        pulled++;
      } else {
        try {
          await target.voice.setChannel(vc);
          pulled++;
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
      }
      if ((pulled + failed) % 5 === 0) {
        await new Promise((r) => setTimeout(r, 120));
      }
      if (reply && (pulled + failed) % 3 === 0) {
        await reply
          .edit({
            embeds: [buildStatus("progress", pulled, failed, targets.length)],
          })
          .catch(() => {});
      }
    }

    const finalEmbed =
      targets.length === 1
        ? client.embedBuilder[pulled === 1 ? "success" : "error"](
            client,
            pulled === 1 ? message.t("commands.bring.target_pulled") : message.t("commands.bring.move_failed"),
          )
            .setAuthor({
              name: message.t("commands.bring.author"),
              iconURL: client.user.displayAvatarURL(),
            })
            .addFields(
              { name: message.t("commands.bring.field_channel"), value: `${vc}`, inline: true },
              { name: message.t("commands.bring.field_target"), value: `${targets[0]}`, inline: true },
              { name: message.t("commands.bring.field_moderator"), value: `${message.author}`, inline: true },
            )
        : buildStatus("done", pulled, failed, targets.length).addFields({
            name: message.t("commands.bring.field_moderator"),
            value: `${message.author}`,
            inline: true,
          });

    if (reply) {
      await reply.edit({ embeds: [finalEmbed] }).catch(() => {});
    } else {
      await message.reply({ embeds: [finalEmbed] }).catch(() => {});
    }
  },
};
