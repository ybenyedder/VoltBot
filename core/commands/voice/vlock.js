const isOwner = (id) =>
  !!(
    process.env.OWNER_ID &&
    process.env.OWNER_ID.split(",")
      .map((x) => x.trim())
      .includes(id)
  );

module.exports = {
  name: "vlock",
  aliases: ["v-lock", "vocal-fermer"],
  description: "Verrouille votre salon vocal privé.",
  category: "voice",
  usage: "+vlock",
  async execute(client, message, args) {
    const vc = message.member.voice.channel;
    if (!vc)
      return message
        .reply({
          embeds: [
            client.embedBuilder.error(client, message.t("commands.vlock.join_private")),
          ],
        })
        .catch(() => {});
    if (!client.pvMap || !client.pvMap.has(vc.id))
      return message
        .reply({
          embeds: [client.embedBuilder.error(client, message.t("commands.vlock.not_private"))],
        })
        .catch(() => {});

    const pvData = client.pvMap.get(vc.id);
    if (pvData.ownerId !== message.author.id && !isOwner(message.author.id)) {
      return message
        .reply({
          embeds: [
            client.embedBuilder.error(client, message.t("commands.vlock.owner_only")),
          ],
        })
        .catch(() => {});
    }

    pvData.locked = true;
    client.pvMap.set(vc.id, pvData);
    client.db.setPrivateVoice(vc.id, pvData.guildId || message.guild.id, pvData.ownerId, pvData);

    const embed = client.embedBuilder
      .success(client, message.t("commands.vlock.locked"))
      .setAuthor({
        name: message.t("commands.vlock.author"),
        iconURL: client.user.displayAvatarURL(),
      })
      .addFields(
        { name: message.t("commands.vlock.field_channel"), value: `${vc}`, inline: true },
        { name: message.t("commands.vlock.field_mod"), value: `${message.author}`, inline: true },
      );

    await message.reply({ embeds: [embed] }).catch(() => {});
  },
};
