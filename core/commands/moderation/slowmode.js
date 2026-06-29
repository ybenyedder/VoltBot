const { PermissionsBitField } = require("discord.js");

module.exports = {
  name: "slowmode",
  description: "Définit le mode lent du salon.",
  category: "moderation",
  usage: "+slowmode [secondes (0 pour désactiver)]",
  userPerms: [PermissionsBitField.Flags.ManageChannels],
  botPerms: [PermissionsBitField.Flags.ManageChannels],
  async execute(client, message, args) {
    const time = parseInt(args[0]);

    if (isNaN(time) || time < 0 || time > 21600) {
      return message
        .reply({
          embeds: [
            client.embedBuilder.error(
              client,
              message.t("commands.slowmode.invalid_duration"),
            ),
          ],
        })
        .catch(() => {});
    }

    try {
      await message.channel.setRateLimitPerUser(
        time,
        message.t("commands.slowmode.audit_reason", { tag: message.author.tag }),
      );

      const text =
        time === 0
          ? message.t("commands.slowmode.disabled", { channel: message.channel.id })
          : message.t("commands.slowmode.set", { time, channel: message.channel.id });
      await message
        .reply({ embeds: [client.embedBuilder.success(client, text)] })
        .catch(() => {});
    } catch (err) {
      await message
        .reply({
          embeds: [
            client.embedBuilder.error(
              client,
              message.t("commands.slowmode.failed"),
            ),
          ],
        })
        .catch(() => {});
    }
  },
};
