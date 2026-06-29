const isOwner = (id) =>
  !!(
    process.env.OWNER_ID &&
    process.env.OWNER_ID.split(",")
      .map((x) => x.trim())
      .includes(id)
  );

module.exports = {
  name: "vbitrate",
  description: "Définit le bitrate (qualité audio) de votre salon privé.",
  category: "voice",
  usage: "+vbitrate <kbps>",
  async execute(client, message, args) {
    const vc = message.member.voice.channel;
    if (!vc)
      return message
        .reply({
          embeds: [
            client.embedBuilder.error(client, message.t("commands.vbitrate.join_private")),
          ],
        })
        .catch(() => {});
    if (!client.pvMap || !client.pvMap.has(vc.id))
      return message
        .reply({
          embeds: [client.embedBuilder.error(client, message.t("commands.vbitrate.not_private"))],
        })
        .catch(() => {});

    const pvData = client.pvMap.get(vc.id);
    if (pvData.ownerId !== message.author.id && !isOwner(message.author.id)) {
      return message
        .reply({
          embeds: [
            client.embedBuilder.error(client, message.t("commands.vbitrate.owner_only")),
          ],
        })
        .catch(() => {});
    }

    const kbps = parseInt(args[0]);
    if (isNaN(kbps) || kbps < 8 || kbps > 96) {
      return message
        .reply({
          embeds: [
            client.embedBuilder.error(
              client,
              message.t("commands.vbitrate.invalid_bitrate"),
            ),
          ],
        })
        .catch(() => {});
    }

    await vc.setBitrate(kbps * 1000).catch(() => {});

    const embed = client.embedBuilder
      .success(client, message.t("commands.vbitrate.updated"))
      .setAuthor({
        name: message.t("commands.vbitrate.title"),
        iconURL: client.user.displayAvatarURL(),
      })
      .addFields(
        { name: message.t("commands.vbitrate.field_channel"), value: `${vc}`, inline: true },
        { name: message.t("commands.vbitrate.field_bitrate"), value: `\`${kbps} kbps\``, inline: true },
        { name: message.t("commands.vbitrate.field_mod"), value: `${message.author}`, inline: true },
      );

    await message.reply({ embeds: [embed] }).catch(() => {});
  },
};
