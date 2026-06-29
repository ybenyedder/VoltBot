const { isBotOwner } = require("../../utils/permissions");

module.exports = {
  name: "remove",
  description: "Retire un utilisateur d'un ticket.",
  category: "tickets",
  usage: "+remove [@user]",
  async execute(client, message, args) {
    const isTicket = client.db.db
      .prepare("SELECT * FROM tickets WHERE channelId = ? AND status ='open'")
      .get(message.channel.id);
    if (!isTicket)
      return message
        .reply({
          embeds: [
            client.embedBuilder.error(
              client,
              message.t("commands.remove.not_ticket"),
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
      !isBotOwner(client, message.author.id)
    ) {
      return message
        .reply({
          embeds: [
            client.embedBuilder.error(
              client,
              message.t("commands.remove.permission_denied"),
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
              message.t("commands.remove.target_not_found"),
            ),
          ],
        })
        .catch(() => {});
    if (target.id === isTicket.userId)
      return message
        .reply({
          embeds: [
            client.embedBuilder.error(
              client,
              message.t("commands.remove.cannot_remove_creator"),
            ),
          ],
        })
        .catch(() => {});

    try {
      await message.channel.permissionOverwrites.edit(target.id, {
        ViewChannel: false,
      });
    } catch (e) {
      return message
        .reply({
          embeds: [
            client.embedBuilder.error(
              client,
              message.t("commands.remove.cannot_edit_perms"),
            ),
          ],
        })
        .catch(() => {});
    }

    await message
      .reply({
        embeds: [
          client.embedBuilder
            .success(client, message.t("commands.remove.member_removed"))
            .addFields(
              {
                name: message.t("commands.remove.field_target"),
                value: `${target}`,
                inline: true,
              },
              {
                name: message.t("commands.remove.field_action"),
                value: message.t("commands.remove.action_removal"),
                inline: true,
              },
              {
                name: message.t("commands.remove.field_author"),
                value: `${message.author}`,
                inline: true,
              },
            ),
        ],
      })
      .catch(() => {});
  },
};
