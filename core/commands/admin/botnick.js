module.exports = {
  name: "botnick",
  description: "Change le pseudo du bot sur ce serveur.",
  category: "admin",
  usage: "+botnick <nom>",
  ownerOnly: true,
  async execute(client, message, args) {
    const nick = args.join(" ");
    if (!nick) {
      return message
        .reply({
          embeds: [
            client.embedBuilder.error(
              client,
              message.t("commands.botnick.nick_required"),
            ),
          ],
        })
        .catch(() => {});
    }

    if (!message.guild.members.me.permissions.has("ChangeNickname")) {
      return message
        .reply({
          embeds: [
            client.embedBuilder.error(
              client,
              message.t("commands.botnick.missing_perm"),
            ),
          ],
        })
        .catch(() => {});
    }

    try {
      await message.guild.members.me.setNickname(nick);
      const embed = client.embedBuilder
        .success(client, message.t("commands.botnick.updated"))
        .addFields(
          { name: message.t("commands.botnick.field_action"), value: "`nickname`", inline: true },
          { name: message.t("commands.botnick.field_value"), value: `**${nick}**`, inline: true },
          {
            name: message.t("commands.botnick.field_moderator"),
            value: `<@${message.author.id}>`,
            inline: true,
          },
        );
      message.reply({ embeds: [embed] }).catch(() => {});
    } catch (e) {
      message
        .reply({
          embeds: [
            client.embedBuilder.error(client, message.t("commands.botnick.change_refused")),
          ],
        })
        .catch(() => {});
    }
  },
};
