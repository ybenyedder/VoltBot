const {
  PermissionFlagsBits,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
} = require("discord.js");
const sanctionUtils = require("../../utils/sanctionUtils");

const fmtNum = (n) => new Intl.NumberFormat("fr-FR").format(n);

module.exports = {
  name: "unmuteallmassif",
  description: "Unmute tous les utilisateurs mutés",
  category: "moderation",
  usage: "unmuteallmassif",
  userPerms: [PermissionFlagsBits.Administrator],
  botPerms: [PermissionFlagsBits.ModerateMembers],
  async execute(client, message, args) {
    const mutedMembers = message.guild.members.cache.filter((member) =>
      member.isCommunicationDisabled(),
    );

    if (mutedMembers.size === 0) {
      return message
        .reply({
          embeds: [client.embedBuilder.info(client, message.t("commands.unmuteallmassif.no_muted"))],
        })
        .catch(() => {});
    }

    const confirmRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("umam_confirm")
        .setLabel(message.t("commands.unmuteallmassif.btn_confirm"))
        .setStyle(ButtonStyle.Danger),
      new ButtonBuilder()
        .setCustomId("umam_cancel")
        .setLabel(message.t("commands.unmuteallmassif.btn_cancel"))
        .setStyle(ButtonStyle.Secondary),
    );

    const prompt = await message
      .reply({
        embeds: [
          client.embedBuilder
            .warning(client, "​")
            .setDescription(null)
            .setAuthor({ name: message.t("commands.unmuteallmassif.title") })
            .addFields(
              {
                name: message.t("commands.unmuteallmassif.field_targets"),
                value: fmtNum(mutedMembers.size),
                inline: true,
              },
              { name: message.t("commands.unmuteallmassif.field_scope"), value: message.t("commands.unmuteallmassif.scope_server"), inline: true },
              { name: message.t("commands.unmuteallmassif.field_delay"), value: message.t("commands.unmuteallmassif.delay_value"), inline: true },
            ),
        ],
        components: [confirmRow],
      })
      .catch(() => null);
    if (!prompt) return;

    let interaction;
    try {
      interaction = await prompt.awaitMessageComponent({
        componentType: ComponentType.Button,
        filter: (i) => i.user.id === message.author.id,
        time: 30000,
      });
    } catch {
      await prompt
        .edit({
          embeds: [
            client.embedBuilder.error(client, message.t("commands.unmuteallmassif.timeout")),
          ],
          components: [],
        })
        .catch(() => {});
      return;
    }

    if (interaction.customId === "umam_cancel") {
      await interaction
        .update({
          embeds: [client.embedBuilder.info(client, message.t("commands.unmuteallmassif.cancelled"))],
          components: [],
        })
        .catch(() => {});
      return;
    }

    const total = mutedMembers.size;
    const start = Date.now();
    await interaction
      .update({
        embeds: [client.embedBuilder.info(client, `0/${fmtNum(total)}`)],
        components: [],
      })
      .catch(() => {});

    let unmutedCount = 0;
    let failed = 0;
    let processed = 0;
    for (const member of mutedMembers.values()) {
      try {
        await member.timeout(null, "Unmute massif");
        await sanctionUtils.sendSanctionLiftDm(
          client,
          member,
          message.guild,
          "mute",
          "Unmute massif",
        );
        unmutedCount++;
      } catch (error) {
        failed++;
        if (error && (error.status === 429 || error.code === 429)) {
          const retryMs = Math.min(
            5000,
            Math.max(
              500,
              Number(error.retry_after || error.retryAfter || 1) * 1000,
            ),
          );
          await new Promise((r) => setTimeout(r, retryMs));
        }
      }
      processed++;
      if (processed % 5 === 0) {
        await new Promise((r) => setTimeout(r, 120));
      }
      if (total > 20 && processed % 10 === 0) {
        await prompt
          .edit({
            embeds: [
              client.embedBuilder.info(
                client,
                `${fmtNum(processed)}/${fmtNum(total)}`,
              ),
            ],
          })
          .catch(() => {});
      }
    }

    client.db.updateGuild(message.guild.id, { tempMutes: [] });

    const elapsed = Math.max(1, Math.round((Date.now() - start) / 1000));
    const finalEmbed = client.embedBuilder
      .success(client, "​")
      .setDescription(null)
      .setAuthor({ name: message.t("commands.unmuteallmassif.title") })
      .addFields(
        { name: message.t("commands.unmuteallmassif.field_affected"), value: fmtNum(unmutedCount), inline: true },
        { name: message.t("commands.unmuteallmassif.field_failed"), value: fmtNum(failed), inline: true },
        { name: message.t("commands.unmuteallmassif.field_duration"), value: message.t("commands.unmuteallmassif.duration_value", { s: elapsed }), inline: true },
        {
          name: message.t("commands.unmuteallmassif.field_moderator"),
          value: `<@${message.author.id}>`,
          inline: true,
        },
      );

    await prompt
      .edit({ embeds: [finalEmbed] })
      .catch(() =>
        message.channel.send({ embeds: [finalEmbed] }).catch(() => {}),
      );

    const guildSettings = client.db.getGuild(message.guild.id);
    if (guildSettings.modLogsChannel) {
      const logChannel = message.guild.channels.cache.get(
        guildSettings.modLogsChannel,
      );
      if (logChannel) logChannel.send({ embeds: [finalEmbed] }).catch(() => {});
    }
  },
};
