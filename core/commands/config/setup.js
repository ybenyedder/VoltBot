const { PermissionsBitField } = require("discord.js");
const permissions = require("../../utils/permissions");
const logger = require("../../utils/logger");

module.exports = {
  name: "setup",
  aliases: ["initialisation", "config-rapide", "auto-config"],
  description: "Lance un setup rapide (création de salons de base).",
  category: "config",
  usage: "+setup",
  userPerms: [PermissionsBitField.Flags.Administrator],
  botPerms: [PermissionsBitField.Flags.ManageChannels],
  async execute(client, message, args) {
    if (!permissions.isAdmin(message)) {
      return message
        .reply({
          embeds: [
            client.embedBuilder.error(client, message.t("commands.setup.admin_only")),
          ],
        })
        .catch(() => {});
    }

    const reply = await message
      .reply({
        embeds: [client.embedBuilder.info(client, message.t("commands.setup.initializing"))],
      })
      .catch(() => {});

    try {
      const existingGuild = client.db.getGuild(message.guild.id);
      const channelsToCreate = [];

      if (!existingGuild.modLogsChannel) {
        channelsToCreate.push({
          name: "・logs-modération",
          type: "modLogsChannel",
          description: message.t("commands.setup.desc_modlogs"),
        });
      }
      if (!existingGuild.welcomeChannel) {
        channelsToCreate.push({
          name: "・bienvenue",
          type: "welcomeChannel",
          description: message.t("commands.setup.desc_welcome"),
        });
      }
      if (!existingGuild.levelChannel) {
        channelsToCreate.push({
          name: "・niveaux",
          type: "levelChannel",
          description: message.t("commands.setup.desc_levels"),
        });
      }

      if (channelsToCreate.length === 0) {
        return reply
          .edit({
            embeds: [
              client.embedBuilder.warning(
                client,
                message.t("commands.setup.all_configured"),
              ),
            ],
          })
          .catch(() => {});
      }

      const total = channelsToCreate.length;
      const createdChannels = [];
      const failed = [];

      for (let idx = 0; idx < total; idx++) {
        const channelInfo = channelsToCreate[idx];

        if (reply) {
          await reply
            .edit({
              embeds: [
                client.embedBuilder.info(
                  client,
                  message.t("commands.setup.creating", {
                    current: idx + 1,
                    total,
                    description: channelInfo.description,
                  }),
                ),
              ],
            })
            .catch(() => {});
        }

        try {
          const channel = await message.guild.channels.create({
            name: channelInfo.name,
            reason: `Setup automatique - ${channelInfo.description}`,
          });

          client.db.updateGuild(message.guild.id, {
            [channelInfo.type]: channel.id,
          });
          createdChannels.push(channel);
        } catch (error) {
          failed.push(channelInfo.name);
          logger.warn(
            `[SETUP] Impossible de créer le salon ${channelInfo.name}: ${error.message}`,
          );
        }
      }

      if (createdChannels.length > 0) {
        const fields = [
          {
            name: message.t("commands.setup.field_created"),
            value: `**${createdChannels.length}**`,
            inline: true,
          },
          {
            name: message.t("commands.setup.field_failed"),
            value: `${failed.length}`,
            inline: true,
          },
          {
            name: message.t("commands.setup.field_total"),
            value: `${total}`,
            inline: true,
          },
          {
            name: message.t("commands.setup.field_channels"),
            value: createdChannels.map((ch) => `<#${ch.id}>`).join("\n"),
            inline: false,
          },
        ];
        if (failed.length) {
          fields.push({
            name: message.t("commands.setup.field_missed"),
            value: failed.map((n) => `\`${n}\``).join("\n"),
            inline: false,
          });
        }

        await reply
          .edit({
            embeds: [
              client.embedBuilder
                .success(client, message.t("commands.setup.completed"))
                .addFields(...fields),
            ],
          })
          .catch(() => {});
      } else {
        await reply
          .edit({
            embeds: [
              client.embedBuilder.error(
                client,
                message.t("commands.setup.none_created"),
              ),
            ],
          })
          .catch(() => {});
      }
    } catch (e) {
      await reply
        .edit({
          embeds: [client.embedBuilder.error(client, message.t("commands.setup.error"))],
        })
        .catch(() => {});
    }
  },
};
