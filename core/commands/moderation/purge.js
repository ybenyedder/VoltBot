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
    // Sans argument → 100 par défaut
    const amount = args[0] ? parseInt(args[0]) : 100;

    if (isNaN(amount) || amount < 1 || amount > 1000) {
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

      // bulkDelete max 100 par batch, on boucle si besoin
      let totalDeleted = 0;
      let remaining = amount;

      while (remaining > 0) {
        const batchSize = Math.min(remaining, 100);
        const messages = await message.channel.messages.fetch({ limit: batchSize });
        if (messages.size === 0) break;

        const deleted = await message.channel.bulkDelete(messages, true);
        totalDeleted += deleted.size;
        remaining -= batchSize;

        // Si Discord a rien supprimé (messages >14j), on arrête
        if (deleted.size === 0) break;
        if (remaining > 0) await new Promise(r => setTimeout(r, 1000));
      }

      const reply = await message.channel
        .send({
          embeds: [
            client.embedBuilder
              .success(client, "\u200b")
              .setDescription(null)
              .setAuthor({ name: message.t("commands.purge.title") })
              .addFields(
                {
                  name: message.t("commands.purge.field_deleted"),
                  value: `${fmtNum(totalDeleted)}/${fmtNum(amount)}`,
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
