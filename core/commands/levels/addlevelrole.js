const { PermissionsBitField } = require("discord.js");

const nfFr = new Intl.NumberFormat("fr-FR");

module.exports = {
  name: "addlevelrole",
  description: "Définit une récompense de rôle pour un niveau.",
  category: "levels",
  usage: "+addlevelrole [niveau] [@role]",
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
              message.t("commands.addlevelrole.owner_only"),
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
              message.t("commands.addlevelrole.invalid_level"),
            ),
          ],
        })
        .catch(() => {});
    }

    const role =
      message.mentions.roles.first() || message.guild.roles.cache.get(args[1]);
    if (!role) {
      return message
        .reply({
          embeds: [
            client.embedBuilder.error(
              client,
              message.t("commands.addlevelrole.missing_role"),
            ),
          ],
        })
        .catch(() => {});
    }

    if (role.managed || role.id === message.guild.id) {
      return message
        .reply({
          embeds: [
            client.embedBuilder.error(
              client,
              message.t("commands.addlevelrole.missing_role"),
            ),
          ],
        })
        .catch(() => {});
    }

    const existing = client.db.db
      .prepare(
        "SELECT id, roleId FROM level_roles WHERE guildId = ? AND level = ?",
      )
      .get(message.guild.id, level);

    if (existing) {
      client.db.db
        .prepare(
          "UPDATE level_roles SET roleId = ? WHERE guildId = ? AND level = ?",
        )
        .run(role.id, message.guild.id, level);
    } else {
      client.db.db
        .prepare(
          "INSERT INTO level_roles (guildId, level, roleId) VALUES (?, ?, ?)",
        )
        .run(message.guild.id, level, role.id);
    }

    const embed = client.embedBuilder
      .premium(
        client,
        message.t("commands.addlevelrole.added_title"),
        `<@&${role.id}>`,
      )
      .addFields(
        {
          name: message.t("commands.addlevelrole.field_level"),
          value: `\`${nfFr.format(level)}\``,
          inline: true,
        },
        {
          name: message.t("commands.addlevelrole.field_role"),
          value: `<@&${role.id}>`,
          inline: true,
        },
        {
          name: message.t("commands.addlevelrole.field_action"),
          value: "`add`",
          inline: true,
        },
      );

    await message.reply({ embeds: [embed] }).catch(() => {});
  },
};
