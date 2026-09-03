const { EmbedBuilder, PermissionsBitField } = require("discord.js");
const config = require("../config/config");
const Logger = require("./logger");
const { t } = require("./i18n");

const botName = (client) => client?.user?.username || "ZeroDay";
const footerText = (client) => botName(client);
const footerIcon = (client) => client?.user?.displayAvatarURL?.({ size: 32 });
const botAvatar = (client, size) =>
  client?.user?.displayAvatarURL?.({ size }) || null;

const getTheme = (client) => {
  try {
    return client?.db?.getBotSettings?.()?.themeColor || config.colors.theme;
  } catch (e) {
    Logger.error("[EMBED_BUILDER] Error fetching bot theme color:", e);
    return config.colors.theme;
  }
};

const withStatus = (client, color, text) => {
  const embed = new EmbedBuilder()
    .setColor(color)
    .setTimestamp()
    .setFooter({ text: footerText(client), iconURL: footerIcon(client) });

  const description = text == null ? "" : String(text);
  if (description.length > 0) embed.setDescription(description);

  return embed;
};

const userAvatarOrBot = (client, user, size) => {
  if (typeof user?.displayAvatarURL === "function") {
    return user.displayAvatarURL({ size });
  }
  return botAvatar(client, size);
};

module.exports = {
  getTheme,

  premium: (client, title, description = null, thumbnail = null) => {
    const embed = new EmbedBuilder()
      .setColor(getTheme(client))
      .setTimestamp()
      .setFooter({ text: footerText(client), iconURL: footerIcon(client) });

    if (title != null && String(title).trim().length > 0) {
      embed.setAuthor({
        name: `${title}`,
        iconURL: botAvatar(client, 64),
      });
    }

    if (description != null && String(description).length > 0) {
      embed.setDescription(String(description));
    }

    const thumb = thumbnail || botAvatar(client, 256);
    if (thumb) {
      embed.setThumbnail(thumb);
    }

    return embed;
  },

  base: (client, title = null, description = null) => {
    const embed = new EmbedBuilder()
      .setColor(getTheme(client))
      .setTimestamp()
      .setFooter({ text: footerText(client), iconURL: footerIcon(client) });

    if (title != null && String(title).trim().length > 0) {
      embed.setAuthor({
        name: `${title}`,
        iconURL: botAvatar(client, 64),
      });
    }
    if (description != null && String(description).length > 0) {
      embed.setDescription(String(description));
    }

    return embed;
  },

  success: (client, text) =>
    withStatus(client, config.colors.success || "#57F287", text),
  error: (client, text) =>
    withStatus(client, config.colors.error || "#ED4245", text),
  warning: (client, text) =>
    withStatus(client, config.colors.warning || "#FEE75C", text),
  info: (client, text) =>
    withStatus(client, config.colors.info || "#5865F2", text),

  modLog: (client, action, user, moderator, reason, fields = [], lang = "fr") => {
    const embed = new EmbedBuilder().setColor(getTheme(client)).setAuthor({
      name: t(lang, "embeds.modlog.audit", { action }),
      iconURL: userAvatarOrBot(client, user, 64),
    });

    const baseFields = [
      {
        name: t(lang, "embeds.modlog.target"),
        value: `<@${user.id}>`,
        inline: true,
      },
      {
        name: t(lang, "embeds.modlog.moderator"),
        value: `<@${moderator.id}>`,
        inline: true,
      },
    ];

    if (reason) {
      const trimmed = String(reason).trim();
      baseFields.push({
        name: t(lang, "embeds.modlog.reason"),
        value: trimmed.length > 40 ? `\`\`\`\n${trimmed}\n\`\`\`` : trimmed,
        inline: false,
      });
    }

    embed.addFields(baseFields);
    if (fields.length > 0) embed.addFields(fields);

    embed
      .setTimestamp()
      .setFooter({ text: footerText(client), iconURL: footerIcon(client) });

    return embed;
  },

  formatPerms: (perms, lang = "fr") => {
    const permNames = {
      [PermissionsBitField.Flags.Administrator]: t(lang, "embeds.perms.administrator"),
      [PermissionsBitField.Flags.ManageGuild]: t(lang, "embeds.perms.manage_guild"),
      [PermissionsBitField.Flags.ManageChannels]: t(lang, "embeds.perms.manage_channels"),
      [PermissionsBitField.Flags.ManageRoles]: t(lang, "embeds.perms.manage_roles"),
      [PermissionsBitField.Flags.ManageMessages]: t(lang, "embeds.perms.manage_messages"),
      [PermissionsBitField.Flags.KickMembers]: t(lang, "embeds.perms.kick_members"),
      [PermissionsBitField.Flags.BanMembers]: t(lang, "embeds.perms.ban_members"),
      [PermissionsBitField.Flags.ModerateMembers]: t(lang, "embeds.perms.moderate_members"),
      [PermissionsBitField.Flags.ManageWebhooks]: t(lang, "embeds.perms.manage_webhooks"),
      [PermissionsBitField.Flags.ManageNicknames]: t(lang, "embeds.perms.manage_nicknames"),
      [PermissionsBitField.Flags.MuteMembers]: t(lang, "embeds.perms.mute_members"),
      [PermissionsBitField.Flags.DeafenMembers]: t(lang, "embeds.perms.deafen_members"),
      [PermissionsBitField.Flags.MoveMembers]: t(lang, "embeds.perms.move_members"),
    };
    if (Array.isArray(perms))
      return perms.map((p) => `\`${permNames[p] || p}\``).join(",");
    return `\`${permNames[perms] || perms}\``;
  },
};
