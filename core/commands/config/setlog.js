const {
  PermissionsBitField,
  ChannelType,
  PermissionFlagsBits,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require("discord.js");
const logger = require("../../utils/logger");

module.exports = {
  name: "setlog",
  aliases: ["logs", "setlogs", "logsetup", "setlogchannel"],
  description: "Configure les salons de logs catégorisés.",
  category: "config",
  usage: "+setlog [setup | voice | raid | msg | mod | all] [#salon]",
  userPerms: [PermissionsBitField.Flags.Administrator],
  async execute(client, message, args) {
    const sub = args[0]?.toLowerCase();
    const gs = client.db.getGuild(message.guild.id) || {};
    const ch = (id) => (id ? `<#${id}>` : message.t("commands.setlog.none"));

    if (!sub) {
      const embed = client.embedBuilder
        .info(client, message.t("commands.setlog.no_argument"))
        .setAuthor({
          name: message.t("commands.setlog.author_logs"),
          iconURL: client.user.displayAvatarURL(),
        })
        .setDescription(null)
        .addFields(
          {
            name: message.t("commands.setlog.field_mod"),
            value: ch(gs.modLogsChannel),
            inline: true,
          },
          {
            name: message.t("commands.setlog.field_raid"),
            value: ch(gs.raidLogsChannel),
            inline: true,
          },
          {
            name: message.t("commands.setlog.field_msg"),
            value: ch(gs.msgLogsChannel),
            inline: true,
          },
          {
            name: message.t("commands.setlog.field_voice"),
            value: ch(gs.voiceLogsChannel),
            inline: true,
          },
          {
            name: message.t("commands.setlog.field_usage"),
            value:
              "`+setlog setup`\n`+setlog <mod|raid|msg|voice> #salon`\n`+setlog all #salon`\n`+setlog off`",
            inline: false,
          },
        );
      return message.reply({ embeds: [embed] }).catch(() => {});
    }

    if (sub === "all") {
      const targetChannel = message.mentions.channels.first();
      if (!targetChannel) {
        return message
          .reply({
            embeds: [
              client.embedBuilder.error(
                client,
                message.t("commands.setlog.invalid_channel_all"),
              ),
            ],
          })
          .catch(() => {});
      }

      const same =
        gs.modLogsChannel === targetChannel.id &&
        gs.raidLogsChannel === targetChannel.id &&
        gs.msgLogsChannel === targetChannel.id &&
        gs.voiceLogsChannel === targetChannel.id;
      if (same) {
        return message
          .reply({
            embeds: [
              client.embedBuilder.warning(
                client,
                message.t("commands.setlog.same_value"),
              ),
            ],
          })
          .catch(() => {});
      }

      client.db.updateGuild(message.guild.id, {
        modLogsChannel: targetChannel.id,
        raidLogsChannel: targetChannel.id,
        msgLogsChannel: targetChannel.id,
        voiceLogsChannel: targetChannel.id,
      });
      const embed = client.embedBuilder
        .success(client, null)
        .setAuthor({
          name: message.t("commands.setlog.author_logs"),
          iconURL: client.user.displayAvatarURL(),
        })
        .setDescription(null)
        .addFields(
          {
            name: message.t("commands.setlog.field_before"),
            value: `Mod ${ch(gs.modLogsChannel)}\nRaid ${ch(gs.raidLogsChannel)}\nMsg ${ch(gs.msgLogsChannel)}\nVoice ${ch(gs.voiceLogsChannel)}`,
            inline: true,
          },
          {
            name: message.t("commands.setlog.field_after"),
            value: message.t("commands.setlog.all_value", {
              channel: `<#${targetChannel.id}>`,
            }),
            inline: true,
          },
        );
      return message.reply({ embeds: [embed] }).catch(() => {});
    }

    if (sub === "setup") {
      const loading = await message
        .reply({
          embeds: [
            client.embedBuilder.info(
              client,
              message.t("commands.setlog.creating"),
            ),
          ],
        })
        .catch(() => {});

      try {
        const existingCategory = message.guild.channels.cache.find(
          (c) => c.type === ChannelType.GuildCategory && c.name === "All logs",
        );

        if (existingCategory) {
          const warn = {
            embeds: [
              client.embedBuilder.warning(
                client,
                message.t("commands.setlog.category_exists"),
              ),
            ],
          };
          if (loading) return loading.edit(warn).catch(() => {});
          return message.channel.send(warn).catch(() => {});
        }

        const category = await message.guild.channels.create({
          name: "All logs",
          type: ChannelType.GuildCategory,
          permissionOverwrites: [
            { id: message.guild.id, deny: [PermissionFlagsBits.ViewChannel] },
            {
              id: client.user.id,
              allow: [
                PermissionFlagsBits.ViewChannel,
                PermissionFlagsBits.SendMessages,
              ],
            },
          ],
        });

        const channels = [
          { name: "・・raid-logs", key: "raidLogsChannel" },
          { name: "・・mod-logs", key: "modLogsChannel" },
          { name: "・・msg-logs", key: "msgLogsChannel" },
          { name: "・・voice-logs", key: "voiceLogsChannel" },
        ];

        const createdChannels = [];
        for (const c of channels) {
          try {
            const created = await message.guild.channels.create({
              name: c.name,
              type: ChannelType.GuildText,
              parent: category.id,
              permissionOverwrites: [
                {
                  id: message.guild.id,
                  deny: [PermissionFlagsBits.ViewChannel],
                },
                {
                  id: client.user.id,
                  allow: [
                    PermissionFlagsBits.ViewChannel,
                    PermissionFlagsBits.SendMessages,
                  ],
                },
              ],
            });
            client.db.updateGuild(message.guild.id, { [c.key]: created.id });
            createdChannels.push(created);
          } catch (error) {
            logger.warn(
              `[SETLOGS] Impossible de créer ${c.name}: ${error.message}`,
            );
          }
        }

        if (createdChannels.length > 0) {
          const embed = client.embedBuilder
            .success(client, null)
            .setAuthor({
              name: message.t("commands.setlog.author_logs"),
              iconURL: client.user.displayAvatarURL(),
            })
            .setDescription(null)
            .addFields(
              {
                name: message.t("commands.setlog.field_category"),
                value: `**${category.name}**`,
                inline: true,
              },
              {
                name: message.t("commands.setlog.field_channels"),
                value: message.t("commands.setlog.channels_created", {
                  count: createdChannels.length,
                }),
                inline: true,
              },
            );
          const ok = { embeds: [embed] };
          if (loading) return loading.edit(ok).catch(() => {});
          return message.channel.send(ok).catch(() => {});
        }
        const err = {
          embeds: [
            client.embedBuilder.error(
              client,
              message.t("commands.setlog.creation_failed"),
            ),
          ],
        };
        if (loading) return loading.edit(err).catch(() => {});
        return message.channel.send(err).catch(() => {});
      } catch (e) {
        const err = {
          embeds: [
            client.embedBuilder.error(
              client,
              message.t("commands.setlog.config_failed"),
            ),
          ],
        };
        if (loading) return loading.edit(err).catch(() => {});
        return message.channel.send(err).catch(() => {});
      }
    }

    if (sub === "off") {
      const anySet =
        gs.modLogsChannel ||
        gs.raidLogsChannel ||
        gs.msgLogsChannel ||
        gs.voiceLogsChannel;
      if (!anySet) {
        return message
          .reply({
            embeds: [
              client.embedBuilder.warning(
                client,
                message.t("commands.setlog.same_value"),
              ),
            ],
          })
          .catch(() => {});
      }

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`setlog_off_confirm_${message.id}`)
          .setLabel(message.t("commands.setlog.btn_confirm"))
          .setStyle(ButtonStyle.Danger),
        new ButtonBuilder()
          .setCustomId(`setlog_off_cancel_${message.id}`)
          .setLabel(message.t("commands.setlog.btn_cancel"))
          .setStyle(ButtonStyle.Secondary),
      );
      const prompt = await message
        .reply({
          embeds: [
            client.embedBuilder
              .warning(client, null)
              .setAuthor({
                name: message.t("commands.setlog.author_logs"),
                iconURL: client.user.displayAvatarURL(),
              })
              .setDescription(message.t("commands.setlog.disable_all_desc"))
              .addFields(
                {
                  name: message.t("commands.setlog.field_mod"),
                  value: ch(gs.modLogsChannel),
                  inline: true,
                },
                {
                  name: message.t("commands.setlog.field_raid"),
                  value: ch(gs.raidLogsChannel),
                  inline: true,
                },
                {
                  name: message.t("commands.setlog.field_msg"),
                  value: ch(gs.msgLogsChannel),
                  inline: true,
                },
                {
                  name: message.t("commands.setlog.field_voice"),
                  value: ch(gs.voiceLogsChannel),
                  inline: true,
                },
              ),
          ],
          components: [row],
        })
        .catch(() => null);
      if (!prompt) return;

      const collector = prompt.createMessageComponentCollector({
        filter: (i) => i.user.id === message.author.id,
        time: 120000,
        max: 1,
      });

      collector.on("collect", async (i) => {
        const disabled = new ActionRowBuilder().addComponents(
          ...row.components.map((b) => ButtonBuilder.from(b).setDisabled(true)),
        );
        if (i.customId.startsWith("setlog_off_confirm_")) {
          client.db.updateGuild(message.guild.id, {
            modLogsChannel: null,
            raidLogsChannel: null,
            msgLogsChannel: null,
            voiceLogsChannel: null,
          });
          const embed = client.embedBuilder
            .success(client, null)
            .setAuthor({
              name: message.t("commands.setlog.author_logs"),
              iconURL: client.user.displayAvatarURL(),
            })
            .setDescription(
              "```diff\n- Mod / Raid / Msg / Voice\n+ Aucun\n```",
            );
          await i
            .update({ embeds: [embed], components: [disabled] })
            .catch(() => {});
        } else {
          await i
            .update({
              embeds: [
                client.embedBuilder.info(
                  client,
                  message.t("commands.setlog.action_cancelled"),
                ),
              ],
              components: [disabled],
            })
            .catch(() => {});
        }
      });

      collector.on("end", async (_, reason) => {
        if (reason === "time") {
          const disabled = new ActionRowBuilder().addComponents(
            ...row.components.map((b) =>
              ButtonBuilder.from(b).setDisabled(true),
            ),
          );
          await prompt.edit({ components: [disabled] }).catch(() => {});
        }
      });
      return;
    }

    const typeMap = {
      mod: { key: "modLogsChannel" },
      raid: { key: "raidLogsChannel" },
      msg: { key: "msgLogsChannel" },
      voice: { key: "voiceLogsChannel" },
    };

    if (!typeMap[sub]) {
      return message
        .reply({
          embeds: [
            client.embedBuilder.error(
              client,
              message.t("commands.setlog.invalid_type"),
            ),
          ],
        })
        .catch(() => {});
    }

    const targetChannel = message.mentions.channels.first();
    if (!targetChannel) {
      return message
        .reply({
          embeds: [
            client.embedBuilder.error(
              client,
              message.t("commands.setlog.invalid_channel_type", { sub }),
            ),
          ],
        })
        .catch(() => {});
    }

    const oldId = gs[typeMap[sub].key];
    if (oldId === targetChannel.id) {
      return message
        .reply({
          embeds: [
            client.embedBuilder.warning(
              client,
              message.t("commands.setlog.same_value"),
            ),
          ],
        })
        .catch(() => {});
    }

    client.db.updateGuild(message.guild.id, {
      [typeMap[sub].key]: targetChannel.id,
    });
    const embed = client.embedBuilder
      .success(client, null)
      .setAuthor({
        name: message.t("commands.setlog.author_type_logs", { sub }),
        iconURL: client.user.displayAvatarURL(),
      })
      .setDescription(null)
      .addFields(
        {
          name: message.t("commands.setlog.field_before"),
          value: ch(oldId),
          inline: true,
        },
        {
          name: message.t("commands.setlog.field_after"),
          value: `<#${targetChannel.id}>`,
          inline: true,
        },
      );
    return message.reply({ embeds: [embed] }).catch(() => {});
  },
};
