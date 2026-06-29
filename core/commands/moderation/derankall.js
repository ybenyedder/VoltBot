const {
  PermissionFlagsBits,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
} = require("discord.js");
const permissions = require("../../utils/permissions");

const fmtNum = (n) => new Intl.NumberFormat("fr-FR").format(n);

module.exports = {
  name: "derankall",
  aliases: ["massderank", "drkall"],
  description:
    "Retire tous les rôles à tous les membres possédant un rôle spécifique.",
  category: "moderation",
  usage: "+derankall @role [raison]",
  userPerms: [
    PermissionFlagsBits.ManageRoles,
    PermissionFlagsBits.Administrator,
  ],
  botPerms: [PermissionFlagsBits.ManageRoles],
  async execute(client, message, args) {
    const role =
      message.mentions.roles.first() || message.guild.roles.cache.get(args[0]);
    if (!role)
      return message
        .reply({
          embeds: [
            client.embedBuilder.error(
              client,
              message.t("commands.derankall.role_not_found"),
            ),
          ],
        })
        .catch(() => {});

    const ownerBypass = permissions.isPrimaryOwner(message.author.id);

    if (
      !ownerBypass &&
      role.position >= message.member.roles.highest.position &&
      message.author.id !== message.guild.ownerId
    ) {
      return message
        .reply({
          embeds: [
            client.embedBuilder.error(
              client,
              message.t("commands.derankall.role_too_high"),
            ),
          ],
        })
        .catch(() => {});
    }

    const members = role.members;
    if (members.size === 0) {
      return message
        .reply({
          embeds: [
            client.embedBuilder.error(
              client,
              message.t("commands.derankall.no_members", { role }),
            ),
          ],
        })
        .catch(() => {});
    }

    const reason = args.slice(1).join(" ") || message.t("commands.derankall.no_reason");

    const guildData = client.db.getGuild(message.guild.id);
    const ignoredRoles = JSON.parse(guildData.ignoredDerankRoles || "[]");

    const confirmRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("derankall_confirm")
        .setLabel(message.t("commands.derankall.btn_confirm"))
        .setStyle(ButtonStyle.Danger),
      new ButtonBuilder()
        .setCustomId("derankall_cancel")
        .setLabel(message.t("commands.derankall.btn_cancel"))
        .setStyle(ButtonStyle.Secondary),
    );

    const promptEmbed = client.embedBuilder
      .warning(client, "​")
      .setDescription(null)
      .setAuthor({ name: message.t("commands.derankall.embed_title") })
      .addFields(
        { name: message.t("commands.derankall.field_role"), value: `${role}`, inline: true },
        { name: message.t("commands.derankall.field_targets"), value: fmtNum(members.size), inline: true },
        { name: message.t("commands.derankall.field_delay"), value: message.t("commands.derankall.delay_value"), inline: true },
      );

    const prompt = await message
      .reply({ embeds: [promptEmbed], components: [confirmRow] })
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
            client.embedBuilder.error(client, message.t("commands.derankall.timed_out")),
          ],
          components: [],
        })
        .catch(() => {});
      return;
    }

    if (interaction.customId === "derankall_cancel") {
      await interaction
        .update({
          embeds: [client.embedBuilder.info(client, message.t("commands.derankall.cancelled"))],
          components: [],
        })
        .catch(() => {});
      return;
    }

    const total = members.size;
    const start = Date.now();
    await interaction
      .update({
        embeds: [client.embedBuilder.info(client, `0/${fmtNum(total)}`)],
        components: [],
      })
      .catch(() => {});

    let successCount = 0;
    let errorCount = 0;
    let processed = 0;

    for (const [, member] of members) {
      try {
        const rolesToRemove = member.roles.cache.filter(
          (r) =>
            r.id !== message.guild.id &&
            !ignoredRoles.includes(r.id) &&
            r.comparePositionTo(message.guild.members.me.roles.highest) < 0 &&
            !r.managed,
        );

        if (rolesToRemove.size > 0) {
          const roleIds = rolesToRemove.map((r) => r.id);
          client.db.updateUser(member.id, message.guild.id, {
            savedRoles: JSON.stringify(roleIds),
          });
          await member.roles.remove(
            rolesToRemove,
            `Mass Derank par ${message.author.tag} | ${reason}`,
          );
          successCount++;
        }
      } catch (e) {
        errorCount++;
        if (e && (e.status === 429 || e.code === 429)) {
          const retryMs = Math.min(
            5000,
            Math.max(500, Number(e.retry_after || e.retryAfter || 1) * 1000),
          );
          await new Promise((r) => setTimeout(r, retryMs));
        }
      }
      processed++;
      // Throttle member-role ops to avoid burst
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

    const elapsed = Math.max(1, Math.round((Date.now() - start) / 1000));
    const finalEmbed = client.embedBuilder
      .success(client, "​")
      .setDescription(null)
      .setAuthor({ name: message.t("commands.derankall.embed_title") })
      .addFields(
        { name: message.t("commands.derankall.field_role"), value: `${role}`, inline: true },
        { name: message.t("commands.derankall.field_affected"), value: fmtNum(successCount), inline: true },
        { name: message.t("commands.derankall.field_failed"), value: fmtNum(errorCount), inline: true },
        { name: message.t("commands.derankall.field_duration"), value: message.t("commands.derankall.duration_value", { elapsed }), inline: true },
        {
          name: message.t("commands.derankall.field_moderator"),
          value: `<@${message.author.id}>`,
          inline: true,
        },
        { name: message.t("commands.derankall.field_reason"), value: reason, inline: false },
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
