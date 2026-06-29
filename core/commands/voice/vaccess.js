const isOwner = (id) =>
  !!(
    process.env.OWNER_ID &&
    process.env.OWNER_ID.split(",")
      .map((x) => x.trim())
      .includes(id)
  );

module.exports = {
  name: "vaccess",
  aliases: ["unvban"],
  description:
    "Donne l'accès à votre salon privé à un utilisateur (l'ajoute à la whitelist et le débannit si nécessaire).",
  category: "voice",
  usage: "+vaccess <@user|id>",
  async execute(client, message, args) {
    const vc = message.member.voice.channel;
    if (!vc)
      return message
        .reply({
          embeds: [
            client.embedBuilder.error(client, message.t("commands.vaccess.join_private")),
          ],
        })
        .catch(() => {});

    if (!client.pvMap || !client.pvMap.has(vc.id))
      return message
        .reply({
          embeds: [client.embedBuilder.error(client, message.t("commands.vaccess.not_private"))],
        })
        .catch(() => {});

    const pvData = client.pvMap.get(vc.id);
    if (pvData.ownerId !== message.author.id && !isOwner(message.author.id)) {
      return message
        .reply({
          embeds: [
            client.embedBuilder.error(client, message.t("commands.vaccess.owner_only")),
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
              message.t("commands.vaccess.target_not_found"),
            ),
          ],
        })
        .catch(() => {});

    if (!pvData.blacklist) pvData.blacklist = [];
    if (!Array.isArray(pvData.whitelist)) pvData.whitelist = [];
    pvData.blacklist = pvData.blacklist.filter((id) => id !== target.id);

    if (!pvData.whitelist.includes(target.id)) {
      pvData.whitelist.push(target.id);
    }
    client.pvMap.set(vc.id, pvData);
    client.db.setPrivateVoice(vc.id, pvData.guildId, pvData.ownerId, pvData);

    await vc.permissionOverwrites
      .edit(target.id, { Connect: true, ViewChannel: true })
      .catch(() => {});

    const embed = client.embedBuilder
      .success(client, message.t("commands.vaccess.access_granted"))
      .setAuthor({
        name: message.t("commands.vaccess.author"),
        iconURL: client.user.displayAvatarURL(),
      })
      .addFields(
        { name: message.t("commands.vaccess.field_channel"), value: `${vc}`, inline: true },
        { name: message.t("commands.vaccess.field_target"), value: `${target}`, inline: true },
        { name: message.t("commands.vaccess.field_moderator"), value: `${message.author}`, inline: true },
      );

    await message.reply({ embeds: [embed] }).catch(() => {});
  },
};
