const isOwner = (id) =>
  !!(
    process.env.OWNER_ID &&
    process.env.OWNER_ID.split(",")
      .map((x) => x.trim())
      .includes(id)
  );

module.exports = {
  name: "vrename",
  description: "Renomme votre salon privé.",
  category: "voice",
  usage: "+vrename <nom>",
  async execute(client, message, args) {
    const vc = message.member.voice.channel;
    if (!vc)
      return message
        .reply({
          embeds: [
            client.embedBuilder.error(client, message.t("commands.vrename.join_private")),
          ],
        })
        .catch(() => {});
    if (!client.pvMap || !client.pvMap.has(vc.id))
      return message
        .reply({
          embeds: [client.embedBuilder.error(client, message.t("commands.vrename.not_private"))],
        })
        .catch(() => {});

    const pvData = client.pvMap.get(vc.id);
    if (pvData.ownerId !== message.author.id && !isOwner(message.author.id)) {
      return message
        .reply({
          embeds: [
            client.embedBuilder.error(client, message.t("commands.vrename.owner_only")),
          ],
        })
        .catch(() => {});
    }

    const name = args.join(" ").trim();
    if (!name)
      return message
        .reply({
          embeds: [client.embedBuilder.error(client, message.t("commands.vrename.name_missing"))],
        })
        .catch(() => {});
    if (name.length > 100)
      return message
        .reply({
          embeds: [
            client.embedBuilder.error(client, message.t("commands.vrename.name_too_long")),
          ],
        })
        .catch(() => {});

    const oldName = vc.name;
    try {
      await vc.setName(name);
      const embed = client.embedBuilder
        .success(client, message.t("commands.vrename.renamed"))
        .setAuthor({
          name: message.t("commands.vrename.author"),
          iconURL: client.user.displayAvatarURL(),
        })
        .addFields(
          { name: message.t("commands.vrename.field_channel"), value: `${vc}`, inline: true },
          { name: message.t("commands.vrename.field_old"), value: `\`${oldName}\``, inline: true },
          { name: message.t("commands.vrename.field_mod"), value: `${message.author}`, inline: true },
        );
      await message.reply({ embeds: [embed] }).catch(() => {});
    } catch (err) {
      if (err.code === 50013)
        await message
          .reply({
            embeds: [
              client.embedBuilder.error(client, message.t("commands.vrename.bot_perm_missing")),
            ],
          })
          .catch(() => {});
      else if (err.code === 429)
        await message
          .reply({
            embeds: [
              client.embedBuilder.warning(
                client,
                message.t("commands.vrename.rate_limit"),
              ),
            ],
          })
          .catch(() => {});
      else
        await message
          .reply({
            embeds: [client.embedBuilder.error(client, message.t("commands.vrename.rename_failed"))],
          })
          .catch(() => {});
    }
  },
};
