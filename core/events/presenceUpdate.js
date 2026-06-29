const { ActivityType, Events } = require("discord.js");
const { t } = require("../utils/i18n");

function getCustomStatusText(presence) {
  const custom = presence?.activities?.find(
    (activity) => activity.type === ActivityType.Custom,
  );
  if (!custom) return "";
  return [custom.state, custom.name].filter(Boolean).join("").toLowerCase();
}

function getTriggers(rawTriggers) {
  if (!rawTriggers) return ["/nocoin", ".gg/nocoin"];
  try {
    const parsed =
      typeof rawTriggers === "string" ? JSON.parse(rawTriggers) : rawTriggers;
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed
        .map((trigger) => String(trigger).toLowerCase())
        .filter(Boolean);
    }
  } catch (e) {}
  return ["/nocoin", ".gg/nocoin"];
}

module.exports = {
  name: Events.PresenceUpdate,
  async execute(oldPresence, newPresence, client) {
    const guild = newPresence?.guild || oldPresence?.guild;
    const userId = newPresence?.userId || oldPresence?.userId;
    if (!guild || !userId) return;

    const guildSettings = client.db.getGuild(guild.id);
    const lang = guildSettings?.language || "fr";
    const roleId = guildSettings?.statusRole;
    if (!roleId) return;

    const role = guild.roles.cache.get(roleId);
    if (!role) return;

    const member =
      newPresence?.member ||
      (await guild.members.fetch(userId).catch(() => null));
    if (!member || member.user.bot) return;

    const triggers = getTriggers(guildSettings.statusRoleTriggers);
    const customStatus = getCustomStatusText(newPresence);
    const shouldHaveRole = triggers.some((trigger) =>
      customStatus.includes(trigger),
    );
    const hasRole = member.roles.cache.has(roleId);

    if (shouldHaveRole && !hasRole) {
      await member.roles
        .add(role, t(lang, "events.presenceUpdate.reason_custom_status_required"))
        .catch(() => {});
    } else if (!shouldHaveRole && hasRole) {
      await member.roles
        .remove(role, t(lang, "events.presenceUpdate.reason_custom_status_removed"))
        .catch(() => {});
    }
  },
};
