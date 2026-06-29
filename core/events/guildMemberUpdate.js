const logger = require("../utils/logger");
const permissions = require("../utils/permissions");
const { t } = require("../utils/i18n");

module.exports = {
  name: "guildMemberUpdate",
  async execute(oldMember, newMember, client) {
    if (!newMember.guild) return;

    const guildSettings = client.db.getGuild(newMember.guild.id);
    const lang = guildSettings.language || "fr";

    // --- LOG : changements significatifs (pseudo, rôles, timeout) ---
    const logChannelId = client.db.resolveLogChannel(
      newMember.guild.id,
      "modlog",
    );
    const nickChanged = oldMember.nickname !== newMember.nickname;
    const addedRolesAll = newMember.roles.cache.filter(
      (r) => !oldMember.roles.cache.has(r.id),
    );
    const removedRoles = oldMember.roles.cache.filter(
      (r) => !newMember.roles.cache.has(r.id),
    );
    const rolesChanged = addedRolesAll.size > 0 || removedRoles.size > 0;
    const oldTo = oldMember.communicationDisabledUntilTimestamp || 0;
    const newTo = newMember.communicationDisabledUntilTimestamp || 0;
    const timeoutChanged = oldTo !== newTo;

    // --- LOG : boost (via premiumSince) ---
    const oldPrem = oldMember.premiumSinceTimestamp || 0;
    const newPrem = newMember.premiumSinceTimestamp || 0;
    if (oldPrem !== newPrem) {
      const eventName = newPrem ? "boost" : "unboost";
      const boostChannelId = client.db.resolveLogChannel(
        newMember.guild.id,
        "boostlog",
        eventName,
      );
      if (boostChannelId) {
        const ch = newMember.guild.channels.cache.get(boostChannelId);
        if (ch) {
          const embed = client.embedBuilder
            .base(
              client,
              newPrem
                ? t(lang, "events.guildMemberUpdate.boost_new_title")
                : t(lang, "events.guildMemberUpdate.boost_end_title"),
            )
            .addFields(
              {
                name: t(lang, "events.guildMemberUpdate.field_member"),
                value: `<@${newMember.id}>`,
                inline: true,
              },
              {
                name: t(lang, "events.guildMemberUpdate.field_server_boosts"),
                value: `\`${newMember.guild.premiumSubscriptionCount || 0}\``,
                inline: true,
              },
            );
          await ch.send({ embeds: [embed] }).catch(() => {});
        }
      }
    }

    if (logChannelId && (nickChanged || rolesChanged || timeoutChanged)) {
      const ch = newMember.guild.channels.cache.get(logChannelId);
      if (ch) {
        const noneLabel = t(lang, "events.guildMemberUpdate.diff_none");
        const diffs = [];
        if (nickChanged)
          diffs.push(
            `${t(lang, "events.guildMemberUpdate.diff_nick_old", {
              value: oldMember.nickname || noneLabel,
            })}\n${t(lang, "events.guildMemberUpdate.diff_nick_new", {
              value: newMember.nickname || noneLabel,
            })}`,
          );
        if (addedRolesAll.size > 0)
          diffs.push(
            t(lang, "events.guildMemberUpdate.diff_roles_added", {
              roles: addedRolesAll.map((r) => r.name).join(", "),
            }),
          );
        if (removedRoles.size > 0)
          diffs.push(
            t(lang, "events.guildMemberUpdate.diff_roles_removed", {
              roles: removedRoles.map((r) => r.name).join(", "),
            }),
          );
        if (timeoutChanged) {
          if (newTo > Date.now())
            diffs.push(
              t(lang, "events.guildMemberUpdate.diff_timeout_set", {
                time: `<t:${Math.floor(newTo / 1000)}:R>`,
              }),
            );
          else diffs.push(t(lang, "events.guildMemberUpdate.diff_timeout_lifted"));
        }

        const embed = client.embedBuilder
          .base(client, t(lang, "events.guildMemberUpdate.member_update_title"))
          .addFields(
            {
              name: t(lang, "events.guildMemberUpdate.field_member"),
              value: `<@${newMember.id}>`,
              inline: true,
            },
            {
              name: t(lang, "events.guildMemberUpdate.field_changes"),
              value: `\`\`\`diff\n${diffs.join("\n").substring(0, 1000)}\n\`\`\``,
              inline: false,
            },
          );
        await ch.send({ embeds: [embed] }).catch(() => {});
      }
    }

    const antiraid = client.db.getAntiraidConfig(newMember.guild.id);

    if (!antiraid || antiraid.antiRank === 0) return;

    // Détecter l'ajout de rôles
    const addedRoles = addedRolesAll;
    if (addedRoles.size === 0) return;

    // Récupérer le modérateur via les audits logs
    const fetchedLogs = await newMember.guild
      .fetchAuditLogs({
        limit: 1,
        type: 25, // MEMBER_ROLE_UPDATE
      })
      .catch(() => null);
    const log = fetchedLogs?.entries.first();
    if (!log || Date.now() - log.createdTimestamp > 30000) return;

    const { executor, target } = log;
    if (target.id !== newMember.id) return;
    if (executor.id === client.user.id) return; // Ignorer si c'est le bot

    // Vérifier si le modérateur est bypassé
    if (
      permissions.isWhitelisted(
        executor.id,
        newMember.guild.id,
        client,
        null,
        "antiNuke",
      )
    )
      return;

    // Logique Anti-Rank
    let shouldRevert = false;
    if (antiraid.antiRankType === "max") {
      shouldRevert = true;
    } else {
      // "danger" : Rôles avec des permissions sensibles
      const dangerousPerms = [
        "Administrator",
        "ManageGuild",
        "ManageRoles",
        "ManageChannels",
        "BanMembers",
        "KickMembers",
        "ManageWebhooks",
        "ManageMessages",
      ];
      shouldRevert = addedRoles.some((role) =>
        role.permissions.toArray().some((p) => dangerousPerms.includes(p)),
      );
    }

    if (shouldRevert) {
      try {
        await newMember.roles.set(
          oldMember.roles.cache.map((r) => r.id),
          "Anti-Rank Protection",
        );

        // Sanctionner l'exécuteur si configuré
        const execMember = await newMember.guild.members
          .fetch(executor.id)
          .catch(() => null);
        if (execMember) {
          const actionResult = await client.utils.antiraid.processSanction(
            execMember,
            "antiRank",
            t(lang, "events.guildMemberUpdate.reason_sensitive_role_unauthorized"),
            client,
          );
          logger.event(
            `[ANTIRAID] ${executor.tag} sanctionné via antiRank : ${actionResult}`,
          );
        }

        const rankLogChannelId =
          client.db.resolveLogChannel(newMember.guild.id, "modlog", "antirank") ||
          client.db.resolveLogChannel(newMember.guild.id, "raidlog", "antirank") ||
          guildSettings.raidLogsChannel;
        if (rankLogChannelId) {
          const channel = newMember.guild.channels.cache.get(rankLogChannelId);
          if (channel) {
            const blockedRoles = (
              addedRoles.map((r) => `<@&${r.id}>`).join(" ") ||
              t(lang, "events.guildMemberUpdate.none")
            ).substring(0, 1024);
            const embed = client.embedBuilder
              .base(client, t(lang, "events.guildMemberUpdate.antirank_title"))
              .addFields(
                {
                  name: t(lang, "events.guildMemberUpdate.field_target"),
                  value: `<@${newMember.id}>`,
                  inline: true,
                },
                {
                  name: t(lang, "events.guildMemberUpdate.field_executor"),
                  value: `<@${executor.id}>`,
                  inline: true,
                },
                {
                  name: t(lang, "events.guildMemberUpdate.field_blocked_roles"),
                  value: blockedRoles,
                  inline: false,
                },
              );
            await channel.send({ embeds: [embed] }).catch(() => {});
          }
        }
      } catch (err) {
        logger.error(
          `[ANTI-RANK] Erreur lors de la réinitialisation des rôles de ${newMember.user.tag}:`,
          err,
        );
      }
    }
  },
};
