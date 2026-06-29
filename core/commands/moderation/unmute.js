const { PermissionsBitField } = require("discord.js");
const permissions = require("../../utils/permissions");
const sanctionUtils = require("../../utils/sanctionUtils");

const fmtNum = (n) => new Intl.NumberFormat("fr-FR").format(n);

module.exports = {
  name: "unmute",
  aliases: ["untimeout"],
  description: "Annule le timeout d'un membre.",
  category: "moderation",
  usage: "+unmute @user",
  userPerms: [PermissionsBitField.Flags.ModerateMembers],
  botPerms: [PermissionsBitField.Flags.ModerateMembers],
  async execute(client, message, args) {
    if (args[0] === "all") {
      const timedOutMembers = message.guild.members.cache.filter((m) =>
        m.isCommunicationDisabled(),
      );
      if (timedOutMembers.size === 0) {
        return message
          .reply({
            embeds: [
              client.embedBuilder.error(client, message.t("commands.unmute.no_timed_out")),
            ],
          })
          .catch(() => {});
      }

      const total = timedOutMembers.size;
      const start = Date.now();
      const statusMsg = await message
        .reply({
          embeds: [client.embedBuilder.info(client, `0/${fmtNum(total)}`)],
        })
        .catch(() => null);

      let count = 0;
      let failed = 0;
      let processed = 0;
      for (const target of timedOutMembers.values()) {
        try {
          await target.timeout(null, `Unmute All par ${message.author.tag}`);
          await sanctionUtils.sendSanctionLiftDm(
            client,
            target,
            message.guild,
            "mute",
            `Unmute All par ${message.author.tag}`,
          );
          count++;
        } catch {
          failed++;
        }
        processed++;
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
        .setAuthor({ name: message.t("commands.unmute.mass_unmute_title") })
        .addFields(
          { name: message.t("commands.unmute.field_affected"), value: fmtNum(count), inline: true },
          { name: message.t("commands.unmute.field_failed"), value: fmtNum(failed), inline: true },
          { name: message.t("commands.unmute.field_duration"), value: `${elapsed} s`, inline: true },
        );
      if (statusMsg)
        return statusMsg
          .edit({ embeds: [finalEmbed] })
          .catch(() =>
            message.channel.send({ embeds: [finalEmbed] }).catch(() => {}),
          );
      return message.channel.send({ embeds: [finalEmbed] }).catch(() => {});
    }

    const target =
      message.mentions.members.first() ||
      message.guild.members.cache.get(args[0]);
    if (!target)
      return message
        .reply({
          embeds: [
            client.embedBuilder.error(
              client,
              message.t("commands.unmute.target_not_found"),
            ),
          ],
        })
        .catch(() => {});

    if (!target.isCommunicationDisabled()) {
      return message
        .reply({
          embeds: [client.embedBuilder.error(client, message.t("commands.unmute.target_not_muted"))],
        })
        .catch(() => {});
    }

    try {
      await target.timeout(null, `Unmute par ${message.author.tag}`);
      await sanctionUtils.sendSanctionLiftDm(
        client,
        target,
        message.guild,
        "mute",
        `Unmute par ${message.author.tag}`,
      );
      const ts = Math.floor(Date.now() / 1000);
      const embed = client.embedBuilder
        .success(client, "​")
        .setDescription(null)
        .setAuthor({
          name: message.t("commands.unmute.unmute_title"),
          iconURL: target.user.displayAvatarURL({ size: 256 }),
        })
        .setThumbnail(target.user.displayAvatarURL({ size: 256 }))
        .addFields(
          { name: message.t("commands.unmute.field_target"), value: `<@${target.id}>`, inline: true },
          {
            name: message.t("commands.unmute.field_moderator"),
            value: `<@${message.author.id}>`,
            inline: true,
          },
          { name: message.t("commands.unmute.field_date"), value: `<t:${ts}:R>`, inline: true },
        );
      await message.reply({ embeds: [embed] }).catch(() => {});

      const guildSettings = client.db.getGuild(message.guild.id);
      if (guildSettings.modLogsChannel) {
        const logChannel = message.guild.channels.cache.get(
          guildSettings.modLogsChannel,
        );
        if (logChannel) {
          logChannel
            .send({
              embeds: [
                client.embedBuilder.modLog(
                  client,
                  message.t("commands.unmute.modlog_action"),
                  target.user,
                  message.author,
                  message.t("commands.unmute.modlog_reason"),
                  message.lang,
                ),
              ],
            })
            .catch(() => {});
        }
      }
    } catch (error) {
      await message
        .reply({
          embeds: [client.embedBuilder.error(client, message.t("commands.unmute.unmute_failed"))],
        })
        .catch(() => {});
    }
  },
};
