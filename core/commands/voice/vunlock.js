const isOwner = (id) =>
  !!(
    process.env.OWNER_ID &&
    process.env.OWNER_ID.split(",")
      .map((x) => x.trim())
      .includes(id)
  );

module.exports = {
  name: "vunlock",
  aliases: ["v-unlock", "vocal-ouvrir"],
  description: "Déverrouille votre salon vocal privé.",
  category: "voice",
  usage: "+vunlock",
  async execute(client, message, args) {
    const vc = message.member.voice.channel;
    if (!vc)
      return message
        .reply({
          embeds: [
            client.embedBuilder.error(client, message.t("commands.vunlock.join_private")),
          ],
        })
        .catch(() => {});
    if (!client.pvMap || !client.pvMap.has(vc.id))
      return message
        .reply({
          embeds: [client.embedBuilder.error(client, message.t("commands.vunlock.not_private"))],
        })
        .catch(() => {});

    const pvData = client.pvMap.get(vc.id);
    if (pvData.ownerId !== message.author.id && !isOwner(message.author.id)) {
      return message
        .reply({
          embeds: [
            client.embedBuilder.error(client, message.t("commands.vunlock.owner_only")),
          ],
        })
        .catch(() => {});
    }

    pvData.locked = false;
    client.pvMap.set(vc.id, pvData);
    client.db.setPrivateVoice(vc.id, message.guild.id, pvData.ownerId, pvData);

    const embed = client.embedBuilder
      .success(client, message.t("commands.vunlock.unlock_applied"))
      .setAuthor({
        name: message.t("commands.vunlock.author_name"),
        iconURL: client.user.displayAvatarURL(),
      })
      .addFields(
        { name: message.t("commands.vunlock.field_channel"), value: `${vc}`, inline: true },
        { name: message.t("commands.vunlock.field_moderator"), value: `${message.author}`, inline: true },
      );

    await message.reply({ embeds: [embed] }).catch(() => {});
  },
};
