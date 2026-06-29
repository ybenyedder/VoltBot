const { PermissionFlagsBits } = require("discord.js");
const sanctionUtils = require("../../utils/sanctionUtils");

module.exports = {
  name: "rerank",
  description: "Redonne tous les rôles à un utilisateur",
  category: "moderation",
  usage: "rerank",
  userPerms: [PermissionFlagsBits.ManageRoles],
  botPerms: [PermissionFlagsBits.ManageRoles],
  async execute(client, message, args) {
    if (!args[0]) {
      return message
        .reply({
          embeds: [
            client.embedBuilder.error(
              client,
              message.t("commands.rerank.usage"),
            ),
          ],
        })
        .catch(() => {});
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
              message.t("commands.rerank.user_not_found"),
            ),
          ],
        })
        .catch(() => {});

    const savedRoles = client.db.getUser(
      member.id,
      message.guild.id,
      "savedRoles",
    );
    if (!savedRoles || savedRoles.length === 0) {
      return message
        .reply({
          embeds: [
            client.embedBuilder.error(
              client,
              message.t("commands.rerank.no_saved_roles"),
            ),
          ],
        })
        .catch(() => {});
    }

    try {
      const rolesToAdd = savedRoles.filter(
        (roleId) =>
          message.guild.roles.cache.has(roleId) &&
          !member.roles.cache.has(roleId),
      );

      if (rolesToAdd.length === 0) {
        return message
          .reply({
            embeds: [
              client.embedBuilder.error(
                client,
                message.t("commands.rerank.already_all_roles"),
              ),
            ],
          })
          .catch(() => {});
      }

      await member.roles.add(rolesToAdd);
      await sanctionUtils.sendSanctionLiftDm(
        client,
        member,
        message.guild,
        "derank",
        message.t("commands.rerank.roles_restored", {
          count: rolesToAdd.length,
        }),
      );

      const embed = client.embedBuilder
        .success(
          client,
          message.t("commands.rerank.success", { user: member.user.tag }),
        )
        .addFields(
          {
            name: message.t("commands.rerank.field_roles_given"),
            value: `${rolesToAdd.length}`,
            inline: true,
          },
          {
            name: message.t("commands.rerank.field_moderator"),
            value: message.author.tag,
            inline: true,
          },
          {
            name: message.t("commands.rerank.field_list"),
            value:
              rolesToAdd
                .slice(0, 30)
                .map((id) => `<@&${id}>`)
                .join("") || "—",
            inline: false,
          },
        );

      await message.reply({ embeds: [embed] }).catch(() => {});

      const guildSettings = client.db.getGuild(message.guild.id);
      if (guildSettings.modLogsChannel) {
        const logChannel = message.guild.channels.cache.get(
          guildSettings.modLogsChannel,
        );
        if (logChannel)
          logChannel
            .send({
              embeds: [
                client.embedBuilder.modLog(
                  client,
                  message.t("commands.rerank.log_action"),
                  member.user,
                  message.author,
                  message.t("commands.rerank.log_reason", {
                    count: rolesToAdd.length,
                  }),
                  [],
                  message.lang,
                ),
              ],
            })
            .catch(() => {});
      }
    } catch (error) {
      await message
        .reply({
          embeds: [
            client.embedBuilder.error(
              client,
              message.t("commands.rerank.failed"),
            ),
          ],
        })
        .catch(() => {});
    }
  },
};
