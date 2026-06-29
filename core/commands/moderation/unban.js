const { PermissionsBitField } = require("discord.js");
const permissions = require("../../utils/permissions");
const sanctionUtils = require("../../utils/sanctionUtils");

const fmtNum = (n) => new Intl.NumberFormat("fr-FR").format(n);

module.exports = {
  name: "unban",
  aliases: ["ub", "pardon"],
  description: "Débannit un utilisateur ou tous les utilisateurs du serveur.",
  category: "moderation",
  usage: "+unban <membre/all>",
  userPerms: [PermissionsBitField.Flags.BanMembers],
  botPerms: [PermissionsBitField.Flags.BanMembers],
  async execute(client, message, args) {
    if (args[0] === "all") {
      const bans = await message.guild.bans.fetch();
      if (bans.size === 0) {
        return message
          .reply({
            embeds: [
              client.embedBuilder.error(client, message.t("commands.unban.no_banned_user")),
            ],
          })
          .catch(() => {});
      }

      const total = bans.size;
      const start = Date.now();
      const statusMsg = await message
        .reply({
          embeds: [client.embedBuilder.info(client, `0/${fmtNum(total)}`)],
        })
        .catch(() => null);

      let count = 0;
      let failed = 0;
      let processed = 0;
      for (const ban of bans.values()) {
        try {
          await message.guild.bans.remove(
            ban.user,
            `Unban All par ${message.author.tag}`,
          );
          await sanctionUtils.sendSanctionLiftDm(
            client,
            ban.user,
            message.guild,
            "bannissement",
            message.t("commands.unban.lift_reason", { tag: message.author.tag }),
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
        .setAuthor({ name: message.t("commands.unban.mass_unban_title") })
        .addFields(
          { name: message.t("commands.unban.field_affected"), value: fmtNum(count), inline: true },
          { name: message.t("commands.unban.field_failed"), value: fmtNum(failed), inline: true },
          { name: message.t("commands.unban.field_duration"), value: `${elapsed} s`, inline: true },
        );
      if (statusMsg)
        return statusMsg
          .edit({ embeds: [finalEmbed] })
          .catch(() =>
            message.channel.send({ embeds: [finalEmbed] }).catch(() => {}),
          );
      return message.channel.send({ embeds: [finalEmbed] }).catch(() => {});
    }

    const userId = args[0]?.replace(/[<@!>]/g, "");
    if (!userId || !/^\d{17,19}$/.test(userId)) {
      return message
        .reply({
          embeds: [
            client.embedBuilder.error(
              client,
              message.t("commands.unban.invalid_id"),
            ),
          ],
        })
        .catch(() => {});
    }

    try {
      const ban = await message.guild.bans.fetch(userId);
      await message.guild.bans.remove(
        ban.user,
        message.t("commands.unban.audit_reason", { tag: message.author.tag }),
      );
      await sanctionUtils.sendSanctionLiftDm(
        client,
        ban.user,
        message.guild,
        "bannissement",
        message.t("commands.unban.lift_reason", { tag: message.author.tag }),
      );
      const ts = Math.floor(Date.now() / 1000);
      const embed = client.embedBuilder
        .success(client, "​")
        .setDescription(null)
        .setAuthor({
          name: message.t("commands.unban.unban_title"),
          iconURL: ban.user.displayAvatarURL({ size: 256 }),
        })
        .setThumbnail(ban.user.displayAvatarURL({ size: 256 }))
        .addFields(
          { name: message.t("commands.unban.field_target"), value: `<@${ban.user.id}>`, inline: true },
          {
            name: message.t("commands.unban.field_moderator"),
            value: `<@${message.author.id}>`,
            inline: true,
          },
          { name: message.t("commands.unban.field_date"), value: `<t:${ts}:R>`, inline: true },
        );
      await message.reply({ embeds: [embed] }).catch(() => {});
    } catch (err) {
      await message
        .reply({
          embeds: [
            client.embedBuilder.error(
              client,
              message.t("commands.unban.not_banned_or_invalid"),
            ),
          ],
        })
        .catch(() => {});
    }
  },
};
