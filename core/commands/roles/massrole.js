const {
  PermissionFlagsBits,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
} = require("discord.js");
const permissions = require("../../utils/permissions");

const fmtNum = (n) => new Intl.NumberFormat("fr-FR").format(n);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const SUBCOMMANDS = ["add", "remove", "bots", "humans", "inrole"];

function buildHelpEmbed(client, message) {
  return client.embedBuilder
    .info(client, "​")
    .setDescription(null)
    .setAuthor({ name: "Massrole" })
    .addFields(
      {
        name: message.t("commands.massrole.field_usage"),
        value: [
          "`+massrole add @role`",
          "`+massrole remove @role`",
          "`+massrole bots @role`",
          "`+massrole humans @role`",
          "`+massrole inrole @source @target`",
        ].join("\n"),
      },
    );
}

function hierarchyError(client, message, role) {
  if (
    !permissions.isPrimaryOwner(message.author.id) &&
    message.member.roles.highest.position <= role.position &&
    message.author.id !== message.guild.ownerId
  ) {
    return message.t("commands.massrole.role_higher_than_you");
  }
  if (message.guild.members.me.roles.highest.position <= role.position) {
    return message.t("commands.massrole.role_higher_than_bot");
  }
  if (role.managed) {
    return message.t("commands.massrole.role_managed");
  }
  if (role.id === message.guild.id) {
    return message.t("commands.massrole.role_everyone");
  }
  return null;
}

async function confirmIfNeeded(client, message, action, role, targetCount) {
  if (targetCount <= 50) return true;

  const confirmRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("massrole_confirm")
      .setLabel(message.t("commands.massrole.btn_confirm"))
      .setStyle(ButtonStyle.Danger),
    new ButtonBuilder()
      .setCustomId("massrole_cancel")
      .setLabel(message.t("commands.massrole.btn_cancel"))
      .setStyle(ButtonStyle.Secondary),
  );

  const promptEmbed = client.embedBuilder
    .warning(client, "​")
    .setDescription(null)
    .setAuthor({ name: "Massrole" })
    .addFields(
      { name: message.t("commands.massrole.field_action"), value: `\`${action}\``, inline: true },
      { name: message.t("commands.massrole.field_role"), value: `${role}`, inline: true },
      { name: message.t("commands.massrole.field_targets"), value: fmtNum(targetCount), inline: true },
      { name: message.t("commands.massrole.field_delay"), value: message.t("commands.massrole.delay_value"), inline: true },
    );

  const prompt = await message
    .reply({ embeds: [promptEmbed], components: [confirmRow] })
    .catch(() => null);
  if (!prompt) return false;

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
          client.embedBuilder.error(client, message.t("commands.massrole.timeout")),
        ],
        components: [],
      })
      .catch(() => {});
    return false;
  }

  if (interaction.customId === "massrole_cancel") {
    await interaction
      .update({
        embeds: [client.embedBuilder.info(client, message.t("commands.massrole.cancelled"))],
        components: [],
      })
      .catch(() => {});
    return false;
  }

  await interaction
    .update({
      embeds: [
        client.embedBuilder.info(client, `0/${fmtNum(targetCount)}`),
      ],
      components: [],
    })
    .catch(() => {});
  return prompt;
}

