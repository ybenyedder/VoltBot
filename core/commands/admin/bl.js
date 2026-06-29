module.exports = {
  name: "bl",
  aliases: ["blacklist"],
  description:
    "Blackliste un utilisateur du bot. Il ne pourra plus exécuter aucune commande.",
  category: "admin",
  usage: "+bl <@user|id> [raison]",
  ownerOnly: true,
  async execute(client, message, args) {
    if (!args[0]) {
      return message
        .reply({
          embeds: [
            client.embedBuilder.warning(
              client,
              message.t("commands.bl.missing_target"),
            ),
          ],
        })
        .catch(() => {});
    }

    const targetId = (message.mentions.users.first() || {}).id ||
      args[0].replace(/[<@!>]/g, "");
    if (!/^\d{17,20}$/.test(targetId)) {
      return message
        .reply({
          embeds: [
            client.embedBuilder.warning(client, message.t("commands.bl.invalid_id")),
          ],
        })
        .catch(() => {});
    }

    const owners = (process.env.OWNER_ID || "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    if (owners.includes(targetId)) {
      return message
        .reply({
          embeds: [
            client.embedBuilder.error(
              client,
              message.t("commands.bl.cannot_owner"),
            ),
          ],
        })
        .catch(() => {});
    }
    if (targetId === client.user.id) {
      return message
        .reply({
          embeds: [
            client.embedBuilder.error(
              client,
              message.t("commands.bl.cannot_bot"),
            ),
          ],
        })
        .catch(() => {});
    }

    const reason = args.slice(1).join(" ").trim() || message.t("commands.bl.no_reason");
    const list = client.db.getGlobal("blacklist") || [];
    if (list.find((e) => e.userId === targetId)) {
      return message
        .reply({
          embeds: [
            client.embedBuilder.warning(client, message.t("commands.bl.already_blacklisted")),
          ],
        })
        .catch(() => {});
    }

    const target = await client.users.fetch(targetId).catch(() => null);
    list.push({
      userId: targetId,
      userTag: target ? target.tag : targetId,
      reason,
      moderator: message.author.id,
      date: new Date().toISOString(),
    });
    client.db.updateGlobal("blacklist", list);

    let banned = 0;
    let failed = 0;
    const banReason = message.t("commands.bl.ban_reason", { reason }).slice(0, 512);
    for (const guild of client.guilds.cache.values()) {
      const me = guild.members.me;
      if (!me?.permissions.has("BanMembers")) {
        failed++;
        continue;
      }
      try {
        await guild.bans.create(targetId, { reason: banReason });
        banned++;
      } catch (e) {
        failed++;
      }
    }

    const embed = client.embedBuilder
      .success(client, null)
      .setAuthor({
        name: message.t("commands.bl.embed_author"),
        iconURL: client.user.displayAvatarURL({ size: 64 }),
      })
      .setDescription(null)
      .addFields(
        {
          name: message.t("commands.bl.field_target"),
          value: target ? `<@${target.id}> (\`${target.tag}\`)` : `\`${targetId}\``,
          inline: true,
        },
        {
          name: message.t("commands.bl.field_moderator"),
          value: `<@${message.author.id}>`,
          inline: true,
        },
        {
          name: message.t("commands.bl.field_total"),
          value: `\`${list.length}\``,
          inline: true,
        },
        {
          name: message.t("commands.bl.field_server_bans"),
          value: message.t("commands.bl.server_bans_value", { banned, failed }),
          inline: true,
        },
        { name: message.t("commands.bl.field_reason"), value: `\`\`\`\n${reason.slice(0, 1000)}\n\`\`\`` },
      );
    return message.reply({ embeds: [embed] }).catch(() => {});
  },
};
