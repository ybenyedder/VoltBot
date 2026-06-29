const { EmbedBuilder, PermissionsBitField } = require("discord.js");

const STATUS = {
  accept: { helper: "success", labelKey: "label_accept", db: "accept" },
  deny: { helper: "error", labelKey: "label_deny", db: "deny" },
  consider: { helper: "warning", labelKey: "label_consider", db: "consider" },
};

const ALIAS = {
  accept: "accept",
  approve: "accept",
  deny: "deny",
  reject: "deny",
  consider: "consider",
};

const RESERVED_FIELDS = new Set(["Raison", "Décision par", "Statut"]);

const isMultiLine = (s) => /\n/.test(s) || s.length > 80;

module.exports = {
  name: "replysuggest",
  aliases: ["rsuggest", "accept", "deny", "approve", "reject", "consider"],
  description: "Accepte, refuse ou met à l'étude une suggestion.",
  category: "suggestions",
  usage: "+replysuggest [ID message] [accept/deny/consider] [raison]",
  userPerms: [PermissionsBitField.Flags.ManageMessages],
  async execute(client, message, args) {
    const rawFirstToken = (message?.content || "").trim().split(/\s+/)[0] || "";
    const invoked = rawFirstToken.replace(/^[^a-zA-Z0-9]+/, "").toLowerCase();
    let msgId;
    let statusKey;
    let reasonParts;

    if (ALIAS[invoked] && args[0] && !ALIAS[(args[1] || "").toLowerCase()]) {
      msgId = args[0];
      statusKey = ALIAS[invoked];
      reasonParts = args.slice(1);
    } else {
      msgId = args[0];
      statusKey = ALIAS[(args[1] || "").toLowerCase()];
      reasonParts = args.slice(2);
    }

    const reason =
      reasonParts.join(" ").trim() ||
      message.t("commands.replysuggest.no_reason");

    if (!msgId || !statusKey) {
      return message
        .reply({
          embeds: [
            client.embedBuilder.error(
              client,
              message.t("commands.replysuggest.syntax"),
            ),
          ],
        })
        .catch(() => {});
    }

    const suggestData = client.db.db
      .prepare("SELECT * FROM suggestions WHERE msgId = ? AND guildId = ?")
      .get(msgId, message.guild.id);
    if (!suggestData) {
      return message
        .reply({
          embeds: [
            client.embedBuilder.error(
              client,
              message.t("commands.replysuggest.not_found"),
            ),
          ],
        })
        .catch(() => {});
    }

    let channelId;
    try {
      channelId = client.db.getGuild(message.guild.id).suggestChannel;
    } catch (e) {}
    if (!channelId) {
      return message
        .reply({
          embeds: [
            client.embedBuilder.error(
              client,
              message.t("commands.replysuggest.channel_not_configured"),
            ),
          ],
        })
        .catch(() => {});
    }

    const channel = message.guild.channels.cache.get(channelId);
    if (!channel) {
      return message
        .reply({
          embeds: [
            client.embedBuilder.error(
              client,
              message.t("commands.replysuggest.channel_not_found"),
            ),
          ],
        })
        .catch(() => {});
    }

    const suggestMsg = await channel.messages.fetch(msgId).catch(() => null);
    if (!suggestMsg || !suggestMsg.embeds?.[0]) {
      return message
        .reply({
          embeds: [
            client.embedBuilder.error(
              client,
              message.t("commands.replysuggest.message_not_found"),
            ),
          ],
        })
        .catch(() => {});
    }

    const meta = STATUS[statusKey];
    const metaLabel = message.t(`commands.replysuggest.${meta.labelKey}`);
    const refEmbed = client.embedBuilder[meta.helper](client, "");
    const refColor = refEmbed.data.color;

    const embed = EmbedBuilder.from(suggestMsg.embeds[0])
      .setColor(refColor)
      .setAuthor({
        name: message.t("commands.replysuggest.decision_by", {
          user: message.author.tag,
        }),
        iconURL: message.author.displayAvatarURL({ size: 256 }),
      });

    const data = embed.data;
    const baseFields = (data.fields || []).filter(
      (f) => !RESERVED_FIELDS.has(f.name),
    );
    const reasonValue = isMultiLine(reason)
      ? `\`\`\`\n${reason}\n\`\`\``
      : reason;

    embed.setFields(...baseFields, {
      name: "Raison",
      value: reasonValue,
      inline: false,
    });

    const edited = await suggestMsg.edit({ embeds: [embed] }).catch(() => null);
    if (!edited) {
      return message
        .reply({
          embeds: [
            client.embedBuilder.error(
              client,
              message.t("commands.replysuggest.edit_refused"),
            ),
          ],
        })
        .catch(() => {});
    }

    try {
      client.db.db
        .prepare(
          "UPDATE suggestions SET status = ? WHERE msgId = ? AND guildId = ?",
        )
        .run(meta.db, msgId, message.guild.id);
    } catch (e) {}

    await message
      .reply({
        embeds: [
          client.embedBuilder.success(
            client,
            message.t("commands.replysuggest.suggestion_status", {
              label: metaLabel,
            }),
          ),
        ],
      })
      .catch(() => {});

    client.users
      .fetch(suggestData.userId)
      .then((u) => {
        u.send({
          embeds: [
            client.embedBuilder.info(
              client,
              message.t("commands.replysuggest.dm_status", {
                guild: message.guild.name,
                label: metaLabel,
                reason: reason,
              }),
            ),
          ],
        }).catch(() => {});
      })
      .catch(() => {});
  },
};
