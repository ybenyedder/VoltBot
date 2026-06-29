const {
  PermissionFlagsBits,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require("discord.js");
const permissions = require("../../utils/permissions");

module.exports = {
  name: "antispam",
  description: "Configure la protection contre le spam.",
  category: "antiraid",
  usage: "+antispam <on/off/max> / gestion",
  userPerms: [PermissionFlagsBits.Administrator],
  botPerms: [PermissionFlagsBits.ManageMessages],
  async execute(client, message, args) {
    if (!permissions.isModerator(message, client)) {
      return message
        .reply({
          embeds: [
            client.embedBuilder.error(client, message.t("commands.antispam.no_perm")),
          ],
        })
        .catch(() => {});
    }

    let config = client.db.getAntiraidConfig(message.guild.id);

    if (!args[0]) {
      const bypass = client.db.getGuild(message.guild.id, "bypass") || [];
      const p = client.config.prefix;
      const statusLabel =
        config.antiSpam === 0
          ? message.t("commands.antispam.status_disabled")
          : config.antiSpam === 2
            ? message.t("commands.antispam.status_maximum")
            : message.t("commands.antispam.status_enabled");

      const embed = client.embedBuilder
        .base(client, "AntiSpam")
        .setDescription(null)
        .addFields(
          { name: message.t("commands.antispam.field_status"), value: statusLabel, inline: true },
          {
            name: message.t("commands.antispam.field_threshold"),
            value: `\`${config.spamLimit || 5}\` / 5s`,
            inline: true,
          },
          {
            name: message.t("commands.antispam.field_sanction"),
            value: `\`${config.antiSpamPunishment || "mute"}\``,
            inline: true,
          },
          { name: message.t("commands.antispam.field_bypass"), value: `\`${bypass.length}\``, inline: true },
          {
            name: message.t("commands.antispam.field_commands"),
            value: `\`${p}antispam on\` \`${p}antispam off\` \`${p}antispam max\` \`${p}antispam punish\` \`${p}antispam gestion\``,
            inline: false,
          },
        );
      return message.reply({ embeds: [embed] }).catch(() => {});
    }

    if (args[0] === "gestion") {
      const statusLabel = (cfg) =>
        cfg.antiSpam === 0
          ? message.t("commands.antispam.status_disabled")
          : cfg.antiSpam === 2
            ? message.t("commands.antispam.status_maximum")
            : message.t("commands.antispam.status_enabled");

      const getEmbed = (cfg) =>
        client.embedBuilder
          .base(client, "AntiSpam")
          .setDescription(null)
          .addFields(
            { name: message.t("commands.antispam.field_status"), value: statusLabel(cfg), inline: true },
            { name: message.t("commands.antispam.field_threshold"), value: `\`${cfg.spamLimit}\` / 5s`, inline: true },
            {
              name: message.t("commands.antispam.field_sanction"),
              value: `\`${cfg.antiSpamPunishment || "mute"}\``,
              inline: true,
            },
          );

      const getRow = (cfg) =>
        new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId("as_minus")
            .setLabel("-")
            .setStyle(ButtonStyle.Secondary),
          new ButtonBuilder()
            .setCustomId("as_plus")
            .setLabel("+")
            .setStyle(ButtonStyle.Secondary),
          new ButtonBuilder()
            .setCustomId("as_toggle")
            .setLabel(message.t("commands.antispam.btn_toggle"))
            .setStyle(cfg.antiSpam ? ButtonStyle.Success : ButtonStyle.Danger),
          new ButtonBuilder()
            .setCustomId("as_punish")
            .setLabel(message.t("commands.antispam.btn_sanction"))
            .setStyle(ButtonStyle.Primary),
        );

      const msg = await message
        .reply({ embeds: [getEmbed(config)], components: [getRow(config)] })
        .catch(() => null);
      if (!msg) return;

      const collector = msg.createMessageComponentCollector({
        filter: (i) => i.user.id === message.author.id,
        time: 120000,
      });

      collector.on("collect", async (i) => {
        const updates = {};

        if (i.customId === "as_plus")
          updates.spamLimit = Math.min((config.spamLimit || 5) + 1, 20);
        if (i.customId === "as_minus")
          updates.spamLimit = Math.max((config.spamLimit || 5) - 1, 3);
        if (i.customId === "as_toggle") {
          const current = config.antiSpam === undefined ? 0 : config.antiSpam;
          updates.antiSpam = (current + 1) % 3;
        }
        if (i.customId === "as_punish") {
          const punishments = ["mute", "kick", "ban", "strip", "warn", "none"];
          const currentIdx = punishments.indexOf(
            config.antiSpamPunishment || "mute",
          );
          const nextIdx =
            currentIdx === -1 ? 0 : (currentIdx + 1) % punishments.length;
          updates.antiSpamPunishment = punishments[nextIdx];
        }

        if (Object.keys(updates).length > 0) {
          client.db.updateAntiraidConfig(message.guild.id, updates);
          config = { ...config, ...updates };
          await i
            .update({
              embeds: [getEmbed(config)],
              components: [getRow(config)],
            })
            .catch(() => {});
        } else {
          await i.deferUpdate().catch(() => {});
        }
      });

      collector.on("end", () => {
        msg.edit({ components: [] }).catch(() => {});
      });
      return;
    }

    if (args[0] === "punish") {
      const sanction = args[1]?.toLowerCase();
      const valid = ["warn", "mute", "kick", "ban", "strip", "none"];
      if (!sanction || !valid.includes(sanction)) {
        return message
          .reply({
            embeds: [
              client.embedBuilder.error(
                client,
                message.t("commands.antispam.unknown_sanction"),
              ),
            ],
          })
          .catch(() => {});
      }
      client.db.updateAntiraidConfig(message.guild.id, {
        antiSpamPunishment: sanction,
      });
      return message
        .reply({
          embeds: [
            client.embedBuilder.success(
              client,
              message.t("commands.antispam.sanction_set", { sanction }),
            ),
          ],
        })
        .catch(() => {});
    }

    const state = args[0];
    if (!["on", "off", "max"].includes(state)) {
      return message
        .reply({
          embeds: [
            client.embedBuilder.error(
              client,
              message.t("commands.antispam.usage_main", { prefix: client.config.prefix }),
            ),
          ],
        })
        .catch(() => {});
    }

    const newState = state === "off" ? 0 : state === "max" ? 2 : 1;

    if (config.antiSpam === newState && (state === "on" || state === "off")) {
      return message
        .reply({
          embeds: [
            client.embedBuilder.warning(
              client,
              newState
                ? message.t("commands.antispam.already_enabled")
                : message.t("commands.antispam.already_disabled"),
            ),
          ],
        })
        .catch(() => {});
    }

    client.db.updateAntiraidConfig(message.guild.id, { antiSpam: newState });
    config = client.db.getAntiraidConfig(message.guild.id);

    const statusLabel = {
      0: message.t("commands.antispam.status_disabled"),
      1: message.t("commands.antispam.status_enabled"),
      2: message.t("commands.antispam.status_maximum"),
    }[newState];
    const helper = newState
      ? client.embedBuilder.success
      : client.embedBuilder.warning;
    const embed = helper(client, "")
      .setAuthor({
        name: "AntiSpam",
        iconURL: client?.user?.displayAvatarURL?.({ size: 64 }),
      })
      .setDescription(null)
      .addFields(
        { name: message.t("commands.antispam.field_status"), value: statusLabel, inline: true },
        {
          name: message.t("commands.antispam.field_action"),
          value: `\`${config.antiSpamPunishment || "mute"}\``,
          inline: true,
        },
        {
          name: message.t("commands.antispam.field_threshold"),
          value: `\`${config.spamLimit || 5}\` / 5s`,
          inline: true,
        },
        {
          name: message.t("commands.antispam.field_description"),
          value: message.t("commands.antispam.desc_value"),
          inline: false,
        },
      );

    message.reply({ embeds: [embed] }).catch(() => {});
  },
};
