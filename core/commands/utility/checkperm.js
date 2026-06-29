const { PermissionFlagsBits } = require("discord.js");

const PERM_LABELS = {
  Administrator: "commands.checkperm.perm_administrator",
  ManageGuild: "commands.checkperm.perm_manage_guild",
  ManageRoles: "commands.checkperm.perm_manage_roles",
  ManageChannels: "commands.checkperm.perm_manage_channels",
  KickMembers: "commands.checkperm.perm_kick",
  BanMembers: "commands.checkperm.perm_ban",
  ManageMessages: "commands.checkperm.perm_manage_messages",
  MuteMembers: "commands.checkperm.perm_mute",
};

module.exports = {
  name: "checkperm",
  description: "Vérifie les permissions d'un utilisateur",
  category: "utility",
  usage: "checkperm",
  userPerms: [PermissionFlagsBits.Administrator],
  async execute(client, message, args) {
    const user =
      message.mentions.users.first() ||
      client.users.cache.get(args[0]) ||
      message.author;
    const member = message.guild.members.cache.get(user.id);

    if (!member) {
      return message
        .reply({
          embeds: [client.embedBuilder.warning(client, message.t("commands.checkperm.member_not_found"))],
        })
        .catch(() => {});
    }

    const permissions = member.permissions.toArray();
    const important = Object.keys(PERM_LABELS);
    const userPerms = permissions.filter((p) => important.includes(p));

    const roles =
      member.roles.cache
        .filter((r) => r.id !== message.guild.id)
        .map((r) => `<@&${r.id}>`)
        .join(" ") || message.t("commands.checkperm.none_m");

    const embed = client.embedBuilder
      .premium(
        client,
        message.t("commands.checkperm.title", { tag: user.tag }),
        `<@${user.id}>`,
        user.displayAvatarURL({ size: 256 }),
      )
      .addFields(
        { name: "ID", value: `\`${user.id}\``, inline: true },
        {
          name: message.t("commands.checkperm.field_total"),
          value: `\`${permissions.length}\``,
          inline: true,
        },
        {
          name: message.t("commands.checkperm.field_keys"),
          value: `\`${userPerms.length}\``,
          inline: true,
        },
        {
          name: message.t("commands.checkperm.field_notable"),
          value: userPerms.length
            ? userPerms.map((p) => `- ${message.t(PERM_LABELS[p]) || p}`).join("\n")
            : message.t("commands.checkperm.none_f"),
          inline: false,
        },
        {
          name: message.t("commands.checkperm.field_roles"),
          value: roles.length > 1024 ? roles.slice(0, 1021) + "..." : roles,
          inline: false,
        },
      );

    await message.reply({ embeds: [embed] }).catch(() => {});
  },
};
