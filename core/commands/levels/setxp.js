const { PermissionsBitField } = require("discord.js");
const permissions = require("../../utils/permissions");

const nfFr = new Intl.NumberFormat("fr-FR");

module.exports = {
  name: "setxp",
  aliases: ["addxp", "removexp"],
  description: "Ajoute, retire ou définit l'XP d'un membre.",
  category: "levels",
  usage: "+setxp @user [montant]",
  userPerms: [PermissionsBitField.Flags.Administrator],
  async execute(client, message, args) {
    if (!permissions.isAdmin(message)) {
      return message
        .reply({
          embeds: [
            client.embedBuilder.error(
              client,
              message.t("commands.setxp.admin_only"),
            ),
          ],
        })
        .catch(() => {});
    }

    const target =
      message.mentions.members.first() ||
      message.guild.members.cache.get(args[0]);
    if (!target) {
      return message
        .reply({
          embeds: [
            client.embedBuilder.error(
              client,
              message.t("commands.setxp.target_not_found"),
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
              message.t("commands.setxp.bots_no_xp"),
            ),
          ],
        })
        .catch(() => {});
    }

    const amount = parseInt(args[1]);
    if (isNaN(amount) || amount < 0) {
      return message
        .reply({
          embeds: [
            client.embedBuilder.error(
              client,
              message.t("commands.setxp.invalid_level"),
            ),
          ],
        })
        .catch(() => {});
    }

    const invoked = (message.content.split(/\s+/)[0] || "")
      .replace(/^\+/, "")
      .toLowerCase();
    const mode =
      invoked === "addxp" ? "add" : invoked === "removexp" ? "remove" : "set";

    const before = client.db.getUser(target.id, message.guild.id);
    let newXp;
    if (mode === "add") newXp = before.xp + amount;
    else if (mode === "remove") newXp = Math.max(0, before.xp - amount);
    else newXp = amount;

    const newLevel = Math.floor(0.1 * Math.sqrt(newXp));
    // Atomic xp+level write — prevents a transient inconsistent row between
    // the two prior UPDATE statements.
    client.db.setXpAndLevel(target.id, message.guild.id, newXp, newLevel);

    const titles = {
      add: message.t("commands.setxp.title_add"),
      remove: message.t("commands.setxp.title_remove"),
      set: message.t("commands.setxp.title_set"),
    };

    const embed = client.embedBuilder
      .premium(client, titles[mode], `${target}`)
      .addFields(
        { name: message.t("commands.setxp.field_target"), value: `${target}`, inline: true },
        {
          name: message.t("commands.setxp.field_before"),
          value: `\`${nfFr.format(before.xp)} XP · n${nfFr.format(before.level)}\``,
          inline: true,
        },
        {
          name: message.t("commands.setxp.field_after"),
          value: `\`${nfFr.format(newXp)} XP · n${nfFr.format(newLevel)}\``,
          inline: true,
        },
        {
          name: message.t("commands.setxp.field_action"),
          value: `\`${mode}\` ${nfFr.format(amount)} XP`,
          inline: false,
        },
      );

    await message.reply({ embeds: [embed] }).catch(() => {});
  },
};
