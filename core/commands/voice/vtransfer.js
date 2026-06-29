const isOwner = (id) =>
  !!(
    process.env.OWNER_ID &&
    process.env.OWNER_ID.split(",")
      .map((x) => x.trim())
      .includes(id)
  );

module.exports = {
  name: "vtransfer",
  description:
    "Transfère la propriété de votre salon privé à quelqu'un d'autre.",
  category: "voice",
  usage: "+vtransfer <@user>",
  async execute(client, message, args) {
    const vc = message.member.voice.channel;
    if (!vc)
      return message
        .reply({
          embeds: [
            client.embedBuilder.error(client, message.t("commands.vtransfer.join_private")),
          ],
        })
        .catch(() => {});
    if (!client.pvMap || !client.pvMap.has(vc.id))
      return message
        .reply({
          embeds: [client.embedBuilder.error(client, message.t("commands.vtransfer.not_private"))],
        })
        .catch(() => {});

    const pvData = client.pvMap.get(vc.id);
    if (pvData.ownerId !== message.author.id && !isOwner(message.author.id)) {
      return message
        .reply({
          embeds: [
            client.embedBuilder.error(client, message.t("commands.vtransfer.owner_only")),
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
              message.t("commands.vtransfer.target_not_found"),
            ),
          ],
        })
        .catch(() => {});

    if (target.id === message.author.id)
      return message
        .reply({
          embeds: [client.embedBuilder.warning(client, message.t("commands.vtransfer.already_owner"))],
        })
        .catch(() => {});
    if (target.voice.channelId !== vc.id)
      return message
        .reply({
          embeds: [
            client.embedBuilder.warning(client, message.t("commands.vtransfer.target_absent")),
          ],
        })
        .catch(() => {});

    pvData.ownerId = target.id;
    if (!Array.isArray(pvData.whitelist)) pvData.whitelist = [];
    if (!pvData.whitelist.includes(target.id)) pvData.whitelist.push(target.id);

    client.pvMap.set(vc.id, pvData);
    client.db.setPrivateVoice(vc.id, pvData.guildId || message.guild.id, target.id, pvData);

    await vc.permissionOverwrites
      .edit(target.id, { Connect: true, ManageChannels: true })
      .catch(() => {});
    await vc.permissionOverwrites
      .edit(message.author.id, { ManageChannels: null })
      .catch(() => {});

    const embed = client.embedBuilder
      .success(client, message.t("commands.vtransfer.transferred"))
      .setAuthor({
        name: message.t("commands.vtransfer.author"),
        iconURL: client.user.displayAvatarURL(),
      })
      .addFields(
        { name: message.t("commands.vtransfer.field_channel"), value: `${vc}`, inline: true },
        { name: message.t("commands.vtransfer.field_target"), value: `${target}`, inline: true },
        { name: message.t("commands.vtransfer.field_mod"), value: `${message.author}`, inline: true },
      );

    await message.reply({ embeds: [embed] }).catch(() => {});
  },
};
