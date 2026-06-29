const isOwner = (id) =>
  !!(
    process.env.OWNER_ID &&
    process.env.OWNER_ID.split(",")
      .map((x) => x.trim())
      .includes(id)
  );

module.exports = {
  name: "vunban",
  description: "Débannit un utilisateur de votre salon privé.",
  category: "voice",
  usage: "+vunban <@user>",
  async execute(client, message, args) {
    const vc = message.member.voice.channel;
    if (!vc)
      return message
        .reply({
          embeds: [
            client.embedBuilder.error(client, message.t("commands.vunban.join_private")),
          ],
        })
        .catch(() => {});
    if (!client.pvMap || !client.pvMap.has(vc.id))
      return message
        .reply({
          embeds: [client.embedBuilder.error(client, message.t("commands.vunban.not_private"))],
        })
        .catch(() => {});

    const pvData = client.pvMap.get(vc.id);
    if (pvData.ownerId !== message.author.id && !isOwner(message.author.id)) {
      return message
        .reply({
          embeds: [
            client.embedBuilder.error(client, message.t("commands.vunban.owner_only")),
          ],
        })
        .catch(() => {});
    }

    const target =
      message.mentions.members.first() ||
      message.guild.members.cache.get(args[0]);
    if (!target)
      return message
        .reply({
          embeds: [
            client.embedBuilder.error(
              client,
              message.t("commands.vunban.target_not_found"),
            ),
          ],
        })
        .catch(() => {});

    if (!pvData.blacklist || !pvData.blacklist.includes(target.id)) {
      return message
        .reply({
          embeds: [client.embedBuilder.warning(client, message.t("commands.vunban.target_not_banned"))],
        })
        .catch(() => {});
    }

    pvData.blacklist = pvData.blacklist.filter((id) => id !== target.id);
    client.pvMap.set(vc.id, pvData);
    client.db.setPrivateVoice(vc.id, pvData.guildId || message.guild.id, pvData.ownerId, pvData);

    await vc.permissionOverwrites.delete(target.id).catch(() => {});

    const embed = client.embedBuilder
      .success(client, message.t("commands.vunban.unbanned"))
      .setAuthor({
        name: message.t("commands.vunban.author"),
        iconURL: client.user.displayAvatarURL(),
      })
      .addFields(
        { name: message.t("commands.vunban.field_channel"), value: `${vc}`, inline: true },
        { name: message.t("commands.vunban.field_target"), value: `${target}`, inline: true },
        { name: message.t("commands.vunban.field_mod"), value: `${message.author}`, inline: true },
      );

    await message.reply({ embeds: [embed] }).catch(() => {});
  },
};
