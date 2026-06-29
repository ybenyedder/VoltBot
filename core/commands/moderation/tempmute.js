const {
  PermissionFlagsBits,
  ActionRowBuilder,
  StringSelectMenuBuilder,
} = require("discord.js");
const Logger = require("../../utils/logger");
const permissions = require("../../utils/permissions");
const messageUtils = require("../../utils/messageUtils");

const fmtDuration = (mss) => {
  let s = Math.floor(mss / 1000);
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

const applyMute = async (client, message, member, durationMs, reason, presetName, durationLabel) => {
  try {
    const finalReason = reason && reason.trim() ? reason.trim() : message.t("commands.tempmute.no_reason");
    await member.timeout(
      durationMs,
      `[TEMPMUTE ${durationLabel}] par ${message.author.tag} | ${finalReason}`,
    );

    const ts = Math.floor(Date.now() / 1000);
    const unmuteAt = Math.floor((Date.now() + durationMs) / 1000);
    const embed = client.embedBuilder
      .success(client, "​")
      .setDescription(null)
      .setAuthor({
        name: message.t("commands.tempmute.embed_author"),
        iconURL: member.user.displayAvatarURL({ size: 256 }),
      })
      .setThumbnail(member.user.displayAvatarURL({ size: 256 }))
      .addFields(
        { name: message.t("commands.tempmute.field_target"), value: `<@${member.id}>`, inline: true },
        {
          name: message.t("commands.tempmute.field_moderator"),
          value: `<@${message.author.id}>`,
          inline: true,
        },
        { name: message.t("commands.tempmute.field_duration"), value: fmtDuration(durationMs), inline: true },
        { name: message.t("commands.tempmute.field_end"), value: `<t:${unmuteAt}:R>`, inline: true },
        { name: message.t("commands.tempmute.field_date"), value: `<t:${ts}:R>`, inline: true },
        ...(presetName
          ? [{ name: message.t("commands.tempmute.field_preset"), value: `\`${presetName}\``, inline: true }]
          : []),
        { name: message.t("commands.tempmute.field_reason"), value: finalReason, inline: false },
      );

    const guildSettings = client.db.getGuild(message.guild.id) || {};
    const logChannelId =
      guildSettings.modLogsChannel || guildSettings.raidLogsChannel;
    if (logChannelId) {
      const logChannel = message.guild.channels.cache.get(logChannelId);
      if (logChannel) logChannel.send({ embeds: [embed] }).catch(() => {});
    }

    return { ok: true, embed };
  } catch (error) {
    Logger.error(
      `[TEMPMUTE] Erreur lors du mute de ${member.user.tag}:`,
      error,
    );
    return { ok: false };
  }
};

const buildPresetSelectRow = (presets, disabled = false, mt) => {
  const noReason = mt ? mt("commands.tempmute.preset_no_reason") : "sans raison";
  const options = presets.slice(0, 25).map((p) => ({
    label: p.name.slice(0, 100),
    value: p.name.slice(0, 100),
    description: `${fmtDuration(p.durationSeconds * 1000)} · ${
      (p.reason || noReason).slice(0, 80)
    }`.slice(0, 100),
  }));
  return new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId("tempmute_preset_select")
      .setPlaceholder(mt ? mt("commands.tempmute.preset_placeholder") : "Choisir un preset de mute")
      .setDisabled(disabled)
      .addOptions(options),
  );
};

