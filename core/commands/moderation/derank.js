const { EmbedBuilder, PermissionFlagsBits } = require("discord.js");
const permissions = require("../../utils/permissions");

module.exports = {
  name: "derank",
  description: "Retire tous les rôles d'un utilisateur, sauf ceux ignorés.",
  category: "moderation",
  usage: "+derank <membre> [raison] / +derank ignore <role/del>",
  userPerms: [PermissionFlagsBits.ManageRoles],
  botPerms: [PermissionFlagsBits.ManageRoles],
  async execute(client, message, args) {
    // Gestion des rôles ignorés
    const guildData = client.db.getGuild(message.guild.id);
    let ignoredRoles = JSON.parse(guildData.ignoredDerankRoles || "[]");

    if (args[0] === "ignore") {
      if (!args[1])
        return message
          .reply({
            embeds: [
              client.embedBuilder.error(
                client,
                message.t("commands.derank.usage_ignore"),
              ),
            ],
          })
          .catch(() => {});

      if (args[1] === "del") {
        client.db.updateGuild(message.guild.id, { ignoredDerankRoles: "[]" });
        return message
          .reply({
            embeds: [
              client.embedBuilder.success(
                client,
                message.t("commands.derank.ignored_reset"),
              ),
            ],
          })
          .catch(() => {});
      }

      const role =
        message.mentions.roles.first() ||
        message.guild.roles.cache.get(args[1]);
      if (!role)
        return message
          .reply({
            embeds: [client.embedBuilder.error(client, message.t("commands.derank.role_not_found"))],
          })
          .catch(() => {});

      if (ignoredRoles.includes(role.id)) {
        ignoredRoles = ignoredRoles.filter((id) => id !== role.id);
        client.db.updateGuild(message.guild.id, {
          ignoredDerankRoles: JSON.stringify(ignoredRoles),
        });
        return message
          .reply({
            embeds: [
              client.embedBuilder.success(
                client,
                message.t("commands.derank.role_unignored", { role }),
              ),
            ],
          })
          .catch(() => {});
      } else {
        ignoredRoles.push(role.id);
        client.db.updateGuild(message.guild.id, {
          ignoredDerankRoles: JSON.stringify(ignoredRoles),
        });
        return message
          .reply({
            embeds: [
              client.embedBuilder.success(
                client,
                message.t("commands.derank.role_ignored", { role }),
              ),
            ],
          })
          .catch(() => {});
      }
    }

    const member =
      message.mentions.members.first() ||
      message.guild.members.cache.get(args[0]);
    if (!member)
      return message
        .reply({
          embeds: [
            client.embedBuilder.error(
              client,
              message.t("commands.derank.target_not_found"),
            ),
          ],
        })
        .catch(() => {});

    if (
      member.id === message.guild.ownerId ||
      permissions.isBotOwner(client, member.id)
    ) {
      return message
        .reply({
          embeds: [client.embedBuilder.error(client, message.t("commands.derank.target_protected"))],
        })
        .catch(() => {});
    }

    const ownerBypass = permissions.isPrimaryOwner(message.author.id);

    if (
      !ownerBypass &&
      member.roles.highest.position >= message.member.roles.highest.position &&
      message.author.id !== message.guild.ownerId
    ) {
      return message
        .reply({
          embeds: [
            client.embedBuilder.error(
              client,
              message.t("commands.derank.target_too_high"),
            ),
          ],
        })
        .catch(() => {});
    }

    const reason = args.slice(1).join(" ") || message.t("commands.derank.no_reason");

    try {
      const rolesToRemove = member.roles.cache.filter(
        (role) =>
          role.id !== message.guild.id &&
          !ignoredRoles.includes(role.id) &&
          role.comparePositionTo(message.guild.members.me.roles.highest) < 0 &&
          !role.managed,
      );

      if (rolesToRemove.size === 0)
        return message
          .reply({
            embeds: [
              client.embedBuilder.error(client, message.t("commands.derank.no_removable_roles")),
            ],
          })
          .catch(() => {});

      // Save roles to database for +rerank
      const roleIds = rolesToRemove.map((r) => r.id);
      client.db.updateUser(member.id, message.guild.id, {
        savedRoles: JSON.stringify(roleIds),
      });

      await member.roles.remove(
        rolesToRemove,
        `Derank par ${message.author.tag} | ${reason}`,
      );

      const ts = Math.floor(Date.now() / 1000);
      const embed = client.embedBuilder
        .success(client, "​")
        .setDescription(null)
        .setAuthor({
          name: message.t("commands.derank.embed_title"),
          iconURL: member.user.displayAvatarURL({ size: 256 }),
        })
        .setThumbnail(member.user.displayAvatarURL({ size: 256 }))
        .addFields(
          { name: message.t("commands.derank.field_target"), value: `<@${member.id}>`, inline: true },
          {
            name: message.t("commands.derank.field_moderator"),
            value: `<@${message.author.id}>`,
            inline: true,
          },
          {
            name: message.t("commands.derank.field_roles"),
            value: `${rolesToRemove.size}`,
            inline: true,
          },
          { name: message.t("commands.derank.field_date"), value: `<t:${ts}:R>`, inline: true },
          { name: message.t("commands.derank.field_reason"), value: reason, inline: false },
        );

      await message.reply({ embeds: [embed] }).catch(() => {});
    } catch (error) {
      await message
        .reply({
          embeds: [client.embedBuilder.error(client, message.t("commands.derank.failed"))],
        })
        .catch(() => {});
    }
  },
};
