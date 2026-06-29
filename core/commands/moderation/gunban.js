const { PermissionFlagsBits } = require("discord.js");

const fmtNum = (n) => new Intl.NumberFormat("fr-FR").format(n || 0);

module.exports = {
  name: "gunban",
  description: "Bannit globalement un utilisateur de tous les serveurs du bot",
  category: "moderation",
  usage: "gunban",
  userPerms: [PermissionFlagsBits.BanMembers],
  ownerOnly: true,
  async execute(client, message, args) {
    if (!args[0]) {
      return message
        .reply({
          embeds: [
            client.embedBuilder.error(
              client,
              message.t("commands.gunban.usage"),
            ),
          ],
        })
        .catch(() => {});
    }

    const user =
      message.mentions.users.first() || client.users.cache.get(args[0]);
    if (!user)
      return message
        .reply({
          embeds: [
            client.embedBuilder.error(client, message.t("commands.gunban.user_not_found")),
          ],
        })
        .catch(() => {});

    const reason =
      args.slice(1).join("") || message.t("commands.gunban.default_reason");

    const globalBans = client.db.getGlobal("globalBans") || [];
    if (!globalBans.find((b) => b.userId === user.id)) {
      globalBans.push({
        userId: user.id,
        userTag: user.tag,
        reason: reason,
        moderator: message.author.id,
        date: new Date().toISOString(),
      });
      client.db.updateGlobal("globalBans", globalBans);
    }

    const statusMsg = await message
      .reply({
        embeds: [
          client.embedBuilder.info(
            client,
            message.t("commands.gunban.banning", {
              user: `<@${user.id}>`,
              count: fmtNum(client.guilds.cache.size),
            }),
          ),
        ],
      })
      .catch(() => null);

    let bannedCount = 0;
    let processedGuilds = 0;
    for (const guild of client.guilds.cache.values()) {
      try {
        await guild.members.ban(user.id, { reason: `[GLOBAL BAN] ${reason}` });
        bannedCount++;
      } catch (error) {
        if (error && (error.status === 429 || error.code === 429)) {
          const retryMs = Math.min(
            5000,
            Math.max(
              500,
              Number(error.retry_after || error.retryAfter || 1) * 1000,
            ),
          );
          await new Promise((r) => setTimeout(r, retryMs));
        }
      }
      processedGuilds++;
      // Yield between cross-guild bans to spread load across global bucket
      if (processedGuilds % 5 === 0) {
        await new Promise((r) => setTimeout(r, 150));
      }
    }

    const embed = client.embedBuilder
      .success(client, "")
      .setDescription(null)
      .setAuthor({
        name: message.t("commands.gunban.title"),
        iconURL: user.displayAvatarURL?.({ size: 64 }),
      })
      .addFields(
        { name: message.t("commands.gunban.field_target"), value: `<@${user.id}>`, inline: true },
        { name: message.t("commands.gunban.field_id"), value: `\`${user.id}\``, inline: true },
        {
          name: message.t("commands.gunban.field_servers"),
          value: `${fmtNum(bannedCount)} / ${fmtNum(client.guilds.cache.size)}`,
          inline: true,
        },
        {
          name: message.t("commands.gunban.field_moderator"),
          value: `<@${message.author.id}>`,
          inline: true,
        },
        { name: message.t("commands.gunban.field_reason"), value: reason, inline: false },
      );

    if (statusMsg)
      await statusMsg
        .edit({ embeds: [embed] })
        .catch(() => message.channel.send({ embeds: [embed] }).catch(() => {}));
    else await message.channel.send({ embeds: [embed] }).catch(() => {});
  },
};