module.exports = {
  name: "tempmute",
  aliases: ["mute", "taire", "m"],
  description: "Mute temporairement un utilisateur via Discord Timeout",
  category: "moderation",
  usage: "+tempmute @utilisateur <durée|preset> [raison]",
  userPerms: [PermissionFlagsBits.ModerateMembers],
  botPerms: [PermissionFlagsBits.ModerateMembers],
  async execute(client, message, args) {
    if (!args[0]) {
      return messageUtils.sendEphemeralReply(
        message,
        client,
        client.embedBuilder.error(
          client,
          message.t("commands.tempmute.args_missing"),
        ),
      );
    }

    const member =
      message.mentions.members.first() ||
      message.guild.members.cache.get(args[0]);
    if (!member)
      return messageUtils.sendEphemeralReply(
        message,
        client,
        client.embedBuilder.error(
          client,
          message.t("commands.tempmute.target_not_found"),
        ),
      );

    const guildSettingsForPreset = client.db.getGuild(message.guild.id) || {};
    const presetsEnabled = !!guildSettingsForPreset.mutePresetsEnabled;

    if (!args[1]) {
      if (presetsEnabled) {
        const presets = client.db.getMutePresets(message.guild.id) || [];
        if (!presets.length) {
          return messageUtils.sendEphemeralReply(
            message,
            client,
            client.embedBuilder.error(
              client,
              message.t("commands.tempmute.no_presets"),
            ),
          );
        }

        const hierarchyError = permissions.checkHierarchy(
          message,
          member,
          client,
          "mute temporairement",
        );
        if (hierarchyError)
          return messageUtils.sendEphemeralReply(
            message,
            client,
            client.embedBuilder.error(client, hierarchyError),
          );

        if (!member.moderatable) {
          try {
            await message.guild.members.fetch({ user: member.id, force: true });
          } catch (_) {}
          const refreshed =
            message.guild.members.cache.get(member.id) || member;
          if (!refreshed.moderatable) {
            const reason2 = require("../../utils/permissions").diagnoseModeratable(
              message.guild,
              refreshed,
              message.lang,
            );
            return messageUtils.sendEphemeralReply(
              message,
              client,
              client.embedBuilder.error(
                client,
                message.t("commands.tempmute.timeout_impossible", { reason: reason2 }),
              ),
            );
          }
        }

        const promptEmbed = client.embedBuilder.info(
          client,
          message.t("commands.tempmute.choose_preset_prompt", { user: member.id }),
        );

        const sent = await message
          .reply({
            embeds: [promptEmbed],
            components: [buildPresetSelectRow(presets, false, message.t)],
          })
          .catch(() => null);
        if (!sent) return;

        const collector = sent.createMessageComponentCollector({
          filter: (i) => i.user.id === message.author.id,
          time: 60_000,
        });

        collector.on("collect", async (interaction) => {
          try {
            if (interaction.customId === "tempmute_preset_select") {
              const choice = interaction.values[0];
              const preset = client.db.getMutePreset(
                message.guild.id,
                choice.toLowerCase(),
              );
              if (!preset) {
                await interaction
                  .update({
                    embeds: [
                      client.embedBuilder.error(
                        client,
                        message.t("commands.tempmute.preset_not_found"),
                      ),
                    ],
                    components: [buildPresetSelectRow(presets, true, message.t)],
                  })
                  .catch(() => {});
                collector.stop("done");
                return;
              }

              const durationMs = preset.durationSeconds * 1000;
              if (durationMs > 2419200000) {
                await interaction
                  .update({
                    embeds: [
                      client.embedBuilder.error(
                        client,
                        message.t("commands.tempmute.preset_duration_out_of_range"),
                      ),
                    ],
                    components: [buildPresetSelectRow(presets, true, message.t)],
                  })
                  .catch(() => {});
                collector.stop("done");
                return;
              }

              const reason = preset.reason || "";

              await interaction.deferUpdate().catch(() => {});
              const result = await applyMute(
                client,
                message,
                member,
                durationMs,
                reason,
                preset.name,
                preset.name,
              );

              if (result.ok) {
                await sent
                  .edit({
                    embeds: [result.embed],
                    components: [buildPresetSelectRow(presets, true, message.t)],
                  })
                  .catch(() => {});
              } else {
                await sent
                  .edit({
                    embeds: [
                      client.embedBuilder.error(client, message.t("commands.tempmute.failed")),
                    ],
                    components: [buildPresetSelectRow(presets, true, message.t)],
                  })
                  .catch(() => {});
              }
              collector.stop("done");
            }
          } catch (e) {
            try {
              await interaction.deferUpdate();
            } catch (_) {}
          }
        });

        collector.on("end", (_collected, reason) => {
          if (reason === "done") return;
          sent
            .edit({
              components: [buildPresetSelectRow(presets, true, message.t)],
            })
            .catch(() => {});
        });

        return;
      }

      return messageUtils.sendEphemeralReply(
        message,
        client,
        client.embedBuilder.error(
          client,
          message.t("commands.tempmute.duration_or_preset_missing"),
        ),
      );
    }

    const hierarchyError = permissions.checkHierarchy(
      message,
      member,
      client,
      "mute temporairement",
    );
    if (hierarchyError)
      return messageUtils.sendEphemeralReply(
        message,
        client,
        client.embedBuilder.error(client, hierarchyError),
      );

    if (!member.moderatable) {
      try {
        await message.guild.members.fetch({ user: member.id, force: true });
      } catch (_) {}
      const refreshed = message.guild.members.cache.get(member.id) || member;
      if (!refreshed.moderatable) {
        const reason2 = require("../../utils/permissions").diagnoseModeratable(
          message.guild,
          refreshed,
          message.lang,
        );
        return messageUtils.sendEphemeralReply(
          message,
          client,
          client.embedBuilder.error(client, message.t("commands.tempmute.timeout_impossible", { reason: reason2 })),
        );
      }
    }

    const duration = args[1];
    let durationMs = null;
    let resolvedFromPreset = null;
    let reason = args.slice(2).join(" ").trim();

    const timeMatch = duration.match(/^(\d+)([smhd])$/i);
    if (timeMatch) {
      const [, amount, unit] = timeMatch;
      const multipliers = { s: 1000, m: 60000, h: 3600000, d: 86400000 };
      durationMs = parseInt(amount) * multipliers[unit.toLowerCase()];
    } else {
      const preset = client.db.getMutePreset(
        message.guild.id,
        duration.toLowerCase(),
      );
      if (preset) {
        durationMs = preset.durationSeconds * 1000;
        resolvedFromPreset = preset.name;
        if (!reason) reason = preset.reason || "";
      }
    }

    // Le owner défini dans .env (OWNER_ID) peut toujours utiliser une durée
    // libre (+mute ID 1h raison) même quand le serveur est en mode presets-only.
    const isEnvOwner = permissions.isPrimaryOwner(message.author.id);
    if (presetsEnabled && !resolvedFromPreset && !isEnvOwner) {
      const list = client.db.getMutePresets(message.guild.id);
      const names = list.length
        ? list.map((p) => `\`${p.name}\``).join(", ")
        : message.t("commands.tempmute.none_defined");
      return messageUtils.sendEphemeralReply(
        message,
        client,
        client.embedBuilder.error(
          client,
          message.t("commands.tempmute.presets_required", { names }),
        ),
      );
    }

    if (!durationMs) {
      return messageUtils.sendEphemeralReply(
        message,
        client,
        client.embedBuilder.error(
          client,
          message.t("commands.tempmute.invalid_duration"),
        ),
      );
    }

    if (durationMs > 2419200000) {
      return messageUtils.sendEphemeralReply(
        message,
        client,
        client.embedBuilder.error(
          client,
          message.t("commands.tempmute.duration_out_of_range"),
        ),
      );
    }

    const result = await applyMute(
      client,
      message,
      member,
      durationMs,
      reason,
      resolvedFromPreset,
      duration,
    );
    if (result.ok) {
      await message.reply({ embeds: [result.embed] }).catch(() => {});
    } else {
      messageUtils.sendEphemeralReply(
        message,
        client,
        client.embedBuilder.error(client, message.t("commands.tempmute.failed")),
      );
    }
  },
};
