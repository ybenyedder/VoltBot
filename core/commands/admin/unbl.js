module.exports = {
  name: "unbl",
  aliases: ["unblacklist"],
  description: "Retire un utilisateur de la blacklist du bot.",
  category: "admin",
  usage: "+unbl <@user|id>",
  ownerOnly: true,
  async execute(client, message, args) {
    if (!args[0]) {
      return message
        .reply({
          embeds: [
            client.embedBuilder.warning(
              client,
              message.t("commands.unbl.missing_target"),
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
            client.embedBuilder.warning(client, message.t("commands.unbl.invalid_id")),
          ],
        })
        .catch(() => {});
    }

    const list = client.db.getGlobal("blacklist") || [];
    const entry = list.find((e) => e.userId === targetId);
    if (!entry) {
      return message
        .reply({
          embeds: [
            client.embedBuilder.warning(
              client,
              message.t("commands.unbl.not_blacklisted"),
            ),
          ],
        })
        .catch(() => {});
    }

    const filtered = list.filter((e) => e.userId !== targetId);
    client.db.updateGlobal("blacklist", filtered);

    let unbanned = 0;
    let skipped = 0;
    for (const guild of client.guilds.cache.values()) {
      const me = guild.members.me;
      if (!me?.permissions.has("BanMembers")) {
        skipped++;
        continue;
      }
      try {
        await guild.bans.remove(targetId, message.t("commands.unbl.unban_reason"));
        unbanned++;
      } catch (e) {
        skipped++;
      }
    }

    const target = await client.users.fetch(targetId).catch(() => null);
    const embed = client.embedBuilder
      .success(client, null)
      .setAuthor({
        name: message.t("commands.unbl.title"),
        iconURL: client.user.displayAvatarURL({ size: 64 }),
      })
      .setDescription(null)
      .addFields(
        {
          name: message.t("commands.unbl.field_target"),
          value: target ? `<@${target.id}> (\`${target.tag}\`)` : `\`${targetId}\``,
          inline: true,
        },
        {
          name: message.t("commands.unbl.field_moderator"),
          value: `<@${message.author.id}>`,
          inline: true,
        },
        {
          name: message.t("commands.unbl.field_remaining"),
          value: `\`${filtered.length}\``,
          inline: true,
        },
        {
          name: message.t("commands.unbl.field_server_unbans"),
          value: message.t("commands.unbl.unbans_value", {
            unbanned,
            skipped,
          }),
          inline: true,
        },
        {
          name: message.t("commands.unbl.field_initial_reason"),
          value: `\`\`\`\n${(entry.reason || message.t("commands.unbl.no_reason")).slice(0, 1000)}\n\`\`\``,
        },
      );
    return message.reply({ embeds: [embed] }).catch(() => {});
  },
};
