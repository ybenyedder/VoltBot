module.exports = {
  name: "unpv",
  description: "Désactive le mode privé de votre salon vocal.",
  category: "voice",
  usage: "+unpv",
  async execute(client, message, args) {
    const vc = message.member.voice.channel;
    if (!vc)
      return message
        .reply({
          embeds: [
            client.embedBuilder.error(
              client,
              message.t("commands.unpv.join_vc_first"),
            ),
          ],
        })
        .catch(() => {});

    if (!client.pvMap.has(vc.id)) {
      return message
        .reply({
          embeds: [client.embedBuilder.error(client, message.t("commands.unpv.not_private"))],
        })
        .catch(() => {});
    }

    const pvData = client.pvMap.get(vc.id);
    if (
      pvData.ownerId !== message.author.id &&
      message.author.id !== message.guild.ownerId
    ) {
      return message
        .reply({
          embeds: [
            client.embedBuilder.error(client, message.t("commands.unpv.owner_only")),
          ],
        })
        .catch(() => {});
    }

    client.pvMap.delete(vc.id);
    client.db.deletePrivateVoice(vc.id);

    const embed = client.embedBuilder
      .success(client, message.t("commands.unpv.private_removed"))
      .setAuthor({
        name: message.t("commands.unpv.author"),
        iconURL: client.user.displayAvatarURL(),
      })
      .addFields(
        { name: message.t("commands.unpv.field_channel"), value: `${vc}`, inline: true },
        { name: message.t("commands.unpv.field_moderator"), value: `${message.author}`, inline: true },
      );

    await message.reply({ embeds: [embed] }).catch(() => {});
  },
};
