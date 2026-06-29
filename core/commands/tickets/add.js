module.exports = {
  name: "add",
  description: "Ajoute un utilisateur à un ticket.",
  category: "tickets",
  usage: "+add [@user]",
  async execute(client, message, args) {
    const isTicket = client.db.db
      .prepare("SELECT * FROM tickets WHERE channelId = ? AND status = 'open'")
      .get(message.channel.id);
    if (!isTicket)
      return message
        .reply({
          embeds: [
            client.embedBuilder.error(
              client,
              message.t("commands.add.not_a_ticket"),
            ),
          ],
        })
        .catch(() => {});

    const ticketConfig = client.db.db
      .prepare("SELECT * FROM tickets_config WHERE guildId = ?")
      .get(message.guild.id);
    const isOwner = isTicket.userId === message.author.id;
    const isStaff =
      ticketConfig &&
      ticketConfig.roleId &&
      message.member.roles.cache.some((r) =>
        ticketConfig.roleId
          .split(",")
          .map((id) => id.trim())
          .includes(r.id),
      );
    if (
      !isOwner &&
      !isStaff &&
      !message.member.permissions.has("Administrator") &&
      !(
        process.env.OWNER_ID &&
        process.env.OWNER_ID.split(",")
          .map((id) => id.trim())
          .includes(message.author.id)
      )
    ) {
      return message
        .reply({
          embeds: [
            client.embedBuilder.error(
              client,
              message.t("commands.add.permission_denied"),
            ),
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
              message.t("commands.add.target_not_found"),
            ),
          ],
        })
        .catch(() => {});

    try {
      await message.channel.permissionOverwrites.edit(target.id, {
        ViewChannel: true,
        SendMessages: true,
        ReadMessageHistory: true,
        AttachFiles: true,
        EmbedLinks: true,
        AddReactions: true,
        UseExternalEmojis: true,
      });
    } catch (e) {
      return message
        .reply({
          embeds: [
            client.embedBuilder.error(
              client,
              message.t("commands.add.perms_not_editable"),
            ),
          ],
        })
        .catch(() => {});
    }

    await message
      .reply({
        embeds: [
          client.embedBuilder
            .success(client, message.t("commands.add.member_added"))
            .addFields(
              {
                name: message.t("commands.add.field_target"),
                value: `${target}`,
                inline: true,
              },
              {
                name: message.t("commands.add.field_action"),
                value: message.t("commands.add.action_add"),
                inline: true,
              },
              {
                name: message.t("commands.add.field_author"),
                value: `${message.author}`,
                inline: true,
              },
            ),
        ],
      })
      .catch(() => {});
  },
};
