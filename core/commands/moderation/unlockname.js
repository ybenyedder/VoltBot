const { PermissionFlagsBits } = require("discord.js");
const sanctionUtils = require("../../utils/sanctionUtils");

module.exports = {
  name: "unlockname",
  aliases: ["unlocknick", "pseudo-unlock", "deverrouiller-pseudo"],
  description: "Déverrouille le changement de pseudo d'un utilisateur",
  category: "moderation",
  usage: "unlockname",
  userPerms: [PermissionFlagsBits.ManageNicknames],
  async execute(client, message, args) {
    if (!args[0]) {
      return message
        .reply({
          embeds: [
            client.embedBuilder.error(
              client,
              message.t("commands.unlockname.usage"),
            ),
          ],
        })
        .catch(() => {});
    }

    const member =
      message.mentions.members.first() ||
      message.guild.members.cache.get(args[0]);
    if (!member)
      return message
        .reply({
          embeds: [
            client.embedBuilder.error(client, message.t("commands.unlockname.user_not_found")),
          ],
        })
        .catch(() => {});

    const lockedNames =
      client.db.getGuild(message.guild.id, "lockedNames") || [];
    const lockIndex = lockedNames.findIndex((l) => l.userId === member.id);

    if (lockIndex === -1) {
      return message
        .reply({
          embeds: [
            client.embedBuilder.error(
              client,
              message.t("commands.unlockname.not_locked"),
            ),
          ],
        })
        .catch(() => {});
    }

    const removedLock = lockedNames[lockIndex];
    lockedNames.splice(lockIndex, 1);
    client.db.updateGuild(message.guild.id, { lockedNames });
    await sanctionUtils.sendSanctionLiftDm(
      client,
      member,
      message.guild,
      "verrouillage de pseudo",
      message.t("commands.unlockname.lift_reason"),
    );

    const embed = client.embedBuilder
      .success(client, message.t("commands.unlockname.nickname_unlocked", { tag: member.user.tag }))
      .addFields(
        {
          name: message.t("commands.unlockname.field_old_nickname"),
          value: removedLock.nickname,
          inline: true,
        },
        { name: message.t("commands.unlockname.field_moderator"), value: message.author.tag, inline: true },
      );

    await message.reply({ embeds: [embed] }).catch(() => {});
  },
};
