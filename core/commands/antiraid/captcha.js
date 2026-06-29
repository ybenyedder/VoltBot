const { PermissionFlagsBits } = require("discord.js");

module.exports = {
  name: "captcha",
  description: "Configure le système de captcha",
  category: "antiraid",
  usage: "captcha",
  userPerms: [PermissionFlagsBits.Administrator],
  botPerms: [PermissionFlagsBits.ManageGuild, PermissionFlagsBits.ManageRoles],
  async execute(client, message, args) {
    const guildSettings = client.db.getGuild(message.guild.id);
    const captcha = guildSettings.captcha || {
      enabled: false,
      role: null,
      channel: null,
    };
    const p = client.config.prefix;

    if (!args[0]) {
      const embed = client.embedBuilder
        .base(client, "Captcha")
        .setDescription(null)
        .addFields(
          {
            name: message.t("commands.captcha.field_status"),
            value: captcha.enabled
              ? message.t("commands.captcha.enabled")
              : message.t("commands.captcha.disabled"),
            inline: true,
          },
          {
            name: message.t("commands.captcha.field_role"),
            value: captcha.role
              ? `<@&${captcha.role}>`
              : message.t("commands.captcha.not_set"),
            inline: true,
          },
          {
            name: message.t("commands.captcha.field_channel"),
            value: captcha.channel
              ? `<#${captcha.channel}>`
              : message.t("commands.captcha.not_set"),
            inline: true,
          },
          {
            name: message.t("commands.captcha.field_description"),
            value: message.t("commands.captcha.description_value"),
            inline: false,
          },
          {
            name: message.t("commands.captcha.field_commands"),
            value: `\`${p}captcha enable\` \`${p}captcha disable\` \`${p}captcha role @role\` \`${p}captcha channel #salon\``,
            inline: false,
          },
        );
      return message.reply({ embeds: [embed] }).catch(() => {});
    }

    if (args[0] === "enable") {
      if (captcha.enabled) {
        return message
          .reply({
            embeds: [
              client.embedBuilder.warning(
                client,
                message.t("commands.captcha.module_already_enabled"),
              ),
            ],
          })
          .catch(() => {});
      }
      client.db.updateGuild(message.guild.id, {
        captcha: { ...captcha, enabled: true },
      });
      return message
        .reply({
          embeds: [
            client.embedBuilder.success(
              client,
              message.t("commands.captcha.captcha_enabled"),
            ),
          ],
        })
        .catch(() => {});
    }

    if (args[0] === "disable") {
      if (!captcha.enabled) {
        return message
          .reply({
            embeds: [
              client.embedBuilder.warning(
                client,
                message.t("commands.captcha.module_already_disabled"),
              ),
            ],
          })
          .catch(() => {});
      }
      client.db.updateGuild(message.guild.id, {
        captcha: { ...captcha, enabled: false },
      });
      return message
        .reply({
          embeds: [
            client.embedBuilder.warning(
              client,
              message.t("commands.captcha.captcha_disabled"),
            ),
          ],
        })
        .catch(() => {});
    }

    if (args[0] === "role") {
      const role = message.mentions.roles.first();
      if (!role)
        return message
          .reply({
            embeds: [
              client.embedBuilder.error(
                client,
                message.t("commands.captcha.role_not_found"),
              ),
            ],
          })
          .catch(() => {});
      client.db.updateGuild(message.guild.id, {
        captcha: { ...captcha, role: role.id },
      });
      return message
        .reply({
          embeds: [
            client.embedBuilder.success(
              client,
              message.t("commands.captcha.role_set", { role }),
            ),
          ],
        })
        .catch(() => {});
    }

    if (args[0] === "channel") {
      const channel = message.mentions.channels.first();
      if (!channel)
        return message
          .reply({
            embeds: [
              client.embedBuilder.error(
                client,
                message.t("commands.captcha.channel_not_found"),
              ),
            ],
          })
          .catch(() => {});
      client.db.updateGuild(message.guild.id, {
        captcha: { ...captcha, channel: channel.id },
      });
      return message
        .reply({
          embeds: [
            client.embedBuilder.success(
              client,
              message.t("commands.captcha.channel_set", { channel }),
            ),
          ],
        })
        .catch(() => {});
    }

    message
      .reply({
        embeds: [
          client.embedBuilder.error(
            client,
            message.t("commands.captcha.usage", { p }),
          ),
        ],
      })
      .catch(() => {});
  },
};
