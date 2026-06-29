const { PermissionsBitField } = require("discord.js");

module.exports = {
  name: "mp",
  aliases: ["dm", "pm"],
  description: "Envoie un message privé à un utilisateur via le bot.",
  category: "social",
  usage: "+mp <@user | ID> <message>",
  userPerms: [PermissionsBitField.Flags.Administrator],
  async execute(client, message, args) {
    if (args.length < 2) {
      return message
        .reply({
          embeds: [
            client.embedBuilder.warning(
              client,
              message.t("commands.mp.usage"),
            ),
          ],
        })
        .catch(() => {});
    }

    const target =
      message.mentions.users.first() ||
      (args[0] ? await client.users.fetch(args[0]).catch(() => null) : null);

    if (!target) {
      return message
        .reply({
          embeds: [client.embedBuilder.error(client, message.t("commands.mp.target_not_found"))],
        })
        .catch(() => {});
    }

    if (target.bot) {
      return message
        .reply({
          embeds: [
            client.embedBuilder.error(client, message.t("commands.mp.no_bot")),
          ],
        })
        .catch(() => {});
    }

    const textMsg = args.slice(1).join(" ");

    try {
      await target.send(textMsg);
      const successEmbed = client.embedBuilder
        .success(client, message.t("commands.mp.sent"))
        .setDescription(null)
        .addFields(
          { name: message.t("commands.mp.field_target"), value: `<@${target.id}>`, inline: true },
          { name: message.t("commands.mp.field_status"), value: message.t("commands.mp.status_sent"), inline: true },
        );
      return message.reply({ embeds: [successEmbed] }).catch(() => {});
    } catch (e) {
      if (e.code === 50007) {
        const errEmbed = client.embedBuilder
          .error(client, message.t("commands.mp.dm_closed"))
          .setDescription(null)
          .addFields(
            { name: message.t("commands.mp.field_target"), value: `<@${target.id}>`, inline: true },
            { name: message.t("commands.mp.field_status"), value: message.t("commands.mp.status_dm_closed"), inline: true },
          );
        return message.reply({ embeds: [errEmbed] }).catch(() => {});
      }
      const errEmbed = client.embedBuilder.error(
        client,
        message.t("commands.mp.send_failed"),
      );
      return message.reply({ embeds: [errEmbed] }).catch(() => {});
    }
  },
};
