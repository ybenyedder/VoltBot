const isOwner = (id) =>
  !!(
    process.env.OWNER_ID &&
    process.env.OWNER_ID.split(",")
      .map((x) => x.trim())
      .includes(id)
  );

module.exports = {
  name: "vghost",
  description: "Rend votre salon vocal invisible pour les autres.",
  category: "voice",
  usage: "+vghost",
  async execute(client, message, args) {
    const vc = message.member.voice.channel;
    if (!vc)
      return message
        .reply({
          embeds: [
            client.embedBuilder.error(client, message.t("commands.vghost.join_private")),
          ],
        })
        .catch(() => {});
    if (!client.pvMap || !client.pvMap.has(vc.id))
      return message
        .reply({
          embeds: [client.embedBuilder.error(client, message.t("commands.vghost.not_private"))],
        })
        .catch(() => {});

    const pvData = client.pvMap.get(vc.id);
    if (pvData.ownerId !== message.author.id && !isOwner(message.author.id)) {
      return message
        .reply({
          embeds: [
            client.embedBuilder.error(client, message.t("commands.vghost.owner_only")),
          ],
        })
        .catch(() => {});
    }

    await vc.permissionOverwrites
      .edit(message.guild.id, { ViewChannel: false })
      .catch(() => {});

    const embed = client.embedBuilder
      .success(client, message.t("commands.vghost.hidden"))
      .setAuthor({
        name: message.t("commands.vghost.title"),
        iconURL: client.user.displayAvatarURL(),
      })
      .addFields(
        { name: message.t("commands.vghost.field_channel"), value: `${vc}`, inline: true },
        { name: message.t("commands.vghost.field_mod"), value: `${message.author}`, inline: true },
      );

    await message.reply({ embeds: [embed] }).catch(() => {});
  },
};
