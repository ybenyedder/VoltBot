const isOwner = (id) =>
  !!(
    process.env.OWNER_ID &&
    process.env.OWNER_ID.split(",")
      .map((x) => x.trim())
      .includes(id)
  );

module.exports = {
  name: "vunghost",
  description: "Rend votre salon vocal visible à nouveau.",
  category: "voice",
  usage: "+vunghost",
  async execute(client, message, args) {
    const vc = message.member.voice.channel;
    if (!vc)
      return message
        .reply({
          embeds: [
            client.embedBuilder.error(client, message.t("commands.vunghost.join_private")),
          ],
        })
        .catch(() => {});
    if (!client.pvMap || !client.pvMap.has(vc.id))
      return message
        .reply({
          embeds: [client.embedBuilder.error(client, message.t("commands.vunghost.not_private"))],
        })
        .catch(() => {});

    const pvData = client.pvMap.get(vc.id);
    if (pvData.ownerId !== message.author.id && !isOwner(message.author.id)) {
      return message
        .reply({
          embeds: [
            client.embedBuilder.error(client, message.t("commands.vunghost.owner_only")),
          ],
        })
        .catch(() => {});
    }

    await vc.permissionOverwrites
      .edit(message.guild.id, { ViewChannel: null })
      .catch(() => {});

    const embed = client.embedBuilder
      .success(client, message.t("commands.vunghost.shown"))
      .setAuthor({
        name: message.t("commands.vunghost.author"),
        iconURL: client.user.displayAvatarURL(),
      })
      .addFields(
        { name: message.t("commands.vunghost.field_channel"), value: `${vc}`, inline: true },
        { name: message.t("commands.vunghost.field_mod"), value: `${message.author}`, inline: true },
      );

    await message.reply({ embeds: [embed] }).catch(() => {});
  },
};
