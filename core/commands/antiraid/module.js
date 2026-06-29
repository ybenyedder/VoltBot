const { PermissionFlagsBits } = require("discord.js");

module.exports = {
  name: "module",
  description: "Active/désactive un module antiraid spécifique",
  category: "antiraid",
  usage: "module",
  userPerms: [PermissionFlagsBits.Administrator],
  async execute(client, message, args) {
    const moduleMap = {
      antiban: "antiBan",
      antibot: "antiBot",
      antichannel: "antiChannel",
      antispam: "antiSpam",
      antilink: "antiLink",
      antijoin: "raidMode",
      antiraid: "raidMode",
      antirole: "antiRole",
      antiwebhook: "antiWebhook",
      antiunban: "antiUnban",
      antirank: "antiRank",
      antibadwords: "antiBadWords",
      badword: "antiBadWords",
    };

    if (!args[0]) {
      const modules = Object.keys(moduleMap);
      const config = client.db.getAntiraidConfig(message.guild.id);

      const embed = client.embedBuilder
        .base(client, message.t("commands.module.title"))
        .setDescription(null)
        .addFields(
          modules.map((m) => ({
            name: m,
            value: config[moduleMap[m]]
              ? message.t("commands.module.enabled")
              : message.t("commands.module.disabled"),
            inline: true,
          })),
        )
        .addFields({
          name: message.t("commands.module.field_commands"),
          value: `\`${client.config.prefix}module <nom> on\` \`${client.config.prefix}module <nom> off\``,
          inline: false,
        });

      return message.reply({ embeds: [embed] }).catch(() => {});
    }

    const moduleName = args[0].toLowerCase();
    const state = args[1]?.toLowerCase();
    const field = moduleMap[moduleName];

    if (!field) {
      return message
        .reply({
          embeds: [
            client.embedBuilder.error(
              client,
              message.t("commands.module.unknown_module", {
                p: client.config.prefix,
              }),
            ),
          ],
        })
        .catch(() => {});
    }

    if (!["on", "off"].includes(state)) {
      return message
        .reply({
          embeds: [
            client.embedBuilder.error(
              client,
              message.t("commands.module.usage", {
                p: client.config.prefix,
              }),
            ),
          ],
        })
        .catch(() => {});
    }

    const current = client.db.getAntiraidConfig(message.guild.id);
    const enabled = state === "on" ? 1 : 0;

    if ((current[field] ? 1 : 0) === enabled) {
      return message
        .reply({
          embeds: [
            client.embedBuilder.warning(
              client,
              enabled
                ? message.t("commands.module.already_enabled")
                : message.t("commands.module.already_disabled"),
            ),
          ],
        })
        .catch(() => {});
    }

    client.db.updateAntiraidConfig(message.guild.id, { [field]: enabled });

    message
      .reply({
        embeds: [
          client.embedBuilder.success(
            client,
            message.t("commands.module.module_state", {
              module: moduleName,
              state: enabled
                ? message.t("commands.module.state_enabled")
                : message.t("commands.module.state_disabled"),
            }),
          ),
        ],
      })
      .catch(() => {});
  },
};
