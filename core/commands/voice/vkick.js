const isOwner = (id) =>
  !!(
    process.env.OWNER_ID &&
    process.env.OWNER_ID.split(",")
      .map((x) => x.trim())
      .includes(id)
  );

module.exports = {
  name: "vkick",
  aliases: ["vocal-expulser"],
  description: "Expulse un utilisateur de votre salon privé.",
  category: "voice",
  usage: "+vkick <@user>",
  async execute(client, message, args) {
    const vc = message.member.voice.channel;
    if (!vc)
      return message
        .reply({
          embeds: [
            client.embedBuilder.error(client, message.t("commands.vkick.join_private")),
          ],
        })
        .catch(() => {});
    if (!client.pvMap || !client.pvMap.has(vc.id))
      return message
        .reply({
          embeds: [client.embedBuilder.error(client, message.t("commands.vkick.not_private"))],
        })
        .catch(() => {});

    const pvData = client.pvMap.get(vc.id);
    if (pvData.ownerId !== message.author.id && !isOwner(message.author.id)) {
      return message
        .reply({
          embeds: [
            client.embedBuilder.error(client, message.t("commands.vkick.owner_only")),
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
              message.t("commands.vkick.target_not_found"),
            ),
          ],
        })
        .catch(() => {});

    if (target.voice.channelId !== vc.id)
      return message
        .reply({
          embeds: [
            client.embedBuilder.warning(client, message.t("commands.vkick.target_absent")),
          ],
        })
        .catch(() => {});
    if (target.id === message.author.id)
      return message
        .reply({
          embeds: [client.embedBuilder.error(client, message.t("commands.vkick.self_kick"))],
        })
        .catch(() => {});

    try {
      await target.voice.disconnect(message.t("commands.vkick.audit_reason"));

      if (Array.isArray(pvData.whitelist) && pvData.whitelist.includes(target.id)) {
        pvData.whitelist = pvData.whitelist.filter((id) => id !== target.id);
        client.pvMap.set(vc.id, pvData);
        client.db.setPrivateVoice(
          vc.id,
          pvData.guildId || message.guild.id,
          pvData.ownerId,
          pvData,
        );
        await vc.permissionOverwrites.delete(target.id).catch(() => {});
      }

      const embed = client.embedBuilder
        .success(client, "")
        .setDescription(null)
        .setAuthor({
          name: message.t("commands.vkick.title"),
          iconURL: client.user.displayAvatarURL(),
        })
        .addFields(
          { name: message.t("commands.vkick.field_channel"), value: `${vc}`, inline: true },
          { name: message.t("commands.vkick.field_target"), value: `${target}`, inline: true },
          { name: message.t("commands.vkick.field_mod"), value: `${message.author}`, inline: true },
        );

      await message.reply({ embeds: [embed] }).catch(() => {});
    } catch (e) {
      await message
        .reply({
          embeds: [client.embedBuilder.error(client, message.t("commands.vkick.fail"))],
        })
        .catch(() => {});
    }
  },
};
