const { PermissionFlagsBits } = require("discord.js");
const logger = require("./logger");
const { t } = require("./i18n");

/**
 * Centrally processes sanctions for anti-raid modules
 * @param {import('discord.js').GuildMember} member
 * @param {string} moduleName - e.g. 'antiBan', 'antiRole'
 * @param {string} reason
 * @param {import('discord.js').Client} client
 */
const processSanction = async (member, moduleName, reason, client) => {
  if (!member || !member.guild) return "introuvable";

  const guild = member.guild;
  const lang = client.db.getGuild(guild.id, "language") || "fr";
  const config = client.db.getAntiraidConfig(guild.id);
  if (!config) return t(lang, "utils.antiraid.not_configured");

  const punishmentKey = `${moduleName}Punishment`;
  const punishment = config[punishmentKey] || "strip";

  if (punishment === "none") return t(lang, "utils.antiraid.ignored_config");

  const botMember = guild.members.me;
  if (!member.manageable && punishment !== "warn" && punishment !== "none") {
    let reason_fail = t(lang, "utils.antiraid.fail_hierarchy");

    if (member.roles.highest.position >= botMember.roles.highest.position)
      reason_fail = t(lang, "utils.antiraid.fail_hierarchy_target_high");
    if (member.id === guild.ownerId)
      reason_fail = t(lang, "utils.antiraid.fail_owner");

    logger.warn(
      `[ANTIRAID] Impossible de sanctionner ${member.user.tag} (${reason_fail})`,
    );
    return t(lang, "utils.antiraid.not_sanctionable", { reason: reason_fail });
  }

  // Administrators cannot be timed out (Discord limitation): fall back to strip
  let effectivePunishment = punishment;
  if (
    effectivePunishment === "mute" &&
    member.permissions.has(PermissionFlagsBits.Administrator)
  ) {
    logger.warn(
      `[ANTIRAID] ${member.user.tag} est Administrateur, le mute est impossible. Repli sur 'strip' (retrait des rôles).`,
    );
    effectivePunishment = "strip";
  }

  try {
    let actionStr = "";

    switch (effectivePunishment) {
      case "ban":
        if (
          member.bannable &&
          guild.members.me.permissions.has(PermissionFlagsBits.BanMembers)
        ) {
          await member.ban({ reason: `[ANTIRAID] ${moduleName}: ${reason}` });
          actionStr = t(lang, "utils.antiraid.action_banned");
        } else actionStr = t(lang, "utils.antiraid.action_not_bannable");
        break;

      case "kick":
        if (
          member.kickable &&
          guild.members.me.permissions.has(PermissionFlagsBits.KickMembers)
        ) {
          await member.kick(`[ANTIRAID] ${moduleName}: ${reason}`);
          actionStr = t(lang, "utils.antiraid.action_kicked");
        } else actionStr = t(lang, "utils.antiraid.action_not_kickable");
        break;

      case "mute":
        if (
          guild.members.me.permissions.has(PermissionFlagsBits.ModerateMembers)
        ) {
          const duration = config.muteDuration || 300000;
          await member.timeout(duration, `[ANTIRAID] ${moduleName}: ${reason}`);
          actionStr = t(lang, "utils.antiraid.action_muted", {
            minutes: Math.floor(duration / 60000),
          });
        } else actionStr = t(lang, "utils.antiraid.action_not_mutable");
        break;

      case "strip":
        if (guild.members.me.permissions.has(PermissionFlagsBits.ManageRoles)) {
          await member.roles
            .set([])
            .catch((err) =>
              logger.warn(
                `[ANTIRAID] Failed to strip roles for ${member.user.tag}: ${err.message}`,
              ),
            );
          if (
            guild.members.me.permissions.has(
              PermissionFlagsBits.ModerateMembers,
            )
          ) {
            await member
              .timeout(
                86400000,
                `[ANTIRAID] ${moduleName}: ${reason} (Strip Roles)`,
              )
              .catch((err) =>
                logger.warn(
                  `[ANTIRAID] Failed to timeout ${member.user.tag} after stripping roles: ${err.message}`,
                ),
              );
          }
          actionStr = t(lang, "utils.antiraid.action_stripped");
        } else actionStr = t(lang, "utils.antiraid.action_strip_failed");
        break;

      case "warn":
        actionStr = t(lang, "utils.antiraid.action_warned");
        break;

      case "delete":
        actionStr = t(lang, "utils.antiraid.action_deleted");
        break;

      default:
        actionStr = t(lang, "utils.antiraid.action_detected");
    }

    logSanction(
      guild,
      member,
      moduleName,
      effectivePunishment,
      actionStr,
      client,
      lang,
    );

    return actionStr;
  } catch (error) {
    logger.error(
      `[ANTIRAID] Erreur lors de la sanction (${moduleName}/${punishment}): ${error.message}`,
      error,
    );
    return t(lang, "utils.antiraid.action_error", { error: error.message });
  }
};

const logSanction = (
  guild,
  target,
  moduleName,
  punishment,
  result,
  client,
  lang = "fr",
) => {
  const logChannelId =
    client.db.resolveLogChannel(guild.id, "raidlog", "sanction") ||
    client.db.resolveLogChannel(guild.id, "modlog", "sanction");
  if (!logChannelId) return;

  const channel = guild.channels.cache.get(logChannelId);
  if (!channel) return;

  const embed = client.embedBuilder
    .error(
      client,
      t(lang, "utils.antiraid.log_author", {
        module: moduleName.replace("anti", ""),
      }),
    )
    .setTitle(t(lang, "utils.antiraid.log_title"))
    .addFields(
      {
        name: t(lang, "utils.antiraid.field_user"),
        value: `>>> ${target.user.tag} (\`${target.id}\`)`,
        inline: true,
      },
      {
        name: t(lang, "utils.antiraid.field_module"),
        value: `\`${moduleName}\``,
        inline: true,
      },
      {
        name: t(lang, "utils.antiraid.field_punishment"),
        value: `\`${punishment}\``,
        inline: true,
      },
      {
        name: t(lang, "utils.antiraid.field_result"),
        value: `>>> ${result}`,
        inline: false,
      },
    )
    .setTimestamp();

  channel.send({ embeds: [embed] }).catch(() => {});
};

module.exports = {
  processSanction,
};
