const { AttachmentBuilder } = require("discord.js");

const nfFr = new Intl.NumberFormat("fr-FR");

module.exports = {
  name: "rank",
  aliases: ["level", "xp"],
  description: "Affiche la carte de niveau d'un utilisateur.",
  category: "levels",
  usage: "+rank [@user]",
  async execute(client, message, args) {
    const target =
      message.mentions.members.first() ||
      message.guild.members.cache.get(args[0]) ||
      message.member;

    if (!target) {
      return message
        .reply({
          embeds: [
            client.embedBuilder.error(
              client,
              message.t("commands.rank.no_target"),
            ),
          ],
        })
        .catch(() => {});
    }

    if (target.user.bot) {
      return message
        .reply({
          embeds: [
            client.embedBuilder.warning(
              client,
              message.t("commands.rank.no_bots"),
            ),
          ],
        })
        .catch(() => {});
    }

    const userData = client.db.getUser(target.id, message.guild.id);
    const currentXp = userData.xp;
    const currentLevel = userData.level;
    const nextLevel = currentLevel + 1;
    const xpRequiredForNextLevel = Math.pow(nextLevel * 10, 2);

    const allUsers = client.db.db
      .prepare("SELECT * FROM users WHERE guildId = ? ORDER BY xp DESC")
      .all(message.guild.id);
    const rankIndex = allUsers.findIndex((u) => u.userId === target.id) + 1;

    try {
      let activeBg = "default";
      const hasGalaxy = client.db.db
        .prepare(
          "SELECT * FROM inventory WHERE userId = ? AND guildId = ? AND item = ?",
        )
        .get(target.id, message.guild.id, "bg_galaxy");
      const hasHacker = client.db.db
        .prepare(
          "SELECT * FROM inventory WHERE userId = ? AND guildId = ? AND item = ?",
        )
        .get(target.id, message.guild.id, "bg_hacker");

      if (hasHacker && hasHacker.amount > 0) activeBg = "bg_hacker";
      else if (hasGalaxy && hasGalaxy.amount > 0) activeBg = "bg_galaxy";

      const buffer = await client.canvas.generateRankCard(
        target.user,
        currentLevel,
        currentXp,
        xpRequiredForNextLevel,
        rankIndex,
        target.presence ? target.presence.status : "offline",
        activeBg,
      );

      const attachment = new AttachmentBuilder(buffer, {
        name: "rankcard.png",
      });
      const progress = Math.min(
        100,
        Math.floor((currentXp / xpRequiredForNextLevel) * 100),
      );

      const embed = client.embedBuilder
        .premium(
          client,
          message.t("commands.rank.title", { user: target.user.username }),
          `<@${target.id}>`,
        )
        .setAuthor({
          name: target.user.tag,
          iconURL: target.user.displayAvatarURL({ size: 64 }),
        })
        .setThumbnail(target.user.displayAvatarURL({ size: 256 }))
        .setImage("attachment://rankcard.png")
        .addFields(
          {
            name: message.t("commands.rank.field_level"),
            value: `\`${nfFr.format(currentLevel)}\``,
            inline: true,
          },
          {
            name: message.t("commands.rank.field_rank"),
            value: rankIndex > 0 ? `\`#${nfFr.format(rankIndex)}\`` : "`—`",
            inline: true,
          },
          {
            name: message.t("commands.rank.field_xp"),
            value: `\`${nfFr.format(currentXp)}\``,
            inline: true,
          },
          {
            name: message.t("commands.rank.field_progress"),
            value: message.t("commands.rank.progress_block", {
              cur: nfFr.format(currentXp),
              req: nfFr.format(xpRequiredForNextLevel),
              left: nfFr.format(
                Math.max(0, xpRequiredForNextLevel - currentXp),
              ),
              pct: progress,
            }),
            inline: false,
          },
        );

      await message
        .reply({ embeds: [embed], files: [attachment] })
        .catch(() => {});
    } catch (err) {
      await message
        .reply({
          embeds: [
            client.embedBuilder.error(
              client,
              message.t("commands.rank.card_unavailable"),
            ),
          ],
        })
        .catch(() => {});
    }
  },
};
