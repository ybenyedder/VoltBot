const { PermissionFlagsBits } = require("discord.js");

module.exports = {
  name: "mutelist",
  description: "Affiche la liste des utilisateurs mutés",
  category: "moderation",
  usage: "mutelist",
  userPerms: [PermissionFlagsBits.ModerateMembers],
  async execute(client, message, args) {
    const mutedMembers = message.guild.members.cache.filter((member) =>
      member.isCommunicationDisabled(),
    );

    if (mutedMembers.size === 0) {
      return message
        .reply({
          embeds: [
            client.embedBuilder.info(
              client,
              message.t("commands.mutelist.no_muted"),
            ),
          ],
        })
        .catch(() => {});
    }

    const embed = client.embedBuilder
      .base(
        client,
        message.t("commands.mutelist.title"),
        message.t("commands.mutelist.total", { count: mutedMembers.size }),
      )
      .addFields(
        ...Array.from(mutedMembers.values())
          .slice(0, 24)
          .map((member, index) => ({
            name: `${index + 1}. ${member.user.tag}`,
            value: `\`${member.id}\`\n ${member.communicationDisabledUntil ? `<t:${Math.floor(member.communicationDisabledUntil.getTime() / 1000)}:R>` : message.t("commands.mutelist.undefined")}`,
            inline: true,
          })),
        {
          name: message.t("commands.mutelist.field_actions"),
          value: message.t("commands.mutelist.actions_hint"),
          inline: false,
        },
      );

    await message.reply({ embeds: [embed] }).catch(() => {});
  },
};
