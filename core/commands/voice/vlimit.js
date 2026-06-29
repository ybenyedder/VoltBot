const isOwner = (id) =>
  !!(
    process.env.OWNER_ID &&
    process.env.OWNER_ID.split(",")
      .map((x) => x.trim())
      .includes(id)
  );

module.exports = {
  name: "vlimit",
  description: "Définit une limite d'utilisateurs pour votre salon privé.",
  category: "voice",
  usage: "+vlimit <nombre>",
  async execute(client, message, args) {
    const vc = message.member.voice.channel;
    if (!vc)
      return message
        .reply({
          embeds: [
            client.embedBuilder.error(client, message.t("commands.vlimit.join_private")),
          ],
        })
        .catch(() => {});
    if (!client.pvMap) client.pvMap = new Map();
    if (!client.pvMap.has(vc.id))
      return message
        .reply({
          embeds: [client.embedBuilder.error(client, message.t("commands.vlimit.not_private"))],
        })
        .catch(() => {});

    const pvData = client.pvMap.get(vc.id);
    if (pvData.ownerId !== message.author.id && !isOwner(message.author.id)) {
      return message
        .reply({
          embeds: [
            client.embedBuilder.error(client, message.t("commands.vlimit.owner_only")),
          ],
        })
        .catch(() => {});
    }

    const limit = parseInt(args[0]);
    if (isNaN(limit) || limit < 0 || limit > 99) {
      return message
        .reply({
          embeds: [
            client.embedBuilder.error(
              client,
              message.t("commands.vlimit.invalid_value"),
            ),
          ],
        })
        .catch(() => {});
    }

    await vc.setUserLimit(limit).catch(() => {});

    const embed = client.embedBuilder
      .success(client, message.t("commands.vlimit.updated"))
      .setAuthor({
        name: message.t("commands.vlimit.title"),
        iconURL: client.user.displayAvatarURL(),
      })
      .addFields(
        { name: message.t("commands.vlimit.field_channel"), value: `${vc}`, inline: true },
        {
          name: message.t("commands.vlimit.field_limit"),
          value: limit === 0 ? message.t("commands.vlimit.none") : `\`${limit}\``,
          inline: true,
        },
        { name: message.t("commands.vlimit.field_mod"), value: `${message.author}`, inline: true },
      );

    await message.reply({ embeds: [embed] }).catch(() => {});
  },
};
