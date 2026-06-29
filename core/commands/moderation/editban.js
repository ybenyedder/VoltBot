const { PermissionFlagsBits } = require("discord.js");

module.exports = {
  name: "editban",
  description: "Modifie la raison d'un bannissement",
  category: "moderation",
  usage: "editban",
  userPerms: [PermissionFlagsBits.BanMembers],
  async execute(client, message, args) {
    if (!args[0] || !args[1]) {
      return message
        .reply({
          embeds: [
            client.embedBuilder.error(
              client,
              message.t("commands.editban.missing_args"),
            ),
          ],
        })
        .catch(() => {});
    }

    const userId = args[0].replace(/[<@!>]/g, "");
    const newReason = args.slice(1).join(" ");

    try {
      const ban = await message.guild.bans.fetch(userId);

      const banEdits = client.db.getGuild(message.guild.id, "banEdits") || [];
      banEdits.push({
        userId: ban.user.id,
        userTag: ban.user.tag,
        oldReason: ban.reason || "Aucune raison",
        newReason: newReason,
        moderator: message.author.id,
        date: new Date().toISOString(),
      });

      client.db.updateGuild(message.guild.id, { banEdits: banEdits });

      const oldReason = ban.reason || message.t("commands.editban.none");
      const embed = client.embedBuilder
        .success(client, "​")
        .setDescription(null)
        .setAuthor({ name: message.t("commands.editban.embed_title") })
        .addFields(
          { name: message.t("commands.editban.field_target"), value: `<@${ban.user.id}>`, inline: true },
          {
            name: message.t("commands.editban.field_moderator"),
            value: `<@${message.author.id}>`,
            inline: true,
          },
          {
            name: message.t("commands.editban.field_diff"),
            value: `\`\`\`diff\n- ${oldReason}\n+ ${newReason}\n\`\`\``,
            inline: false,
          },
        );

      await message.reply({ embeds: [embed] }).catch(() => {});
    } catch (error) {
      await message
        .reply({
          embeds: [
            client.embedBuilder.error(
              client,
              message.t("commands.editban.not_banned"),
            ),
          ],
        })
        .catch(() => {});
    }
  },
};
