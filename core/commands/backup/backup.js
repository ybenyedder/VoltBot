const {
  PermissionsBitField,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
} = require("discord.js");
const fs = require("fs");
const path = require("path");
const permissions = require("../../utils/permissions");
const Logger = require("../../utils/logger");

const safeEdit = async (msg, payload, channel) => {
  if (!msg) {
    if (channel) await channel.send(payload).catch(() => {});
    return;
  }
  await msg.edit(payload).catch(async () => {
    if (channel) await channel.send(payload).catch(() => {});
  });
};

const formatBytes = (bytes) => {
  if (!bytes || bytes < 1024) return `${bytes || 0} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
};

const fmtNum = (n) => new Intl.NumberFormat("fr-FR").format(n);
const tsRel = (ms) => `<t:${Math.floor(ms / 1000)}:R>`;

module.exports = {
  name: "backup",
  aliases: [
    "save",
    "sauvegarder",
    "restore",
    "restaurer",
    "backup-create",
    "backup-load",
    "createbackup",
    "loadbackup",
  ],
  description: "Gère les sauvegardes du serveur (créer, lister, restaurer).",
  category: "backup",
  usage: "+backup [create | load <id> | list | delete <id>]",
  userPerms: [PermissionsBitField.Flags.Administrator],
  botPerms: [PermissionsBitField.Flags.Administrator],
  async execute(client, message, args) {
    const sub = args[0]?.toLowerCase();

    if (!sub) {
      const embed = client.embedBuilder
        .info(client, message.t("commands.backup.manage_intro"))
        .addFields(
          { name: message.t("commands.backup.field_create"), value: "`+backup create`", inline: true },
          { name: message.t("commands.backup.field_list"), value: "`+backup list`", inline: true },
          { name: message.t("commands.backup.field_restore"), value: "`+backup load <id>`", inline: true },
          { name: message.t("commands.backup.field_delete"), value: "`+backup delete <id>`", inline: true },
        );

      return message.reply({ embeds: [embed] }).catch(() => {});
    }

    // --- CREATE ---
    if (sub === "create" || sub === "save" || sub === "sauvegarder") {
      if (
        message.author.id !== message.guild.ownerId &&
        !permissions.isPrimaryOwner(message.author.id) &&
        !message.member.permissions.has("Administrator")
      ) {
        return message
          .reply({
            embeds: [client.embedBuilder.error(client, message.t("commands.backup.permission_denied"))],
          })
          .catch(() => {});
      }

      const statusMsg = await message
        .reply({
          embeds: [
            client.embedBuilder.info(client, message.t("commands.backup.backup_in_progress")).addFields({
              name: message.t("commands.backup.field_progress"),
              value: message.t("commands.backup.capturing_server"),
              inline: false,
            }),
          ],
        })
        .catch(() => null);

      try {
        const backupData = {
          name: message.guild.name,
          iconURL: message.guild.iconURL(),
          roles: [],
          categories: [],
          channels: [],
          everyonePermissions:
            message.guild.roles.everyone.permissions.bitfield.toString(),
          createdBy: message.author.id,
          createdAt: Date.now(),
        };

        // Sauvegarder les rôles
        const guildRoles = [...message.guild.roles.cache.values()].sort(
          (a, b) => b.position - a.position,
        );
        guildRoles
          .filter((r) => !r.managed && r.id !== message.guild.id)
          .forEach((role) => {
            backupData.roles.push({
              name: role.name,
              color: role.hexColor,
              hoist: role.hoist,
              permissions: role.permissions.bitfield.toString(),
              mentionable: role.mentionable,
            });
          });

        const mapOverwrites = (channel) => {
          return channel.permissionOverwrites.cache.map((ov) => {
            let roleName = null;
            if (ov.type === 0) {
              const role = message.guild.roles.cache.get(ov.id);
              if (role) roleName = role.name;
            }
            return {
              id: ov.id,
              type: ov.type,
              roleName: roleName,
              allow: ov.allow.bitfield.toString(),
              deny: ov.deny.bitfield.toString(),
            };
          });
        };

        // Sauvegarder les Catégories
        const categories = message.guild.channels.cache
          .filter((c) => c.type === ChannelType.GuildCategory)
          .sort((a, b) => a.position - b.position);

        for (const category of categories.values()) {
          const catData = {
            name: category.name,
            permissions: mapOverwrites(category),
            children: [],
          };

          const children = message.guild.channels.cache
            .filter((c) => c.parentId === category.id)
            .sort((a, b) => a.position - b.position);
          children.forEach((child) => {
            catData.children.push({
              name: child.name,
              type: child.type,
              topic: child.topic,
              nsfw: child.nsfw,
              rateLimitPerUser: child.rateLimitPerUser,
              bitrate: child.bitrate,
              userLimit: child.userLimit,
              permissions: mapOverwrites(child),
            });
          });

          backupData.categories.push(catData);
        }

        // Canaux sans catégorie
        const orphans = message.guild.channels.cache
          .filter((c) => !c.parentId && c.type !== ChannelType.GuildCategory)
          .sort((a, b) => a.position - b.position);
        orphans.forEach((child) => {
          backupData.channels.push({
            name: child.name,
            type: child.type,
            topic: child.topic,
            nsfw: child.nsfw,
            rateLimitPerUser: child.rateLimitPerUser,
            bitrate: child.bitrate,
            userLimit: child.userLimit,
            permissions: mapOverwrites(child),
          });
        });

        const backupId = Date.now().toString();
        const instanceDir = process.env.BOT_INSTANCE_CWD || process.cwd();
        const backupPath = path.join(instanceDir, "data", "backups");

        if (!fs.existsSync(backupPath)) {
          fs.mkdirSync(backupPath, { recursive: true });
        }

        const filePath = path.join(backupPath, `${backupId}.json`);
        fs.writeFileSync(filePath, JSON.stringify(backupData, null, 2));

        const totalChannels =
          backupData.channels.length +
          backupData.categories.reduce((a, b) => a + b.children.length, 0);
        const size = (() => {
          try {
            return fs.statSync(filePath).size;
          } catch (e) {
            return 0;
          }
        })();

        const doneEmbed = client.embedBuilder
          .success(client, message.t("commands.backup.backup_created"))
          .addFields(
            {
              name: message.t("commands.backup.field_roles"),
              value: `\`${fmtNum(backupData.roles.length)}\``,
              inline: true,
            },
            {
              name: message.t("commands.backup.field_categories"),
              value: `\`${fmtNum(backupData.categories.length)}\``,
              inline: true,
            },
            {
              name: message.t("commands.backup.field_channels"),
              value: `\`${fmtNum(totalChannels)}\``,
              inline: true,
            },
            { name: message.t("commands.backup.field_size"), value: `\`${formatBytes(size)}\``, inline: true },
            { name: message.t("commands.backup.field_id"), value: `\`${backupId}\``, inline: true },
          );

        await safeEdit(statusMsg, { embeds: [doneEmbed] }, message.channel);
      } catch (err) {
        Logger.error(
          `[CMD backup] create failed guild=${message.guild?.id} user=${message.author?.id}:`,
          err,
        );
        await safeEdit(
          statusMsg,
          {
            embeds: [client.embedBuilder.error(client, message.t("commands.backup.create_failed"))],
          },
          message.channel,
        );
      }
    }

    // --- LIST ---
    else if (sub === "list") {
      const instanceDir = process.env.BOT_INSTANCE_CWD || process.cwd();
      const backupPath = path.join(instanceDir, "data", "backups");

      if (!fs.existsSync(backupPath)) {
        return message
          .reply({
            embeds: [client.embedBuilder.warning(client, message.t("commands.backup.no_backup"))],
          })
          .catch(() => {});
      }

      const files = fs
        .readdirSync(backupPath)
        .filter((f) => f.endsWith(".json"));

      if (files.length === 0) {
        return message
          .reply({
            embeds: [client.embedBuilder.warning(client, message.t("commands.backup.no_backup"))],
          })
          .catch(() => {});
      }

      const entries = files
        .map((f) => {
          const id = f.replace(".json", "");
          let size = 0;
          let owner = null;
          try {
            size = fs.statSync(path.join(backupPath, f)).size;
          } catch (e) {}
          try {
            const raw = JSON.parse(
              fs.readFileSync(path.join(backupPath, f), "utf8"),
            );
            owner = raw.createdBy || null;
          } catch (e) {}
          return { id, size, owner, ts: parseInt(id) };
        })
        .sort((a, b) => b.ts - a.ts);

      const PAGE_SIZE = 10;
      const totalPages = Math.max(1, Math.ceil(entries.length / PAGE_SIZE));

      const buildEmbed = (page) => {
        const slice = entries.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
        const embed = client.embedBuilder.base(client, message.t("commands.backup.list_title"), null);
        for (const e of slice) {
          const date = Number.isFinite(e.ts) ? tsRel(e.ts) : "`?`";
          const author = e.owner ? `<@${e.owner}>` : "`?`";
          embed.addFields({
            name: `\`${e.id}\``,
            value: message.t("commands.backup.list_entry", {
              date,
              author,
              size: formatBytes(e.size),
              id: e.id,
            }),
            inline: false,
          });
        }
        return embed;
      };

      const buildRow = (page, disabled = false) =>
        new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId("backup_list_prev")
            .setLabel(message.t("commands.backup.btn_prev"))
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(disabled || page === 0),
          new ButtonBuilder()
            .setCustomId("backup_list_page")
            .setLabel(message.t("commands.backup.btn_page", { page: page + 1, total: totalPages }))
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(true),
          new ButtonBuilder()
            .setCustomId("backup_list_next")
            .setLabel(message.t("commands.backup.btn_next"))
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(disabled || page >= totalPages - 1),
        );

      let page = 0;
      const payload = {
        embeds: [buildEmbed(page)],
        components: totalPages > 1 ? [buildRow(page)] : [],
      };
      const listMsg = await message.reply(payload).catch(() => null);
      if (!listMsg || totalPages <= 1) return;

      const collector = listMsg.createMessageComponentCollector({
        filter: (i) => i.user.id === message.author.id,
        time: 120000,
      });

      collector.on("collect", async (i) => {
        if (i.customId === "backup_list_prev" && page > 0) page--;
        else if (i.customId === "backup_list_next" && page < totalPages - 1)
          page++;
        await i
          .update({ embeds: [buildEmbed(page)], components: [buildRow(page)] })
          .catch(() => {});
      });

      collector.on("end", async () => {
        await listMsg
          .edit({ components: [buildRow(page, true)] })
          .catch(() => {});
      });

      return;
    }

    // --- LOAD ---
    else if (sub === "load" || sub === "restore" || sub === "restaurer") {
      const backupId = args[1];
      if (!backupId) {
        return message
          .reply({
            embeds: [client.embedBuilder.error(client, message.t("commands.backup.id_not_found"))],
          })
          .catch(() => {});
      }

      if (
        message.author.id !== message.guild.ownerId &&
        !permissions.isPrimaryOwner(message.author.id)
      ) {
        return message
          .reply({
            embeds: [client.embedBuilder.error(client, message.t("commands.backup.permission_denied"))],
          })
          .catch(() => {});
      }

      // Prevent Path Traversal
      if (!/^\d+$/.test(backupId)) {
        return message
          .reply({
            embeds: [client.embedBuilder.error(client, message.t("commands.backup.id_not_found"))],
          })
          .catch(() => {});
      }

      const instanceDir = process.env.BOT_INSTANCE_CWD || process.cwd();
      const backupPath = path.join(
        instanceDir,
        "data",
        "backups",
        `${backupId}.json`,
      );
      if (!fs.existsSync(backupPath)) {
        return message
          .reply({
            embeds: [client.embedBuilder.error(client, message.t("commands.backup.id_not_found"))],
          })
          .catch(() => {});
      }

      let backupData;
      try {
        backupData = JSON.parse(fs.readFileSync(backupPath, "utf8"));
      } catch (e) {
        return message
          .reply({
            embeds: [
              client.embedBuilder.error(client, message.t("commands.backup.backup_corrupted")),
            ],
          })
          .catch(() => {});
      }

      const totalChannels =
        (backupData.channels?.length || 0) +
        (backupData.categories?.reduce(
          (a, b) => a + (b.children?.length || 0),
          0,
        ) || 0);

      const confirmEmbed = client.embedBuilder
        .warning(client, message.t("commands.backup.restore_irreversible"))
        .addFields(
          {
            name: message.t("commands.backup.field_roles"),
            value: `\`${fmtNum(backupData.roles?.length || 0)}\``,
            inline: true,
          },
          {
            name: message.t("commands.backup.field_categories"),
            value: `\`${fmtNum(backupData.categories?.length || 0)}\``,
            inline: true,
          },
          {
            name: message.t("commands.backup.field_channels"),
            value: `\`${fmtNum(totalChannels)}\``,
            inline: true,
          },
          { name: message.t("commands.backup.field_id"), value: `\`${backupId}\``, inline: true },
        );

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("confirm_backup")
          .setLabel(message.t("commands.backup.btn_confirm"))
          .setStyle(ButtonStyle.Danger),
        new ButtonBuilder()
          .setCustomId("cancel_backup")
          .setLabel(message.t("commands.backup.btn_cancel"))
          .setStyle(ButtonStyle.Secondary),
      );

      const confirmMsg = await message
        .reply({ embeds: [confirmEmbed], components: [row] })
        .catch(() => null);
      if (!confirmMsg) return;

      const filter = (i) => i.user.id === message.author.id;
      const collector = confirmMsg.createMessageComponentCollector({
        filter,
        time: 30000,
      });

      collector.on("collect", async (i) => {
        if (i.customId === "cancel_backup") {
          await i
            .update({
              embeds: [
                client.embedBuilder.warning(client, message.t("commands.backup.restore_cancelled")),
              ],
              components: [],
            })
            .catch(() => {});
          return collector.stop("cancelled");
        }

        if (i.customId === "confirm_backup") {
          await i
            .update({
              embeds: [
                client.embedBuilder
                  .info(client, message.t("commands.backup.restore_in_progress"))
                  .addFields({
                    name: message.t("commands.backup.field_phase"),
                    value: message.t("commands.backup.phase_init"),
                    inline: false,
                  }),
              ],
              components: [],
            })
            .catch(() => {});
          collector.stop("confirmed");
        }
      });

      collector.on("end", async (collected, reason) => {
        if (reason !== "confirmed") {
          if (reason === "time") {
            await confirmMsg
              .edit({
                embeds: [client.embedBuilder.warning(client, message.t("commands.backup.timed_out"))],
                components: [],
              })
              .catch(() => {});
          }
          return;
        }

        const totalRoles = backupData.roles?.length || 0;
        const totalCats = backupData.categories?.length || 0;
        const totalOrphans = backupData.channels?.length || 0;
        const totalChildren =
          backupData.categories?.reduce(
            (a, b) => a + (b.children?.length || 0),
            0,
          ) || 0;
        const totalChannelsAll = totalCats + totalChildren + totalOrphans;

        const progressMsg = confirmMsg;
        let lastEdit = 0;
        const PROGRESS_THROTTLE = 2500;

        const renderProgress = (phase) =>
          client.embedBuilder
            .info(client, message.t("commands.backup.restore_in_progress"))
            .addFields({ name: message.t("commands.backup.field_phase"), value: phase, inline: false });

        const pushProgress = async (phase, force = false) => {
          const now = Date.now();
          if (!force && now - lastEdit < PROGRESS_THROTTLE) return;
          lastEdit = now;
          await progressMsg
            .edit({
              embeds: [renderProgress(phase)],
              components: [],
            })
            .catch(() => {});
        };

        try {
          await pushProgress(message.t("commands.backup.phase_delete_channels"), true);

          // Helper: handle Discord 429 with retry-after, otherwise throttle
          const handleRateLimit = async (e) => {
            if (e && (e.status === 429 || e.code === 429)) {
              const retryMs = Math.min(
                5000,
                Math.max(
                  500,
                  Number(e.retry_after || e.retryAfter || 1) * 1000,
                ),
              );
              await new Promise((r) => setTimeout(r, retryMs));
            }
          };

          // 1. Supprimer les salons
          const channels = [...message.guild.channels.cache.values()];
          let purgedCh = 0;
          for (const channel of channels) {
            try {
              await channel.delete();
            } catch (e) {
              await handleRateLimit(e);
            }
            purgedCh++;
            // Channel-delete is a heavy bucket; yield often
            if (purgedCh % 3 === 0) {
              await new Promise((r) => setTimeout(r, 200));
            }
            if (channels.length > 10 && purgedCh % 5 === 0) {
              await pushProgress(
                message.t("commands.backup.phase_delete_channels_count", {
                  done: purgedCh,
                  total: channels.length,
                }),
              );
            }
          }

          // 2. Supprimer les rôles
          await pushProgress(message.t("commands.backup.phase_delete_roles"), true);
          const roles = [...message.guild.roles.cache.values()];
          let purgedRoles = 0;
          for (const role of roles) {
            if (
              role.managed ||
              role.id === message.guild.id ||
              role.name === "@everyone"
            )
              continue;
            try {
              await role.delete();
            } catch (e) {
              await handleRateLimit(e);
            }
            purgedRoles++;
            if (purgedRoles % 5 === 0) {
              await new Promise((r) => setTimeout(r, 150));
            }
            if (roles.length > 10 && purgedRoles % 5 === 0) {
              await pushProgress(message.t("commands.backup.phase_delete_roles_count", { done: purgedRoles }));
            }
          }

          // 3. Recréer les rôles
          const roleMap = new Map();
          let rolesDone = 0;
          await pushProgress(message.t("commands.backup.phase_recreate_roles"), true);
          for (const r of backupData.roles) {
            try {
              const newRole = await message.guild.roles.create({
                name: r.name,
                colors: r.color,
                hoist: r.hoist,
                permissions: BigInt(r.permissions),
                mentionable: r.mentionable,
              });
              roleMap.set(r.name, newRole.id);
            } catch (e) {
              await handleRateLimit(e);
              Logger.error(
                `[CMD backup] role create failed guild=${message.guild?.id} role="${r.name}":`,
                e,
              );
            }
            rolesDone++;
            // Role-create is a 250-per-server hard cap and rate-limited per guild
            if (rolesDone % 5 === 0) {
              await new Promise((r) => setTimeout(r, 200));
            }
            if (totalRoles > 10)
              await pushProgress(
                message.t("commands.backup.phase_recreate_roles_count", {
                  done: rolesDone,
                  total: totalRoles,
                }),
              );
          }

          // Mettre à jour @everyone permissions
          if (backupData.everyonePermissions) {
            try {
              await message.guild.roles.everyone.setPermissions(
                BigInt(backupData.everyonePermissions),
              );
            } catch (e) {}
          }

          const resolveOverwrites = (overwrites) => {
            return overwrites.map((ov) => {
              let targetId = ov.id;
              if (ov.type === 0 && ov.roleName) {
                targetId = roleMap.get(ov.roleName) || ov.id;
              }
              return {
                id: targetId,
                allow: BigInt(ov.allow),
                deny: BigInt(ov.deny),
              };
            });
          };

          // 4. Recréer les catégories et leurs salons
          let channelsDone = 0;
          await pushProgress(message.t("commands.backup.phase_recreate_categories"), true);
          for (const cat of backupData.categories) {
            try {
              const newCat = await message.guild.channels.create({
                name: cat.name,
                type: ChannelType.GuildCategory,
                permissionOverwrites: resolveOverwrites(cat.permissions || []),
              });
              channelsDone++;
              if (channelsDone % 3 === 0) {
                await new Promise((r) => setTimeout(r, 200));
              }
              if (totalChannelsAll > 10)
                await pushProgress(
                  message.t("commands.backup.phase_recreate_channels_count", {
                    done: channelsDone,
                    total: totalChannelsAll,
                  }),
                );

              for (const child of cat.children) {
                try {
                  await message.guild.channels.create({
                    name: child.name,
                    type: child.type,
                    topic: child.topic,
                    nsfw: child.nsfw,
                    rateLimitPerUser: child.rateLimitPerUser,
                    bitrate: child.bitrate,
                    userLimit: child.userLimit,
                    parent: newCat.id,
                    permissionOverwrites: resolveOverwrites(
                      child.permissions || [],
                    ),
                  });
                } catch (e) {
                  await handleRateLimit(e);
                  Logger.error(
                    `[CMD backup] channel create failed guild=${message.guild?.id} channel="${child.name}" parent="${cat.name}":`,
                    e,
                  );
                }
                channelsDone++;
                if (channelsDone % 3 === 0) {
                  await new Promise((r) => setTimeout(r, 200));
                }
                if (totalChannelsAll > 10)
                  await pushProgress(
                    message.t("commands.backup.phase_recreate_channels_count", {
                      done: channelsDone,
                      total: totalChannelsAll,
                    }),
                  );
              }
            } catch (e) {
              await handleRateLimit(e);
              Logger.error(
                `[CMD backup] category create failed guild=${message.guild?.id} category="${cat.name}":`,
                e,
              );
            }
          }

          // 5. Recréer les salons sans catégorie
          if (backupData.channels.length)
            await pushProgress(message.t("commands.backup.phase_recreate_orphans"), true);
          for (const child of backupData.channels) {
            try {
              await message.guild.channels.create({
                name: child.name,
                type: child.type,
                topic: child.topic,
                nsfw: child.nsfw,
                rateLimitPerUser: child.rateLimitPerUser,
                bitrate: child.bitrate,
                userLimit: child.userLimit,
                permissionOverwrites: resolveOverwrites(
                  child.permissions || [],
                ),
              });
            } catch (e) {
              await handleRateLimit(e);
              Logger.error(
                `[CMD backup] orphan channel create failed guild=${message.guild?.id} channel="${child.name}":`,
                e,
              );
            }
            channelsDone++;
            if (channelsDone % 3 === 0) {
              await new Promise((r) => setTimeout(r, 200));
            }
            if (totalChannelsAll > 10)
              await pushProgress(
                message.t("commands.backup.phase_recreate_channels_count", {
                  done: channelsDone,
                  total: totalChannelsAll,
                }),
              );
          }

          const sizeOnDisk = (() => {
            try {
              return fs.statSync(backupPath).size;
            } catch (e) {
              return 0;
            }
          })();

          const doneEmbed = client.embedBuilder
            .success(client, message.t("commands.backup.restore_done"))
            .addFields(
              {
                name: message.t("commands.backup.field_roles"),
                value: `\`${fmtNum(rolesDone)}/${fmtNum(totalRoles)}\``,
                inline: true,
              },
              {
                name: message.t("commands.backup.field_categories"),
                value: `\`${fmtNum(totalCats)}\``,
                inline: true,
              },
              {
                name: message.t("commands.backup.field_channels"),
                value: `\`${fmtNum(channelsDone)}/${fmtNum(totalChannelsAll)}\``,
                inline: true,
              },
              {
                name: message.t("commands.backup.field_size"),
                value: `\`${formatBytes(sizeOnDisk)}\``,
                inline: true,
              },
              { name: message.t("commands.backup.field_id"), value: `\`${backupId}\``, inline: true },
            );

          // Le salon de confirmation a probablement été supprimé : on cible un nouveau salon.
          const finalChannel = message.guild.channels.cache.find(
            (c) =>
              c.type === ChannelType.GuildText &&
              c.permissionsFor(message.guild.members.me).has("SendMessages"),
          );
          if (finalChannel) {
            await finalChannel.send({ embeds: [doneEmbed] }).catch(() => {});
          } else {
            const owner = await message.guild.fetchOwner().catch(() => null);
            if (owner)
              await owner.send({ embeds: [doneEmbed] }).catch(() => {});
          }
        } catch (err) {
          Logger.error(
            `[CMD backup] restore failed guild=${message.guild?.id} user=${message.author?.id}:`,
            err,
          );
          const owner = await message.guild.fetchOwner().catch(() => null);
          if (owner)
            await owner
              .send({
                embeds: [
                  client.embedBuilder.error(client, message.t("commands.backup.restore_failed")),
                ],
              })
              .catch(() => {});
        }
      });
    }

    // --- DELETE ---
    else if (sub === "delete") {
      const backupId = args[1];
      if (!backupId)
        return message
          .reply({
            embeds: [client.embedBuilder.error(client, message.t("commands.backup.id_not_found"))],
          })
          .catch(() => {});

      if (
        message.author.id !== message.guild.ownerId &&
        !permissions.isPrimaryOwner(message.author.id)
      ) {
        return message
          .reply({
            embeds: [client.embedBuilder.error(client, message.t("commands.backup.permission_denied"))],
          })
          .catch(() => {});
      }

      // Prevent Path Traversal
      if (!/^\d+$/.test(backupId)) {
        return message
          .reply({
            embeds: [client.embedBuilder.error(client, message.t("commands.backup.id_not_found"))],
          })
          .catch(() => {});
      }

      const instanceDir = process.env.BOT_INSTANCE_CWD || process.cwd();
      const backupPath = path.join(
        instanceDir,
        "data",
        "backups",
        `${backupId}.json`,
      );
      if (!fs.existsSync(backupPath))
        return message
          .reply({
            embeds: [client.embedBuilder.error(client, message.t("commands.backup.id_not_found"))],
          })
          .catch(() => {});

      const confirmEmbed = client.embedBuilder
        .warning(client, message.t("commands.backup.delete_permanent"))
        .addFields({ name: message.t("commands.backup.field_id"), value: `\`${backupId}\``, inline: true });

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("confirm_delete_backup")
          .setLabel(message.t("commands.backup.btn_confirm"))
          .setStyle(ButtonStyle.Danger),
        new ButtonBuilder()
          .setCustomId("cancel_delete_backup")
          .setLabel(message.t("commands.backup.btn_cancel"))
          .setStyle(ButtonStyle.Secondary),
      );

      const confirmMsg = await message
        .reply({ embeds: [confirmEmbed], components: [row] })
        .catch(() => null);
      if (!confirmMsg) return;

      const collector = confirmMsg.createMessageComponentCollector({
        filter: (i) => i.user.id === message.author.id,
        time: 30000,
      });

      collector.on("collect", async (i) => {
        if (i.customId === "cancel_delete_backup") {
          await i
            .update({
              embeds: [
                client.embedBuilder.warning(client, message.t("commands.backup.delete_cancelled")),
              ],
              components: [],
            })
            .catch(() => {});
          return collector.stop("cancelled");
        }

        if (i.customId === "confirm_delete_backup") {
          try {
            fs.unlinkSync(backupPath);
            await i
              .update({
                embeds: [
                  client.embedBuilder
                    .success(client, message.t("commands.backup.backup_deleted"))
                    .addFields({
                      name: message.t("commands.backup.field_id"),
                      value: `\`${backupId}\``,
                      inline: true,
                    }),
                ],
                components: [],
              })
              .catch(() => {});
          } catch (err) {
            await i
              .update({
                embeds: [
                  client.embedBuilder.error(client, message.t("commands.backup.delete_failed")),
                ],
                components: [],
              })
              .catch(() => {});
          }
          return collector.stop("confirmed");
        }
      });

      collector.on("end", async (collected, reason) => {
        if (reason === "time") {
          await confirmMsg
            .edit({
              embeds: [client.embedBuilder.warning(client, message.t("commands.backup.timed_out"))],
              components: [],
            })
            .catch(() => {});
        }
      });
    }

    // --- COMMANDE INCONNUE ---
    else {
      message
        .reply({
          embeds: [
            client.embedBuilder.error(
              client,
              message.t("commands.backup.unknown_subcommand"),
            ),
          ],
        })
        .catch(() => {});
    }
  },
};
