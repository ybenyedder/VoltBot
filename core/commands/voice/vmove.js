const isOwner = (id) =>
  !!(
    process.env.OWNER_ID &&
    process.env.OWNER_ID.split(",")
      .map((x) => x.trim())
      .includes(id)
  );

module.exports = {
  name: "vmove",
  aliases: ["vocal-deplacer"],
  description: "Déplace un utilisateur de votre salon vers un autre.",
  category: "voice",
  usage: "+vmove <@user> <#salon>",
  async execute(client, message, args) {
    const vc = message.member.voice.channel;
    if (!vc)
      return message
        .reply({
          embeds: [
            client.embedBuilder.error(client, message.t("commands.vmove.join_private")),
          ],
        })
        .catch(() => {});
    if (!client.pvMap || !client.pvMap.has(vc.id))
      return message
        .reply({
          embeds: [client.embedBuilder.error(client, message.t("commands.vmove.not_private"))],
        })
        .catch(() => {});

    const pvData = client.pvMap.get(vc.id);
    if (pvData.ownerId !== message.author.id && !isOwner(message.author.id)) {
      return message
        .reply({
          embeds: [
            client.embedBuilder.error(client, message.t("commands.vmove.owner_only")),
          ],
        })
        .catch(() => {});
    }

    const target = message.mentions.members.first();
    const targetChannel =
      message.mentions.channels.first() ||
      message.guild.channels.cache.get(args[1]);

    if (!target)
      return message
        .reply({
          embeds: [
            client.embedBuilder.error(
              client,
              message.t("commands.vmove.target_not_found"),
            ),
          ],
        })
        .catch(() => {});
    if (!targetChannel || !targetChannel.isVoiceBased())
      return message
        .reply({
          embeds: [
            client.embedBuilder.error(client, message.t("commands.vmove.invalid_destination")),
          ],
        })
        .catch(() => {});

    if (target.voice.channelId !== vc.id)
      return message
        .reply({
          embeds: [
            client.embedBuilder.warning(client, message.t("commands.vmove.target_absent")),
          ],
        })
        .catch(() => {});

    try {
      await target.voice.setChannel(targetChannel);
      const embed = client.embedBuilder
        .success(client, message.t("commands.vmove.moved"))
        .setAuthor({
          name: message.t("commands.vmove.author"),
          iconURL: client.user.displayAvatarURL(),
        })
        .addFields(
          { name: message.t("commands.vmove.field_target"), value: `${target}`, inline: true },
          { name: message.t("commands.vmove.field_destination"), value: `${targetChannel}`, inline: true },
          { name: message.t("commands.vmove.field_mod"), value: `${message.author}`, inline: true },
        );
      await message.reply({ embeds: [embed] }).catch(() => {});
    } catch (e) {
      await message
        .reply({
          embeds: [
            client.embedBuilder.error(
              client,
              message.t("commands.vmove.move_failed"),
            ),
          ],
        })
        .catch(() => {});
    }
  },
};
