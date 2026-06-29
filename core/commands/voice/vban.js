const isOwner = (id) =>
  !!(
    process.env.OWNER_ID &&
    process.env.OWNER_ID.split(",")
      .map((x) => x.trim())
      .includes(id)
  );

module.exports = {
  name: "vban",
  description: "Bannit un utilisateur de votre salon privé.",
  category: "voice",
  usage: "+vban <@user>",
  async execute(client, message, args) {
    const vc = message.member.voice.channel;
    if (!vc)
      return message
        .reply({
          embeds: [
            client.embedBuilder.error(client, message.t("commands.vban.join_private")),
          ],
        })
        .catch(() => {});

    if (!client.pvMap || !client.pvMap.has(vc.id))
      return message
        .reply({
          embeds: [client.embedBuilder.error(client, message.t("commands.vban.not_private"))],
        })
        .catch(() => {});

    const pvData = client.pvMap.get(vc.id);
    if (pvData.ownerId !== message.author.id && !isOwner(message.author.id)) {
      return message
        .reply({
          embeds: [
            client.embedBuilder.error(client, message.t("commands.vban.owner_only")),
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
              message.t("commands.vban.target_not_found"),
            ),
          ],
        })
        .catch(() => {});

    if (target.id === message.author.id)
      return message
        .reply({
          embeds: [client.embedBuilder.error(client, message.t("commands.vban.self_ban_forbidden"))],
        })
        .catch(() => {});

    if (!pvData.blacklist) pvData.blacklist = [];
    if (!Array.isArray(pvData.whitelist)) pvData.whitelist = [];
    if (!pvData.blacklist.includes(target.id)) {
      pvData.blacklist.push(target.id);
    }
    pvData.whitelist = pvData.whitelist.filter((id) => id !== target.id);

    client.pvMap.set(vc.id, pvData);
    client.db.setPrivateVoice(
      vc.id,
      pvData.guildId,
      pvData.ownerId,
      pvData,
    );

    await vc.permissionOverwrites
      .edit(target.id, { Connect: false, ViewChannel: false })
      .catch(() => {});

    if (target.voice.channelId === vc.id) {
      await target.voice.disconnect().catch(() => {});
    }

    const embed = client.embedBuilder
      .success(client, message.t("commands.vban.ban_applied"))
      .setAuthor({
        name: message.t("commands.vban.author"),
        iconURL: client.user.displayAvatarURL(),
      })
      .addFields(
        { name: message.t("commands.vban.field_channel"), value: `${vc}`, inline: true },
        { name: message.t("commands.vban.field_target"), value: `${target}`, inline: true },
        { name: message.t("commands.vban.field_moderator"), value: `${message.author}`, inline: true },
      );

    await message.reply({ embeds: [embed] }).catch(() => {});
  },
};
