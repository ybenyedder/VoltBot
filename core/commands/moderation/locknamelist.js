const { PermissionFlagsBits } = require("discord.js");

module.exports = {
  name: "locknamelist",
  aliases: ["listlockname", "pseudo-list", "liste-pseudos", "lockednames"],
  description: "Affiche la liste des pseudos verrouillés",
  category: "moderation",
  usage: "locknamelist",
  userPerms: [PermissionFlagsBits.ManageNicknames],
  async execute(client, message, args) {
    const lockedNames =
      client.db.getGuild(message.guild.id, "lockedNames") || [];

    if (lockedNames.length === 0) {
      return message
        .reply({
          embeds: [
            client.embedBuilder.info(client, message.t("commands.locknamelist.none")),
          ],
        })
        .catch(() => {});
    }

    const embed = client.embedBuilder
      .base(client, message.t("commands.locknamelist.title"), message.t("commands.locknamelist.total", { count: lockedNames.length }))
      .addFields(
        ...lockedNames.slice(0, 24).map((lock, index) => ({
          name: `${index + 1}. ${lock.username}`,
          value: `\`${lock.nickname}\`\n <@${lock.moderator}>\n<t:${Math.floor(new Date(lock.date).getTime() / 1000)}:D>`,
          inline: true,
        })),
        {
          name: message.t("commands.locknamelist.field_actions"),
          value: message.t("commands.locknamelist.actions_value"),
          inline: false,
        },
      );

    await message.reply({ embeds: [embed] }).catch(() => {});
  },
};
