const isOwner = (id) =>
  !!(
    process.env.OWNER_ID &&
    process.env.OWNER_ID.split(",")
      .map((x) => x.trim())
      .includes(id)
  );

module.exports = {
  name: "vclose",
  description: "Supprime votre salon privé immédiatement.",
  category: "voice",
  usage: "+vclose",
  async execute(client, message, args) {
    const vc = message.member.voice.channel;
    if (!vc)
      return message
        .reply({
          embeds: [
            client.embedBuilder.error(client, message.t("commands.vclose.join_private")),
          ],
        })
        .catch(() => {});
    if (!client.pvMap.has(vc.id))
      return message
        .reply({
          embeds: [client.embedBuilder.error(client, message.t("commands.vclose.not_private"))],
        })
        .catch(() => {});

    const pvData = client.pvMap.get(vc.id);
    if (pvData.ownerId !== message.author.id && !isOwner(message.author.id)) {
      return message
        .reply({
          embeds: [
            client.embedBuilder.error(client, message.t("commands.vclose.owner_only")),
          ],
        })
        .catch(() => {});
    }

    const vcName = vc.name;
    try {
      await vc.delete(message.t("commands.vclose.audit_reason"));
      client.pvMap.delete(vc.id);
      client.db.deletePrivateVoice(vc.id);

      const embed = client.embedBuilder
        .success(client, message.t("commands.vclose.deleted"))
        .setAuthor({
          name: message.t("commands.vclose.title"),
          iconURL: client.user.displayAvatarURL(),
        })
        .addFields(
          { name: message.t("commands.vclose.field_channel"), value: `\`${vcName}\``, inline: true },
          { name: message.t("commands.vclose.field_mod"), value: `${message.author}`, inline: true },
        );

      await message.channel
        .send({ embeds: [embed] })
        .catch(() => message.author.send({ embeds: [embed] }).catch(() => {}));
    } catch (e) {
      await message
        .reply({
          embeds: [
            client.embedBuilder.error(
              client,
              message.t("commands.vclose.fail_perms"),
            ),
          ],
        })
        .catch(() => {});
    }
  },
};