async function runBulk(client, message, statusMsg, members, role, mode, label) {
  const total = members.size;
  const start = Date.now();
  let done = 0;
  let failed = 0;
  let skipped = 0;
  let processed = 0;

  const reasonTag = `[MASSROLE:${mode}] ${message.author.tag}`;

  for (const m of members.values()) {
    try {
      if (mode === "remove") {
        if (!m.roles.cache.has(role.id)) {
          skipped++;
        } else {
          await m.roles.remove(role, reasonTag);
          done++;
        }
      } else {
        if (m.roles.cache.has(role.id)) {
          skipped++;
        } else {
          await m.roles.add(role, reasonTag);
          done++;
        }
      }
    } catch (e) {
      failed++;
      if (e && (e.status === 429 || e.code === 429)) {
        const retryMs = Math.min(
          5000,
          Math.max(500, Number(e.retry_after || e.retryAfter || 1) * 1000),
        );
        await sleep(retryMs);
      }
    }
    processed++;
    if (processed % 5 === 0) await sleep(120);
    if (statusMsg && processed % 20 === 0) {
      await statusMsg
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
    .setAuthor({ name: "Massrole" })
    .addFields(
      { name: message.t("commands.massrole.field_action"), value: `\`${label}\``, inline: true },
      { name: message.t("commands.massrole.field_role"), value: `${role}`, inline: true },
      { name: message.t("commands.massrole.field_targets"), value: fmtNum(total), inline: true },
      { name: message.t("commands.massrole.field_affected"), value: fmtNum(done), inline: true },
      { name: message.t("commands.massrole.field_ignored"), value: fmtNum(skipped), inline: true },
      { name: message.t("commands.massrole.field_failed"), value: fmtNum(failed), inline: true },
      { name: message.t("commands.massrole.field_duration"), value: message.t("commands.massrole.duration_value", { seconds: elapsed }), inline: true },
      {
        name: message.t("commands.massrole.field_moderator"),
        value: `<@${message.author.id}>`,
        inline: true,
      },
    );

  if (statusMsg) {
    await statusMsg
      .edit({ embeds: [finalEmbed], components: [] })
      .catch(() =>
        message.channel.send({ embeds: [finalEmbed] }).catch(() => {}),
      );
  } else {
    await message.reply({ embeds: [finalEmbed] }).catch(() => {});
  }

  try {
    const guildSettings = client.db.getGuild(message.guild.id);
    if (guildSettings && guildSettings.modLogsChannel) {
      const logChannel = message.guild.channels.cache.get(
        guildSettings.modLogsChannel,
      );
      if (logChannel)
        logChannel.send({ embeds: [finalEmbed] }).catch(() => {});
    }
  } catch (_) {
    // log channel optional
  }
}

module.exports = {
  name: "massrole",
  aliases: ["mrole", "rolemass", "massiverole"],
  description:
    "Applique ou retire un rôle en masse selon le filtre choisi (add, remove, bots, humans, inrole).",
  category: "roles",
  usage: "+massrole <add|remove|bots|humans|inrole> @role [@targetRole]",
  userPerms: [
    PermissionFlagsBits.ManageRoles,
    PermissionFlagsBits.Administrator,
  ],
  botPerms: [PermissionFlagsBits.ManageRoles],
  async execute(client, message, args) {
    const sub = (args[0] || "").toLowerCase();
    if (!SUBCOMMANDS.includes(sub)) {
      return message
        .reply({ embeds: [buildHelpEmbed(client, message)] })
        .catch(() => {});
    }

    // Fetch the full member list once. Required for non-bot iteration.
    await message.guild.members.fetch().catch(() => {});

    let sourceRole = null;
    let targetRole = null;
    let mode;
    let label;
    let filterFn;

    if (sub === "inrole") {
      sourceRole =
        message.mentions.roles.first() ||
        message.guild.roles.cache.get(args[1]);
      targetRole =
        (message.mentions.roles.size > 1
          ? message.mentions.roles.at(1)
          : null) || message.guild.roles.cache.get(args[2]);

      if (!sourceRole || !targetRole) {
        return message
          .reply({
            embeds: [
              client.embedBuilder.error(
                client,
                message.t("commands.massrole.mention_source_target"),
              ),
            ],
          })
          .catch(() => {});
      }
      if (sourceRole.id === targetRole.id) {
        return message
          .reply({
            embeds: [
              client.embedBuilder.error(
                client,
                message.t("commands.massrole.source_target_differ"),
              ),
            ],
          })
          .catch(() => {});
      }
      mode = "add";
      label = "inrole";
      filterFn = (m) => !m.user.bot && m.roles.cache.has(sourceRole.id);
    } else {
      targetRole =
        message.mentions.roles.first() ||
        message.guild.roles.cache.get(args[1]);
      if (!targetRole) {
        return message
          .reply({
            embeds: [
              client.embedBuilder.error(client, message.t("commands.massrole.target_role_not_found")),
            ],
          })
          .catch(() => {});
      }
      if (sub === "add") {
        mode = "add";
        label = "add";
        filterFn = (m) => !m.user.bot;
      } else if (sub === "remove") {
        mode = "remove";
        label = "remove";
        filterFn = (m) => !m.user.bot;
      } else if (sub === "bots") {
        mode = "add";
        label = "bots";
        filterFn = (m) => m.user.bot;
      } else if (sub === "humans") {
        mode = "add";
        label = "humans";
        filterFn = (m) => !m.user.bot;
      }
    }

    const hierErr = hierarchyError(client, message, targetRole);
    if (hierErr) {
      return message
        .reply({ embeds: [client.embedBuilder.error(client, hierErr)] })
        .catch(() => {});
    }

    const members = message.guild.members.cache.filter((m) => {
      if (!filterFn(m)) return false;
      if (mode === "add" && m.roles.cache.has(targetRole.id)) return false;
      if (mode === "remove" && !m.roles.cache.has(targetRole.id)) return false;
      return true;
    });

    if (members.size === 0) {
      return message
        .reply({
          embeds: [
            client.embedBuilder.warning(
              client,
              message.t("commands.massrole.no_members"),
            ),
          ],
        })
        .catch(() => {});
    }

    const confirmed = await confirmIfNeeded(
      client,
      message,
      label,
      targetRole,
      members.size,
    );
    if (!confirmed) return;

    const statusMsg = confirmed === true ? null : confirmed;

    if (!statusMsg) {
      // Small batch path: post a fresh status message.
      const initial = await message
        .reply({
          embeds: [
            client.embedBuilder.info(
              client,
              `0/${fmtNum(members.size)}`,
            ),
          ],
        })
        .catch(() => null);
      await runBulk(
        client,
        message,
        initial,
        members,
        targetRole,
        mode,
        label,
      );
    } else {
      await runBulk(
        client,
        message,
        statusMsg,
        members,
        targetRole,
        mode,
        label,
      );
    }
  },
};
