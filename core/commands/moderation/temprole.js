const { PermissionsBitField } = require("discord.js");
const permissions = require("../../utils/permissions");
const ms = require("ms");

module.exports = {
  name: "temprole",
  description: "Gère les rôles temporaires.",
  category: "moderation",
  usage: "+temprole <membre> <role> <durée> / +temprole list",
  userPerms: [PermissionsBitField.Flags.ManageRoles],
  botPerms: [PermissionsBitField.Flags.ManageRoles],
  async execute(client, message, args) {
    if (args[0] === "list") {
      const temps = client.db.db
        .prepare("SELECT * FROM temporaries WHERE type = 'temprole'")
        .all();
      if (temps.length === 0)
        return message
          .reply({
            embeds: [
              client.embedBuilder.info(client, message.t("commands.temprole.no_active")),
            ],
          })
          .catch(() => {});

      const embed = client.embedBuilder
        .base(client, message.t("commands.temprole.list_title"), message.t("commands.temprole.list_total", { count: temps.length }))
        .addFields(
          temps.slice(0, 24).map((t, i) => {
            const data = JSON.parse(t.data);
            return {
              name: `#${i + 1}`,
              value: message.t("commands.temprole.list_entry", { userId: data.userId, roleId: data.roleId, expires: Math.floor(t.expiresAt / 1000) }),
              inline: true,
            };
          }),
        );

      return message.reply({ embeds: [embed] }).catch(() => {});
    }

    const member =
      message.mentions.members.first() ||
      message.guild.members.cache.get(args[0]);
    const role =
      message.mentions.roles.first() || message.guild.roles.cache.get(args[1]);
    const durationStr = args[2];

    if (!member || !role || !durationStr) {
      return message
        .reply({
          embeds: [
            client.embedBuilder.error(
              client,
              message.t("commands.temprole.usage"),
            ),
          ],
        })
        .catch(() => {});
    }

    const duration = ms(durationStr);
    if (!duration)
      return message
        .reply({
          embeds: [client.embedBuilder.error(client, message.t("commands.temprole.invalid_duration"))],
        })
        .catch(() => {});

    try {
      if (role.comparePositionTo(message.guild.members.me.roles.highest) >= 0) {
        return message
          .reply({
            embeds: [
              client.embedBuilder.error(
                client,
                message.t("commands.temprole.role_too_high"),
              ),
            ],
          })
          .catch(() => {});
      }

      await member.roles.add(role);

      const id = `temprole_${member.id}_${role.id}`;
      const expiresAt = Date.now() + duration;
      const data = JSON.stringify({
        userId: member.id,
        roleId: role.id,
        guildId: message.guild.id,
      });

      client.db.db
        .prepare(
          "INSERT OR REPLACE INTO temporaries (id, type, data, expiresAt) VALUES (?, ?, ?, ?)",
        )
        .run(id, "temprole", data, expiresAt);

      const embed = client.embedBuilder
        .success(
          client,
          message.t("commands.temprole.assigned", { role: role.name, member: member.user.tag }),
        )
        .addFields(
          { name: message.t("commands.temprole.field_duration"), value: durationStr, inline: true },
          {
            name: message.t("commands.temprole.field_expires"),
            value: `<t:${Math.floor(expiresAt / 1000)}:R>`,
            inline: true,
          },
          { name: message.t("commands.temprole.field_moderator"), value: message.author.tag, inline: true },
        );
      await message.reply({ embeds: [embed] }).catch(() => {});
    } catch (err) {
      await message
        .reply({
          embeds: [
            client.embedBuilder.error(
              client,
              message.t("commands.temprole.assign_error"),
            ),
          ],
        })
        .catch(() => {});
    }
  },
};
