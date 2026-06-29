const { AttachmentBuilder } = require("discord.js");
const discordTranscripts = require("discord-html-transcripts");

module.exports = {
  name: "close",
  aliases: ["fermer"],
  description: "Ferme et supprime le ticket actuel directement.",
  category: "tickets",
  usage: "+close",
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
              message.t("commands.close.not_ticket"),
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
      ticketConfig.roleId
        .split(",")
        .map((id) => id.trim())
        .some((roleId) => message.member.roles.cache.has(roleId));

    const hasManagePerms =
      message.member.permissions.has("ManageChannels") ||
      message.member.permissions.has("Administrator");
    const isBotOwner =
      process.env.OWNER_ID &&
      process.env.OWNER_ID.split(",")
        .map((id) => id.trim())
        .includes(message.author.id);
    if (!isOwner && !isStaff && !hasManagePerms && !isBotOwner) {
      return message
        .reply({
          embeds: [
            client.embedBuilder.error(
              client,
              message.t("commands.close.permission_denied"),
            ),
          ],
        })
        .catch(() => {});
    }

    await message
      .reply({
        embeds: [
          client.embedBuilder.info(
            client,
            message.t("commands.close.closing"),
          ),
        ],
      })
      .catch(() => {});

    client.db.db
      .prepare("UPDATE tickets SET status ='closed'WHERE channelId = ?")
      .run(message.channel.id);

    try {
      const transcriptText = await discordTranscripts.createTranscript(
        message.channel,
        {
          limit: -1,
          returnType: "string",
          poweredBy: false,
        },
      );

      const ticketId = isTicket.channelId;
      const transcriptFile = new AttachmentBuilder(
        Buffer.from(transcriptText || "", "utf8"),
        { name: `transcript-${ticketId}.txt` },
      );

      if (ticketConfig && ticketConfig.logsChannelId) {
        const logsChannel = message.guild.channels.cache.get(
          ticketConfig.logsChannelId,
        );
        if (logsChannel) {
          const opener = await message.guild.members
            .fetch(isTicket.userId)
            .catch(() => null);
          const createdAt = isTicket.createdAt
            ? Number(isTicket.createdAt)
            : null;
          const createdMs =
            createdAt && createdAt < 1e12 ? createdAt * 1000 : createdAt;
          const durationMs = createdMs ? Date.now() - createdMs : null;
          const durationStr = durationMs
            ? formatDuration(durationMs, message)
            : message.t("commands.close.unknown");
          const participants =
            message.channel.permissionOverwrites?.cache?.filter(
              (ow) => ow.type === 1,
            ).size || 0;
          const claimedByValue = isTicket.claimedBy
            ? `<@${isTicket.claimedBy}>`
            : message.t("commands.close.not_claimed");
          const categoryValue = isTicket.category
            ? `\`${isTicket.category}\``
            : message.t("commands.close.unknown");
          const logEmbed = client.embedBuilder
            .info(client, message.t("commands.close.log_title"))
            .addFields(
              {
                name: message.t("commands.close.field_opened_by"),
                value: opener ? `${opener}` : `<@${isTicket.userId}>`,
                inline: true,
              },
              {
                name: message.t("commands.close.field_channel"),
                value: `\`${message.channel.name}\``,
                inline: true,
              },
              {
                name: message.t("commands.close.field_duration"),
                value: `\`${durationStr}\``,
                inline: true,
              },
              {
                name: message.t("commands.close.field_closed_by"),
                value: `${message.author}`,
                inline: true,
              },
              {
                name: message.t("commands.close.field_participants"),
                value: `\`${participants}\``,
                inline: true,
              },
              {
                name: message.t("commands.close.field_category"),
                value: categoryValue,
                inline: true,
              },
              {
                name: message.t("commands.close.field_claimed_by"),
                value: claimedByValue,
                inline: true,
              },
            );

          await logsChannel
            .send({
              embeds: [logEmbed],
              files: [transcriptFile],
            })
            .catch(() => {});
        }
      }
    } catch (e) {
      // silent fallback if transcript fails
    }

    setTimeout(() => {
      message.channel.delete().catch(() => {});
    }, 5000);
  },
};

function formatDuration(ms, message) {
  const sec = Math.floor(ms / 1000);
  const d = Math.floor(sec / 86400);
  const h = Math.floor((sec % 86400) / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const parts = [];
  if (d) parts.push(message.t("commands.close.duration_days", { n: d }));
  if (h) parts.push(message.t("commands.close.duration_hours", { n: h }));
  if (m || (!d && !h))
    parts.push(message.t("commands.close.duration_minutes", { n: m }));
  return parts.join(" ");
}
