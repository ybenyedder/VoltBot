const { PermissionFlagsBits } = require("discord.js");
const sanctionUtils = require("../../utils/sanctionUtils");

const fmtNum = (n) => new Intl.NumberFormat("fr-FR").format(n);

module.exports = {
  name: "delwarn",
  description: "Supprime un avertissement d'un utilisateur",
  category: "moderation",
  usage: "delwarn",
  userPerms: [PermissionFlagsBits.ManageMessages],
  async execute(client, message, args) {
    if (!args[0]) {
      return message
        .reply({
          embeds: [
            client.embedBuilder.error(
              client,
              message.t("commands.delwarn.missing_args"),
            ),
          ],
        })
        .catch(() => {});
    }

    const user =
      message.mentions.users.first() || client.users.cache.get(args[0]);
    if (!user)
      return message
        .reply({
          embeds: [
            client.embedBuilder.error(
              client,
              message.t("commands.delwarn.target_not_found"),
            ),
          ],
        })
        .catch(() => {});

    const warnId = parseInt(args[1]);
    if (!warnId)
      return message
        .reply({
          embeds: [
            client.embedBuilder.error(client, message.t("commands.delwarn.invalid_id")),
          ],
        })
        .catch(() => {});

    const deletedWarn = client.db.db
      .prepare(
        "SELECT * FROM warnings WHERE id = ? AND userId = ? AND guildId = ?",
      )
      .get(warnId, user.id, message.guild.id);

    if (!deletedWarn) {
      return message
        .reply({
          embeds: [
            client.embedBuilder.error(client, message.t("commands.delwarn.warn_not_found")),
          ],
        })
        .catch(() => {});
    }

    client.db.db
      .prepare(
        "DELETE FROM warnings WHERE id = ? AND userId = ? AND guildId = ?",
      )
      .run(warnId, user.id, message.guild.id);
    await sanctionUtils.sendSanctionLiftDm(
      client,
      user,
      message.guild,
      message.t("commands.delwarn.action"),
      message.t("commands.delwarn.lift_reason", { id: warnId }),
    );
    const warnings = client.db.getWarns(user.id, message.guild.id);

    const embed = client.embedBuilder
      .success(client, "​")
      .setDescription(null)
      .setAuthor({ name: message.t("commands.delwarn.title", { id: warnId }) })
      .addFields(
        { name: message.t("commands.delwarn.field_target"), value: `<@${user.id}>`, inline: true },
        { name: message.t("commands.delwarn.field_moderator"), value: `<@${message.author.id}>`, inline: true },
        { name: message.t("commands.delwarn.field_remaining"), value: fmtNum(warnings.length), inline: true },
        { name: message.t("commands.delwarn.field_reason"), value: deletedWarn.reason, inline: false },
      );

    await message.reply({ embeds: [embed] }).catch(() => {});
  },
};
