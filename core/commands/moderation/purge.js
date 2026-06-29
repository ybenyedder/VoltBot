const { PermissionsBitField } = require("discord.js");

const fmtNum = (n) => new Intl.NumberFormat("fr-FR").format(n);

module.exports = {
  name: "purge",
  aliases: ["clear"],
  description: "Supprime un certain nombre de messages dans le salon.",
  category: "moderation",
  usage: "+purge [nombre]",
  userPerms: [PermissionsBitField.Flags.ManageMessages],
  botPerms: [PermissionsBitField.Flags.ManageMessages],
  async execute(client, message, args) {
    const amount = parseInt(args[0]);

    if (isNaN(amount) || amount < 1 || amount > 99) {
      return message
        .reply({
          embeds: [
            client.embedBuilder.error(
              client,
              message.t("commands.purge.invalid_number"),
            ),
          ],
        })
        .catch(() => {});
    }

    try {
      await message.delete().catch(() => {});
      const messages = await message.channel.messages.fetch({ limit: amount });

      if (messages.size === 0) {
        const empty = await message.channel
          .send({
            embeds: [
              client.embedBuilder.error(
                client,
                message.t("commands.purge.no_messages"),
              ),
            ],
          })
          .catch(() => null);
        if (empty) setTimeout(() => empty.delete().catch(() => {}), 5000);
        return;
      }

      const deletedMessages = await message.channel.bulkDelete(messages, true);

      const reply = await message.channel
        .send({
          embeds: [
            client.embedBuilder
              .success(client, "​")
              .setDescription(null)
              .setAuthor({ name: message.t("commands.purge.title") })
              .addFields(
                {
                  name: message.t("commands.purge.field_deleted"),
                  value: `${fmtNum(deletedMessages.size)}/${fmtNum(amount)}`,
                  inline: true,
                },
                {
                  name: message.t("commands.purge.field_channel"),
                  value: `<#${message.channel.id}>`,
                  inline: true,
                },
                {
                  name: message.t("commands.purge.field_moderator"),
                  value: `<@${message.author.id}>`,
                  inline: true,
                },
              ),
          ],
        })
        .catch(() => null);
      if (reply) setTimeout(() => reply.delete().catch(() => {}), 5000);

      const guildSettings = client.db.getGuild(message.guild.id);
      if (guildSettings.modLogsChannel) {
        const logChannel = message.guild.channels.cache.get(
          guildSettings.modLogsChannel,
        );
        if (logChannel) {
          logChannel
            .send({
              embeds: [
                client.embedBuilder.modLog(
                  client,
                  message.t("commands.purge.title"),
                  client.user,
                  message.author,
                  message.t("commands.purge.log_reason"),
                  [
                    {
                      name: message.t("commands.purge.field_channel"),
                      value: `<#${message.channel.id}>`,
                      inline: true,
                    },
                    {
                      name: message.t("commands.purge.field_quantity"),
                      value: fmtNum(amount),
                      inline: true,
                    },
                  ],
                  message.lang,
                ),
              ],
            })
            .catch(() => {});
        }
      }
    } catch (err) {
      message
        .reply({
          embeds: [
            client.embedBuilder.error(
              client,
              message.t("commands.purge.delete_failed"),
            ),
          ],
        })
        .catch(() => {});
    }
  },
};
