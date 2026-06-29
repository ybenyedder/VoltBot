const { PermissionsBitField } = require("discord.js");

const nfFr = new Intl.NumberFormat("fr-FR");

module.exports = {
  name: "dellevelrole",
  description: "Supprime une récompense de rôle pour un niveau.",
  category: "levels",
  usage: "+dellevelrole [niveau]",
  userPerms: [PermissionsBitField.Flags.Administrator],
  async execute(client, message, args) {
    const owners = (process.env.OWNER_ID || "")
      .split(",")
      .map((id) => id.trim())
      .filter(Boolean);
    if (!owners.includes(message.author.id)) {
      return message
        .reply({
          embeds: [
            client.embedBuilder.error(
              client,
              message.t("commands.dellevelrole.owner_only"),
            ),
          ],
        })
        .catch(() => {});
    }

    const level = parseInt(args[0]);
    if (isNaN(level) || level < 1) {
      return message
        .reply({
          embeds: [
            client.embedBuilder.error(
              client,
              message.t("commands.dellevelrole.invalid_level"),
            ),
          ],
        })
        .catch(() => {});
    }

    const existing = client.db.db
      .prepare("SELECT roleId FROM level_roles WHERE guildId = ? AND level = ?")
      .get(message.guild.id, level);
    const info = client.db.db
      .prepare("DELETE FROM level_roles WHERE guildId = ? AND level = ?")
      .run(message.guild.id, level);

    if (info.changes > 0) {
      const roleValue = existing ? `<@&${existing.roleId}>` : "`—`";
      const embed = client.embedBuilder
        .premium(
          client,
          message.t("commands.dellevelrole.removed_title"),
          roleValue,
        )
        .addFields(
          {
            name: message.t("commands.dellevelrole.field_level"),
            value: `\`${nfFr.format(level)}\``,
            inline: true,
          },
          {
            name: message.t("commands.dellevelrole.field_role"),
            value: roleValue,
            inline: true,
          },
          {
            name: message.t("commands.dellevelrole.field_action"),
            value: "`del`",
            inline: true,
          },
        );

      await message.reply({ embeds: [embed] }).catch(() => {});
    } else {
      await message
        .reply({
          embeds: [
            client.embedBuilder.info(
              client,
              message.t("commands.dellevelrole.no_tier", {
                level: nfFr.format(level),
              }),
            ),
          ],
        })
        .catch(() => {});
    }
  },
};
