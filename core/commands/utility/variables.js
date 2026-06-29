module.exports = {
  name: "variables",
  description: "Affiche les variables du serveur",
  category: "utility",
  usage: "variables",
  userPerms: ["Administrator"],
  async execute(client, message, args) {
    const g = client.db.getGuild(message.guild.id);
    const fmt = (id, type) => (id ? `<${type}${id}>` : "—");

    const embed = client.embedBuilder.base(client, message.t("commands.variables.title")).addFields(
      {
        name: message.t("commands.variables.field_prefix"),
        value: `\`${g.prefix || client.config.prefix}\``,
        inline: true,
      },
      { name: message.t("commands.variables.field_language"), value: `\`${g.language || "fr"}\``, inline: true },
      { name: message.t("commands.variables.field_theme"), value: `\`${g.theme || "default"}\``, inline: true },
      {
        name: message.t("commands.variables.field_welcome"),
        value: fmt(g.welcomeChannel, "#"),
        inline: true,
      },
      { name: message.t("commands.variables.field_leave"), value: fmt(g.leaveChannel, "#"), inline: true },
      { name: message.t("commands.variables.field_logs"), value: fmt(g.logChannel, "#"), inline: true },
      {
        name: message.t("commands.variables.field_default_role"),
        value: fmt(g.defaultRole, "@&"),
        inline: true,
      },
      { name: message.t("commands.variables.field_mod_role"), value: fmt(g.modRole, "@&"), inline: true },
    );

    await message.reply({ embeds: [embed] }).catch(() => {});
  },
};
