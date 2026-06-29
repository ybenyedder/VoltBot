const {
  EmbedBuilder,
  ChannelType,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  AuditLogEvent,
} = require("discord.js");
const { t } = require("../utils/i18n");

module.exports = {
  name: "voiceStateUpdate",
  async execute(oldState, newState, client) {
    if (!oldState.guild) return;

    // --- VOICEMASTER ---
    try {
      const vmConfig = client.db.getVoiceMasterConfig(oldState.guild.id);

      if (
        newState.channelId &&
        vmConfig &&
        newState.channelId === vmConfig.hubChannelId
      ) {
        const newVc = await newState.guild.channels.create({
          name: `${newState.member.user.username}`,
          type: ChannelType.GuildVoice,
          parent: vmConfig.categoryId || newState.channel?.parentId,
          permissionOverwrites: [
            {
              id: newState.member.user.id,
              allow: ["Connect", "ManageChannels", "MoveMembers"],
            },
            { id: newState.guild.id, allow: ["Connect"] },
          ],
        });
        await newState.member.voice.setChannel(newVc);
        client.db.createVoiceMasterChannel(
          newVc.id,
          newState.guild.id,
          newState.member.user.id,
        );
      }

      if (oldState.channelId) {
        const checkVc = client.db.getVoiceMasterChannel(oldState.channelId);
        if (checkVc) {
          const oldChannel = oldState.guild.channels.cache.get(
            oldState.channelId,
          );
          if (oldChannel && oldChannel.members.size === 0) {
            oldChannel
              .delete()
              .catch((err) =>
                client.logger.error(
                  `[VOICEMASTER] Failed to delete old voice channel ${oldState.channelId}: ${err.message}`,
                ),
              );
            client.db.deleteVoiceMasterChannel(oldState.channelId);
          }
        }
      }
    } catch (e) {
      client.logger.error(
        `[VOICEMASTER] Error in voiceStateUpdate for guild ${oldState.guild.id}: ${e.message}`,
      );
    }

    // --- TEMPVC ---
    try {
      const tvConfig = client.db.getTempVCConfig(oldState.guild.id);

      if (tvConfig) {
        const tvGs = client.db.getGuild(oldState.guild.id);
        const lang = tvGs.language || "fr";
        // Rejoindre le hub -> créer un VC temp
        if (newState.channelId && newState.channelId === tvConfig.hubId) {
          // Throttle: 5s par utilisateur pour empêcher le spam de création
          if (!client.tempvcCooldowns) client.tempvcCooldowns = new Map();
          const userId = newState.member.user.id;
          const last = client.tempvcCooldowns.get(userId) || 0;
          const now = Date.now();
          if (now - last < 5000) {
            await newState.member.voice.disconnect().catch(() => {});
            return;
          }
          client.tempvcCooldowns.set(userId, now);

          const tempVc = await newState.guild.channels.create({
            name: `${newState.member.user.username}`,
            type: ChannelType.GuildVoice,
            parent: tvConfig.categoryId,
            permissionOverwrites: [
              {
                id: newState.member.user.id,
                allow: ["Connect", "ManageChannels", "MoveMembers"],
              },
              { id: newState.guild.id, allow: ["Connect"] },
            ],
          });
          await newState.member.voice.setChannel(tempVc);
          client.db.createTempVCChannel(
            tempVc.id,
            newState.guild.id,
            newState.member.user.id,
          );

          const createdTs = Math.floor(Date.now() / 1000);
          const embed = new EmbedBuilder()
            .setColor(client.embedBuilder.getTheme(client))
            .setAuthor({
              name: t(lang, "events.voiceStateUpdate.tempvc_author", {
                user: newState.member.user.username,
              }),
              iconURL: newState.member.user.displayAvatarURL({ size: 256 }),
            })
            .setDescription(
              t(lang, "events.voiceStateUpdate.tempvc_description"),
            )
            .addFields(
              {
                name: t(lang, "events.voiceStateUpdate.tempvc_field_owner"),
                value: `${newState.member}`,
                inline: true,
              },
              {
                name: t(lang, "events.voiceStateUpdate.tempvc_field_access"),
                value: t(lang, "events.voiceStateUpdate.tempvc_access_public"),
                inline: true,
              },
              {
                name: t(lang, "events.voiceStateUpdate.tempvc_field_limit"),
                value: "—",
                inline: true,
              },
              {
                name: t(lang, "events.voiceStateUpdate.tempvc_field_created"),
                value: `<t:${createdTs}:R>`,
                inline: true,
              },
            )
            .setFooter({
              text: t(lang, "events.voiceStateUpdate.tempvc_footer"),
            });

          const row1 = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
              .setCustomId("tempvc_rename")
              .setLabel(t(lang, "events.voiceStateUpdate.btn_rename"))
              .setStyle(ButtonStyle.Secondary),
            new ButtonBuilder()
              .setCustomId("tempvc_limit")
              .setLabel(t(lang, "events.voiceStateUpdate.btn_limit"))
              .setStyle(ButtonStyle.Secondary),
            new ButtonBuilder()
              .setCustomId("tempvc_lock")
              .setLabel(t(lang, "events.voiceStateUpdate.btn_lock"))
              .setStyle(ButtonStyle.Danger),
            new ButtonBuilder()
              .setCustomId("tempvc_unlock")
              .setLabel(t(lang, "events.voiceStateUpdate.btn_unlock"))
              .setStyle(ButtonStyle.Success),
          );

          const row2 = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
              .setCustomId("tempvc_permit")
              .setLabel(t(lang, "events.voiceStateUpdate.btn_permit"))
              .setStyle(ButtonStyle.Success),
            new ButtonBuilder()
              .setCustomId("tempvc_kick")
              .setLabel(t(lang, "events.voiceStateUpdate.btn_kick"))
              .setStyle(ButtonStyle.Danger),
            new ButtonBuilder()
              .setCustomId("tempvc_claim")
              .setLabel(t(lang, "events.voiceStateUpdate.btn_claim"))
              .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
              .setCustomId("tempvc_delete")
              .setLabel(t(lang, "events.voiceStateUpdate.btn_close"))
              .setStyle(ButtonStyle.Danger),
          );

          await tempVc.send({
            content: `${newState.member}`,
            embeds: [embed],
            components: [row1, row2],
          });
        }

        // Quitter un salon -> supprimer si TempVC vide, sinon transférer owner si owner parti
        if (oldState.channelId && oldState.channelId !== newState.channelId) {
          const checkTv = client.db.getTempVCChannel(oldState.channelId);
          if (checkTv) {
            const oldChannel = oldState.guild.channels.cache.get(
              oldState.channelId,
            );
            if (oldChannel && oldChannel.members.size === 0) {
              oldChannel
                .delete()
                .catch((err) =>
                  client.logger.error(
                    `[TEMPVC] Failed to delete old temporary voice channel ${oldState.channelId}: ${err.message}`,
                  ),
                );
              client.db.deleteTempVCChannel(oldState.channelId);
            } else if (
              oldChannel &&
              checkTv.ownerId === oldState.member.id &&
              !oldChannel.members.has(checkTv.ownerId)
            ) {
              // Auto-transfert: owner parti, prendre le plus ancien membre restant
              const nextMember = oldChannel.members
                .filter((m) => !m.user.bot)
                .first();
              if (nextMember) {
                try {
                  client.db.updateTempVCOwner(oldChannel.id, nextMember.id);
                  await oldChannel.permissionOverwrites
                    .edit(nextMember.id, {
                      Connect: true,
                      ManageChannels: true,
                      MoveMembers: true,
                    })
                    .catch(() => {});
                  await oldChannel.permissionOverwrites
                    .edit(oldState.member.id, {
                      ManageChannels: null,
                      MoveMembers: null,
                    })
                    .catch(() => {});
                  await oldChannel
                    .send(
                      t(lang, "events.voiceStateUpdate.new_owner", {
                        member: nextMember,
                      }),
                    )
                    .catch(() => {});
                } catch (err) {
                  client.logger.error(
                    `[TEMPVC] Auto-transfer failed for ${oldChannel.id}: ${err.message}`,
                  );
                }
              }
            }
          }
        }
      }
    } catch (e) {
      client.logger.error(
        `[TEMPVC] Error in voiceStateUpdate for guild ${oldState.guild.id}: ${e.message}`,
      );
    }

    // --- DOG SYSTEM ---
    try {
      if (client.dogMap) {
        const memberId = newState.member.id;
        const guildId = newState.guild.id;

        // CASE 1: The user who moved is a DOG (target)
        const dogEntry = client.dogMap.get(memberId);
        if (dogEntry) {
          const master = newState.guild.members.cache.get(dogEntry.masterId);
          // If dog disconnects or leaves voice, undog them
          if (!newState.channelId) {
            client.dogMap.delete(memberId);
            await client.db.removeDogState(memberId, guildId);
            client.logger.info(
              `[DOG_FEATURE] Undogged ${memberId} (disconnected).`,
            );
          } else if (master && master.voice.channelId) {
            // If dog moved to a different channel than master, pull them back
            if (newState.channelId !== master.voice.channelId) {
              newState.setChannel(master.voice.channelId).catch(() => {});
            }
          }
        }

        // CASE 2: The user who moved is a MASTER
        // Find all dogs following this master
        // If master disconnects or leaves voice, undog all their dogs
        if (!newState.channelId) {
          const dogsToUndog = [];
          for (const [dogId, entry] of client.dogMap.entries()) {
            if (entry.masterId === memberId) {
              dogsToUndog.push(dogId);
            }
          }
          for (const dogId of dogsToUndog) {
            client.dogMap.delete(dogId);
            await client.db.removeDogState(dogId, guildId);
            client.logger.info(
              `[DOG_FEATURE] Undogged ${dogId} (master disconnected).`,
            );
          }
        } else {
          // Master moved to a new channel
          for (const [dogId, entry] of client.dogMap.entries()) {
            if (entry.masterId === memberId) {
              const dogMember = newState.guild.members.cache.get(dogId);
              if (dogMember && dogMember.voice.channelId) {
                // If master moved, pull the dog to the new channel
                if (dogMember.voice.channelId !== newState.channelId) {
                  dogMember.voice
                    .setChannel(newState.channelId)
                    .catch(() => {});
                }
              }
            }
          }
        }
      }
    } catch (e) {
      client.logger.error(
        `[DOG_FEATURE] Error in voiceStateUpdate for guild ${oldState.guild.id}: ${e.message}`,
      );
    }

    // --- PV SYSTEM (LOCK BY KICK/MUTE) ---
    try {
      if (
        client.pvMap &&
        newState.channelId &&
        oldState.channelId !== newState.channelId
      ) {
        const pvEntry = client.pvMap.get(newState.channelId);
        if (pvEntry && pvEntry.locked) {
          const pvGs = client.db.getGuild(newState.guild.id);
          const lang = pvGs.language || "fr";
          const owners = process.env.OWNER_ID
            ? process.env.OWNER_ID.split(",").map((id) => id.trim())
            : [];
          const isAuthorized =
            pvEntry.ownerId === newState.member.id ||
            (pvEntry.whitelist &&
              pvEntry.whitelist.includes(newState.member.id)) ||
            owners.includes(newState.member.id);

          if (!isAuthorized) {
            const userId = newState.member.id;
            const nowTs = Date.now();
            const ATTEMPT_TTL_MS = 300000; // 5 min idle => reset
            let rec = pvEntry.attempts[userId];
            // TTL eviction on read: stale entries restart from 0.
            if (!rec || nowTs - rec.lastAttempt > ATTEMPT_TTL_MS) {
              rec = { count: 0, lastAttempt: nowTs };
              pvEntry.attempts[userId] = rec;
            }
            rec.count += 1;
            rec.lastAttempt = nowTs;

            if (rec.count >= 3) {
              await newState.member
                .timeout(
                  60000,
                  t(lang, "events.voiceStateUpdate.pv_timeout_reason"),
                )
                .catch(() => {});
              await newState.member
                .send(t(lang, "events.voiceStateUpdate.pv_muted"))
                .catch(() => {});
              await newState.setChannel(null).catch(() => {});
              delete pvEntry.attempts[userId];
            } else {
              await newState.setChannel(null).catch(() => {});
              await newState.member
                .send(t(lang, "events.voiceStateUpdate.pv_private"))
                .catch(() => {});
            }
          }
        }
      }
    } catch (e) {
      client.logger.error(
        `[PV_CHANNEL] Error in voiceStateUpdate for guild ${oldState.guild.id}: ${e.message}`,
      );
    }

    // --- PV AUTO-UNPV (channel vide => mode privé retiré) ---
    // Race-safe: two voiceStateUpdate handlers can fire near-simultaneously
    // when the last members leave. We "claim" the map entry by deleting it
    // BEFORE doing any work; only the caller that actually removed the entry
    // proceeds to log + DB-delete. The DB DELETE is idempotent anyway, but
    // this prevents duplicate log lines and concurrent SQL writes.
    try {
      if (
        client.pvMap &&
        oldState.channelId &&
        oldState.channelId !== newState.channelId &&
        client.pvMap.has(oldState.channelId)
      ) {
        const leftChannel = oldState.guild.channels.cache.get(
          oldState.channelId,
        );
        if (leftChannel) {
          const remaining = leftChannel.members.filter((m) => !m.user.bot).size;
          if (remaining === 0) {
            // Atomic claim: Map.delete returns true only for the first caller.
            const claimed = client.pvMap.delete(oldState.channelId);
            if (claimed) {
              try {
                client.db.deletePrivateVoice(oldState.channelId);
              } catch (_) {}
              client.logger.event(
                `[PV_AUTO_UNPV] Salon ${oldState.channelId} (${leftChannel.name}) auto-unpv (vide) guild=${oldState.guild.id}`,
              );
            }
          }
        } else {
          // Salon supprimé entre-temps — nettoie quand même (idempotent).
          const claimed = client.pvMap.delete(oldState.channelId);
          if (claimed) {
            try {
              client.db.deletePrivateVoice(oldState.channelId);
            } catch (_) {}
          }
        }
      }
    } catch (e) {
      client.logger.error(
        `[PV_AUTO_UNPV] Error in voiceStateUpdate for guild ${oldState.guild.id}: ${e.message}`,
      );
    }

    // --- LOGS VOCAUX ---
    try {
      if (!oldState.member || !newState.member) return;
      const gs = client.db.getGuild(oldState.guild.id);
      const lang = gs.language || "fr";
      const logChannelId =
        client.db.resolveLogChannel(oldState.guild.id, "voicelog") ||
        client.db.resolveLogChannel(oldState.guild.id, "modlog");
      if (logChannelId) {
        const logsChannel = oldState.guild.channels.cache.get(logChannelId);
        if (logsChannel) {
          const embed = new EmbedBuilder()
            .setAuthor({
              name: oldState.member.user.tag,
              iconURL: oldState.member.user.displayAvatarURL(),
            })
            .setTimestamp()
            .setColor(client.embedBuilder.getTheme(client));

          if (!oldState.channelId && newState.channelId) {
            // Join
            embed
              .setDescription(
                t(lang, "events.voiceStateUpdate.voice_join", {
                  member: oldState.member,
                  channel: newState.channel,
                }),
              )
              .setColor("#43b581");
            logsChannel.send({ embeds: [embed] });
          } else if (oldState.channelId && !newState.channelId) {
            // Leave or Disconnect
            let executor = null;
            try {
              await new Promise((r) => setTimeout(r, 1000));
              const fetchedLogs = await oldState.guild.fetchAuditLogs({
                limit: 1,
                type: AuditLogEvent.MemberDisconnect,
              });
              const log = fetchedLogs.entries.first();
              if (
                log &&
                log.target.id === oldState.member.id &&
                Date.now() - log.createdTimestamp < 5000
              ) {
                executor = log.executor;
              }
            } catch (e) {}

            embed
              .setDescription(
                t(lang, "events.voiceStateUpdate.voice_leave", {
                  member: oldState.member,
                  channel: oldState.channel,
                  suffix: executor
                    ? t(lang, "events.voiceStateUpdate.voice_leave_by", {
                        executor: executor.tag,
                      })
                    : "",
                }),
              )
              .setColor("#f04747");
            logsChannel.send({ embeds: [embed] });
          } else if (
            oldState.channelId &&
            newState.channelId &&
            oldState.channelId !== newState.channelId
          ) {
            // Move
            let executor = null;
            try {
              await new Promise((r) => setTimeout(r, 1000));
              const fetchedLogs = await oldState.guild.fetchAuditLogs({
                limit: 1,
                type: AuditLogEvent.MemberMove,
              });
              const log = fetchedLogs.entries.first();
              if (
                log &&
                log.target.id === oldState.member.id &&
                log.extra.channel.id === newState.channelId &&
                Date.now() - log.createdTimestamp < 5000
              ) {
                executor = log.executor;
              }
            } catch (e) {}

            embed
              .setDescription(
                t(lang, "events.voiceStateUpdate.voice_move", {
                  member: oldState.member,
                  from: oldState.channel,
                  to: newState.channel,
                  suffix: executor
                    ? t(lang, "events.voiceStateUpdate.voice_move_by", {
                        executor: executor.tag,
                      })
                    : "",
                }),
              )
              .setColor("#7289da");
            logsChannel.send({ embeds: [embed] });
          }
        }
      }
    } catch (e) {
      client.logger.error("[VOICE_LOGS] Erreur Logs Vocaux:", e);
    }
  },
};
