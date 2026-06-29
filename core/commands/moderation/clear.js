const { PermissionFlagsBits } = require("discord.js");
const { t } = require("../../utils/i18n");

const fmtNum = (n) => new Intl.NumberFormat("fr-FR").format(n);

module.exports = {
  name: "clear",
  aliases: ["purge", "nuke", "effacer", "c", "clean"],
  description:
    "Supprime un certain nombre de messages, éventuellement d'un membre spécifique.",
  category: "moderation",
  usage: "+clear [nombre] [membre]",
  userPerms: [PermissionFlagsBits.ManageMessages],
  botPerms: [PermissionFlagsBits.ManageMessages],
  async execute(client, message, args) {
    const lang = client.db.getGuild(message.guild.id, "language") || "fr";

    let amount = parseInt(args[0]);
    let target =
      message.mentions.members.first() ||
      message.guild.members.cache.get(args[1]) ||
      message.guild.members.cache.get(args[0]);

    if (isNaN(amount)) {
      amount = 100;
      target =
        message.mentions.members.first() ||
        message.guild.members.cache.get(args[0]);
    } else {
      if (args[1]) {
        target =
          message.mentions.members.first() ||
          message.guild.members.cache.get(args[1]);
      }
    }

    if (amount < 1 || amount > 100) {
      return message
        .reply({
          embeds: [
            client.embedBuilder.error(
              client,
              t(lang, "commands.clear.invalid_amount"),
            ),
          ],
        })
        .catch(() => {});
    }

    try {
      await message.delete().catch(() => {});
      let messages = await message.channel.messages.fetch({
        limit: target ? 100 : amount,
      });

      if (target) {
        messages = messages
          .filter((m) => m.author.id === target.id)
          .first(amount);
      }

      if (
        !messages ||
        (Array.isArray(messages) ? messages.length === 0 : messages.size === 0)
      ) {
        const reply = await message.channel.send({
          embeds: [
            client.embedBuilder.error(
              client,
              t(lang, "commands.clear.no_messages"),
            ),
          ],
        });
        setTimeout(() => reply.delete().catch(() => {}), 5000);
        return;
      }

      const deletedMessages = await message.channel.bulkDelete(messages, true);
      const total = Array.isArray(messages) ? messages.length : messages.size;

      const embed = client.embedBuilder
        .success(client, "​")
        .setDescription(null)
        .setAuthor({ name: "Suppression" })
        .addFields(
          {
            name: t(lang, "commands.purge.field_deleted"),
            value: `${fmtNum(deletedMessages.size)}/${fmtNum(total)}`,
            inline: true,
          },
          {
            name: "Salon",
            value: `<#${message.channel.id}>`,
            inline: true,
          },
          {
            name: t(lang, "commands.purge.field_moderator"),
            value: `<@${message.author.id}>`,
            inline: true,
          },
        );
      if (target) {
        embed.addFields({
          name: "Auteur",
          value: `<@${target.id}>`,
          inline: true,
        });
      }

      const reply = await message.channel.send({ embeds: [embed] });
      setTimeout(() => reply.delete().catch(() => {}), 5000);
    } catch (error) {
      message.channel
        .send({
          embeds: [
            client.embedBuilder.error(client, t(lang, "commands.clear.error")),
          ],
        })
        .catch(() => {});
    }
  },
};
