const { PermissionFlagsBits } = require("discord.js");

module.exports = {
  name: "cellule",
  description: "Envoie un utilisateur en cellule (mute dans un salon vocal)",
  category: "moderation",
  usage: "cellule",
  userPerms: [PermissionFlagsBits.MoveMembers, PermissionFlagsBits.MuteMembers],
  botPerms: [
    PermissionFlagsBits.ManageChannels,
    PermissionFlagsBits.MoveMembers,
    PermissionFlagsBits.MuteMembers,
  ],
  async execute(client, message, args) {
    if (!args[0]) {
      return message
        .reply({
          embeds: [
            client.embedBuilder.error(
              client,
              message.t("commands.cellule.usage"),
            ),
          ],
        })
        .catch(() => {});
    }

    const member =
      message.mentions.members.first() ||
      message.guild.members.cache.get(args[0]);
    if (!member)
      return message
        .reply({
          embeds: [
            client.embedBuilder.error(client, message.t("commands.cellule.user_not_found")),
          ],
        })
        .catch(() => {});

    if (!member.voice.channel) {
      return message
        .reply({
          embeds: [
            client.embedBuilder.error(
              client,
              message.t("commands.cellule.not_in_voice"),
            ),
          ],
        })
        .catch(() => {});
    }

    if (member.permissions.has(PermissionFlagsBits.Administrator)) {
      return message
        .reply({
          embeds: [
            client.embedBuilder.error(
              client,
              message.t("commands.cellule.cannot_admin"),
            ),
          ],
        })
        .catch(() => {});
    }

    const reason = args.slice(1).join("") || message.t("commands.cellule.no_reason");

    try {
      let celluleChannel = message.guild.channels.cache.find(
        (c) => c.name === "Cellule" && c.type === 2,
      );

      if (!celluleChannel) {
        celluleChannel = await message.guild.channels.create({
          name: "Cellule",
          type: 2,
          permissionOverwrites: [
            { id: message.guild.id, deny: ["Connect", "Speak"] },
            { id: client.user.id, allow: ["Connect", "Speak", "MoveMembers"] },
          ],
        });
      }

      await member.voice.setChannel(celluleChannel);
      await member.voice.setMute(true);

      const embed = client.embedBuilder
        .success(client, message.t("commands.cellule.success", { tag: member.user.tag }))
        .addFields(
          {
            name: message.t("commands.cellule.field_user"),
            value: `${member.user.tag} (\`${member.id}\`)`,
            inline: true,
          },
          { name: message.t("commands.cellule.field_moderator"), value: message.author.tag, inline: true },
          { name: message.t("commands.cellule.field_reason"), value: reason, inline: false },
        );

      await message.reply({ embeds: [embed] }).catch(() => {});

      const logChannelId = client.db.getGuild(message.guild.id).modLogsChannel;
      const logChannel = logChannelId
        ? message.guild.channels.cache.get(logChannelId)
        : null;
      if (logChannel) {
        logChannel
          .send({
            embeds: [
              client.embedBuilder.modLog(
                client,
                message.t("commands.cellule.modlog_action"),
                member.user,
                message.author,
                reason,
                [],
                message.lang,
              ),
            ],
          })
          .catch(() => {});
      }
    } catch (e) {
      await message
        .reply({
          embeds: [
            client.embedBuilder.error(
              client,
              message.t("commands.cellule.failed"),
            ),
          ],
        })
        .catch(() => {});
    }
  },
};
