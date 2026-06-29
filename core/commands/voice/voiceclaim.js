module.exports = {
  name: "voiceclaim",
  aliases: ["vclaim"],
  description:
    "Récupère les droits d'un salon vocal temporaire si le propriétaire est parti.",
  category: "voice",
  usage: "+voiceclaim",
  async execute(client, message, args) {
    const vc = message.member.voice.channel;
    if (!vc)
      return message
        .reply({
          embeds: [
            client.embedBuilder.error(client, message.t("commands.voiceclaim.join_voice")),
          ],
        })
        .catch(() => {});

    const vmData = client.db.db
      .prepare("SELECT * FROM voicemaster_channels WHERE channelId = ?")
      .get(vc.id);
    if (!vmData)
      return message
        .reply({
          embeds: [
            client.embedBuilder.error(client, message.t("commands.voiceclaim.not_managed")),
          ],
        })
        .catch(() => {});

    const ownerInChannel = vc.members.has(vmData.ownerId);
    if (ownerInChannel)
      return message
        .reply({
          embeds: [
            client.embedBuilder.warning(client, message.t("commands.voiceclaim.owner_present")),
          ],
        })
        .catch(() => {});

    const previousOwnerId = vmData.ownerId;
    client.db.db
      .prepare(
        "UPDATE voicemaster_channels SET ownerId = ? WHERE channelId = ?",
      )
      .run(message.author.id, vc.id);

    await vc.permissionOverwrites
      .edit(message.author.id, {
        Connect: true,
        ManageChannels: true,
        MoveMembers: true,
      })
      .catch(() => {});

    const embed = client.embedBuilder
      .success(client, message.t("commands.voiceclaim.claimed"))
      .setAuthor({
        name: message.t("commands.voiceclaim.author"),
        iconURL: client.user.displayAvatarURL(),
      })
      .addFields(
        { name: message.t("commands.voiceclaim.field_channel"), value: `${vc}`, inline: true },
        { name: message.t("commands.voiceclaim.field_target"), value: `<@${previousOwnerId}>`, inline: true },
        { name: message.t("commands.voiceclaim.field_mod"), value: `${message.author}`, inline: true },
      );

    await message.reply({ embeds: [embed] }).catch(() => {});
  },
};
