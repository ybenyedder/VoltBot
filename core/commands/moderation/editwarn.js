const { PermissionFlagsBits } = require("discord.js");

module.exports = {
  name: "editwarn",
  description: "Modifie un avertissement d'un utilisateur",
  category: "moderation",
  usage: "editwarn",
  userPerms: [PermissionFlagsBits.ManageMessages],
  async execute(client, message, args) {
    if (!args[0] || !args[1] || !args[2]) {
      return message
        .reply({
          embeds: [
            client.embedBuilder.error(
              client,
              message.t("commands.editwarn.missing_args"),
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
              message.t("commands.editwarn.target_not_found"),
            ),
          ],
        })
        .catch(() => {});

    const warnId = parseInt(args[1]);
    if (!warnId)
      return message
        .reply({
          embeds: [
            client.embedBuilder.error(client, message.t("commands.editwarn.invalid_id")),
          ],
        })
        .catch(() => {});

    const newReason = args.slice(2).join(" ");

    const existingWarn = client.db.db
      .prepare(
        "SELECT * FROM warnings WHERE id = ? AND userId = ? AND guildId = ?",
      )
      .get(warnId, user.id, message.guild.id);

    if (!existingWarn) {
      return message
        .reply({
          embeds: [
            client.embedBuilder.error(client, message.t("commands.editwarn.warn_not_found")),
          ],
        })
        .catch(() => {});
    }

    const oldReason = existingWarn.reason;
    client.db.db
      .prepare(
        "UPDATE warnings SET reason = ? WHERE id = ? AND userId = ? AND guildId = ?",
      )
      .run(newReason, warnId, user.id, message.guild.id);

    const embed = client.embedBuilder
      .success(client, "​")
      .setDescription(null)
      .setAuthor({ name: message.t("commands.editwarn.embed_title", { id: warnId }) })
      .addFields(
        { name: message.t("commands.editwarn.field_target"), value: `<@${user.id}>`, inline: true },
        { name: message.t("commands.editwarn.field_moderator"), value: `<@${message.author.id}>`, inline: true },
        {
          name: message.t("commands.editwarn.field_diff"),
          value: `\`\`\`diff\n- ${oldReason}\n+ ${newReason}\n\`\`\``,
          inline: false,
        },
      );

    await message.reply({ embeds: [embed] }).catch(() => {});
  },
};
