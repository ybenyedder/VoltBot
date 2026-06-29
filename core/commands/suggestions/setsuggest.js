const { PermissionsBitField, ChannelType } = require("discord.js");

module.exports = {
  name: "setsuggest",
  description: "Définit le salon où les suggestions seront envoyées.",
  category: "suggestions",
  usage: "+setsuggest [#salon]",
  userPerms: [PermissionsBitField.Flags.Administrator],
  async execute(client, message, args) {
    const channel =
      message.mentions.channels.first() ||
      (args[0] ? message.guild.channels.cache.get(args[0]) : null);

    if (!channel || channel.type !== ChannelType.GuildText) {
      return message
        .reply({
          embeds: [
            client.embedBuilder.error(
              client,
              message.t("commands.setsuggest.invalid_channel"),
            ),
          ],
        })
        .catch(() => {});
    }

    const me = message.guild.members.me;
    if (
      me &&
      !channel
        .permissionsFor(me)
        ?.has([
          PermissionsBitField.Flags.ViewChannel,
          PermissionsBitField.Flags.SendMessages,
          PermissionsBitField.Flags.EmbedLinks,
        ])
    ) {
      return message
        .reply({
          embeds: [
            client.embedBuilder.warning(
              client,
              message.t("commands.setsuggest.missing_perms", {
                channel: channel,
              }),
            ),
          ],
        })
        .catch(() => {});
    }

    try {
      client.db.db
        .prepare("ALTER TABLE guilds ADD COLUMN suggestChannel TEXT")
        .run();
    } catch (e) {}

    try {
      client.db.updateGuild(message.guild.id, { suggestChannel: channel.id });
    } catch (e) {
      return message
        .reply({
          embeds: [
            client.embedBuilder.error(
              client,
              message.t("commands.setsuggest.save_failed"),
            ),
          ],
        })
        .catch(() => {});
    }

    const confirm = client.embedBuilder
      .success(client, message.t("commands.setsuggest.channel_set"))
      .addFields(
        {
          name: message.t("commands.setsuggest.field_channel"),
          value: `${channel}`,
          inline: true,
        },
        {
          name: message.t("commands.setsuggest.field_moderator"),
          value: `${message.author}`,
          inline: true,
        },
      );

    await message.reply({ embeds: [confirm] }).catch(() => {});
  },
};
