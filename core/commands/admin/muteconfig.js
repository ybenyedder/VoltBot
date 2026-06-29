const ms = require("ms");

const fmtDuration = (totalSeconds) => {
  let s = Math.max(0, Math.floor(totalSeconds));
  const d = Math.floor(s / 86400);
  s -= d * 86400;
  const h = Math.floor(s / 3600);
  s -= h * 3600;
  const m = Math.floor(s / 60);
  s -= m * 60;
  const parts = [];
  if (d) parts.push(`${d} j`);
  if (h) parts.push(`${h} h`);
  if (m) parts.push(`${m} min`);
  if (!parts.length) parts.push(`${s} s`);
  return parts.join(" ");
};

const parseDuration = (input) => {
  if (!input) return null;
  const direct = ms(input);
  if (typeof direct === "number" && direct > 0) return Math.floor(direct / 1000);
  const m = input.match(/^(\d+)([smhd])$/i);
  if (!m) return null;
  const mult = { s: 1, m: 60, h: 3600, d: 86400 };
  return parseInt(m[1]) * mult[m[2].toLowerCase()];
};

module.exports = {
  name: "muteconfig",
  aliases: ["mutepreset", "mutepresets"],
  description:
    "Configure les préréglages de mute (durée + raison). Le staff les utilisera comme presets.",
  category: "admin",
  usage:
    "+muteconfig [list | on | off | add <nom> <durée> <raison> | del <nom>]",
  ownerOnly: true,
  async execute(client, message, args) {
    const guildId = message.guild.id;
    const settings = client.db.getGuild(guildId) || {};
    const enabled = !!settings.mutePresetsEnabled;
    const sub = (args[0] || "list").toLowerCase();

    const renderList = (title) => {
      const list = client.db.getMutePresets(guildId);
      const embed = client.embedBuilder
        .base(client, null, null)
        .setAuthor({
          name: title || message.t("commands.muteconfig.presets_title"),
          iconURL: client.user.displayAvatarURL({ size: 64 }),
        })
        .setDescription(null)
        .addFields(
          {
            name: message.t("commands.muteconfig.field_status"),
            value: enabled ? message.t("commands.muteconfig.status_enabled") : message.t("commands.muteconfig.status_disabled"),
            inline: true,
          },
          {
            name: message.t("commands.muteconfig.field_total"),
            value: `\`${list.length}\``,
            inline: true,
          },
          {
            name: message.t("commands.muteconfig.field_staff_usage"),
            value: "`+tempmute @user <nom_preset>`",
            inline: true,
          },
        );
      if (list.length) {
        const rows = list
          .map(
            (p) =>
              `\`${p.name.padEnd(14)}\` · \`${fmtDuration(p.durationSeconds).padEnd(12)}\` · ${p.reason || "—"}`,
          )
          .join("\n");
        embed.addFields({
          name: message.t("commands.muteconfig.field_presets"),
          value: rows.slice(0, 1024),
        });
      } else {
        embed.addFields({
          name: message.t("commands.muteconfig.field_presets"),
          value: message.t("commands.muteconfig.no_presets"),
        });
      }
      embed.addFields({
        name: message.t("commands.muteconfig.field_subcommands"),
        value: message.t("commands.muteconfig.subcommands_value"),
      });
      return embed;
    };

    if (sub === "list") {
      return message.reply({ embeds: [renderList()] }).catch(() => {});
    }

    if (sub === "on" || sub === "off") {
      const next = sub === "on" ? 1 : 0;
      if (next === (enabled ? 1 : 0)) {
        return message
          .reply({
            embeds: [
              client.embedBuilder.warning(
                client,
                sub === "on" ? message.t("commands.muteconfig.already_enabled") : message.t("commands.muteconfig.already_disabled"),
              ),
            ],
          })
          .catch(() => {});
      }
      client.db.updateGuild(guildId, { mutePresetsEnabled: next });
      return message
        .reply({
          embeds: [
            renderList(
              sub === "on" ? message.t("commands.muteconfig.presets_title_enabled") : message.t("commands.muteconfig.presets_title_disabled"),
            ),
          ],
        })
        .catch(() => {});
    }

    if (sub === "add") {
      const name = (args[1] || "").toLowerCase();
      const duration = args[2];
      const reason = args.slice(3).join(" ").trim();
      if (!name || !duration || !reason) {
        return message
          .reply({
            embeds: [
              client.embedBuilder.warning(
                client,
                message.t("commands.muteconfig.add_usage"),
              ),
            ],
          })
          .catch(() => {});
      }
      if (!/^[a-z0-9_-]{2,20}$/.test(name)) {
        return message
          .reply({
            embeds: [
              client.embedBuilder.warning(
                client,
                message.t("commands.muteconfig.invalid_name"),
              ),
            ],
          })
          .catch(() => {});
      }
      const seconds = parseDuration(duration);
      if (!seconds || seconds < 5 || seconds > 2419200) {
        return message
          .reply({
            embeds: [
              client.embedBuilder.warning(
                client,
                message.t("commands.muteconfig.invalid_duration"),
              ),
            ],
          })
          .catch(() => {});
      }
      if (reason.length > 400) {
        return message
          .reply({
            embeds: [
              client.embedBuilder.warning(
                client,
                message.t("commands.muteconfig.reason_too_long"),
              ),
            ],
          })
          .catch(() => {});
      }
      client.db.addMutePreset(guildId, name, seconds, reason);
      return message
        .reply({ embeds: [renderList(message.t("commands.muteconfig.preset_saved", { name }))] })
        .catch(() => {});
    }

    if (sub === "del" || sub === "remove") {
      const name = (args[1] || "").toLowerCase();
      if (!name) {
        return message
          .reply({
            embeds: [
              client.embedBuilder.warning(
                client,
                message.t("commands.muteconfig.del_usage"),
              ),
            ],
          })
          .catch(() => {});
      }
      const ok = client.db.delMutePreset(guildId, name);
      if (!ok) {
        return message
          .reply({
            embeds: [
              client.embedBuilder.warning(client, message.t("commands.muteconfig.preset_not_found")),
            ],
          })
          .catch(() => {});
      }
      return message
        .reply({ embeds: [renderList(message.t("commands.muteconfig.preset_deleted", { name }))] })
        .catch(() => {});
    }

    return message
      .reply({
        embeds: [
          client.embedBuilder.warning(
            client,
            message.t("commands.muteconfig.unknown_sub"),
          ),
        ],
      })
      .catch(() => {});
  },
};
