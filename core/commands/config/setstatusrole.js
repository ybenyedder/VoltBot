const { ActivityType, PermissionsBitField } = require("discord.js");
const permissions = require("../../utils/permissions");

const DEFAULT_TRIGGERS = ["/nocoin", ".gg/nocoin"];

function getCustomStatusText(member) {
  const custom = member.presence?.activities?.find(
    (activity) => activity.type === ActivityType.Custom,
  );
  if (!custom) return "";
  return [custom.state, custom.name].filter(Boolean).join(" ").toLowerCase();
}

module.exports = {
  name: "setstatusrole",
  aliases: ["statusrole"],
  description:
    "Donne un rôle quand un membre a un texte précis dans son statut personnalisé.",
  category: "config",
  usage: "+setstatusrole @Role [/nocoin .gg/nocoin] | +setstatusrole off",
  userPerms: [PermissionsBitField.Flags.Administrator],
  botPerms: [PermissionsBitField.Flags.ManageRoles],
  async execute(client, message, args) {
    if (
      !message.member.permissions.has("Administrator") &&
      !permissions.isPrimaryOwner(message.author.id)
    ) {
      return message
        .reply({
          embeds: [
            client.embedBuilder.error(
              client,
              message.t("commands.setstatusrole.perm_denied"),
            ),
          ],
        })
        .catch(() => {});
    }

    const gs = client.db.getGuild(message.guild.id) || {};
    const oldId = gs.statusRole || null;
    const oldDisplay = oldId ? `<@&${oldId}>` : message.t("commands.setstatusrole.none");
    let oldTriggers = DEFAULT_TRIGGERS;
    try {
      if (gs.statusRoleTriggers)
        oldTriggers = JSON.parse(gs.statusRoleTriggers);
    } catch (e) {}

    if (!args[0]) {
      const embed = client.embedBuilder
        .info(client, message.t("commands.setstatusrole.no_argument"))
        .setAuthor({
          name: message.t("commands.setstatusrole.author"),
          iconURL: client.user.displayAvatarURL(),
        })
        .setDescription(null)
        .addFields(
          { name: message.t("commands.setstatusrole.field_role"), value: oldDisplay, inline: true },
          {
            name: message.t("commands.setstatusrole.field_triggers"),
            value: oldTriggers.map((t) => `\`${t}\``).join(" "),
            inline: true,
          },
          {
            name: message.t("commands.setstatusrole.field_usage"),
            value: "`+setstatusrole @Role [mot1] [mot2]`\n`+setstatusrole off`",
            inline: false,
          },
        );
      return message.reply({ embeds: [embed] }).catch(() => {});
    }

    if (args[0].toLowerCase() === "off") {
      if (!oldId) {
        return message
          .reply({
            embeds: [
              client.embedBuilder.warning(
                client,
                message.t("commands.setstatusrole.same_value"),
              ),
            ],
          })
          .catch(() => {});
      }
      client.db.updateGuild(message.guild.id, {
        statusRole: null,
        statusRoleTriggers: JSON.stringify(DEFAULT_TRIGGERS),
      });
      const embed = client.embedBuilder
        .success(client, null)
        .setAuthor({
          name: message.t("commands.setstatusrole.author"),
          iconURL: client.user.displayAvatarURL(),
        })
        .setDescription(
          "```diff\n- @&" +
            oldId +
            "\n+ " +
            message.t("commands.setstatusrole.none") +
            "\n```",
        );
      return message.reply({ embeds: [embed] }).catch(() => {});
    }

    const mentionedRole = message.mentions.roles.first();
    const role = mentionedRole || message.guild.roles.cache.get(args[0]);
    if (!role) {
      return message
        .reply({
          embeds: [
            client.embedBuilder.error(
              client,
              message.t("commands.setstatusrole.role_invalid"),
            ),
          ],
        })
        .catch(() => {});
    }

    if (message.guild.members.me.roles.highest.position <= role.position) {
      return message
        .reply({
          embeds: [
            client.embedBuilder.error(
              client,
              message.t("commands.setstatusrole.role_too_high"),
            ),
          ],
        })
        .catch(() => {});
    }

    const triggers = (
      mentionedRole
        ? args.filter((arg) => !/^<@&\d+>$/.test(arg))
        : args.slice(1)
    )
      .map((trigger) => trigger.trim().toLowerCase())
      .filter(Boolean);
    const finalTriggers = triggers.length > 0 ? triggers : DEFAULT_TRIGGERS;

    const sameRole = oldId === role.id;
    const sameTriggers =
      JSON.stringify(oldTriggers.slice().sort()) ===
      JSON.stringify(finalTriggers.slice().sort());
    if (sameRole && sameTriggers) {
      return message
        .reply({
          embeds: [
            client.embedBuilder.warning(
              client,
              message.t("commands.setstatusrole.same_value"),
            ),
          ],
        })
        .catch(() => {});
    }

    client.db.updateGuild(message.guild.id, {
      statusRole: role.id,
      statusRoleTriggers: JSON.stringify(finalTriggers),
    });

    let synced = 0;
    for (const member of message.guild.members.cache.values()) {
      if (member.user.bot) continue;
      const shouldHaveRole = finalTriggers.some((trigger) =>
        getCustomStatusText(member).includes(trigger),
      );
      const hasRole = member.roles.cache.has(role.id);
      if (shouldHaveRole && !hasRole) {
        await member.roles
          .add(role, message.t("commands.setstatusrole.reason_required"))
          .then(() => synced++)
          .catch(() => {});
      } else if (!shouldHaveRole && hasRole) {
        await member.roles
          .remove(role, message.t("commands.setstatusrole.reason_removed"))
          .then(() => synced++)
          .catch(() => {});
      }
    }

    const syncedFmt = new Intl.NumberFormat("fr-FR").format(synced);
    const embed = client.embedBuilder
      .success(client, null)
      .setAuthor({
        name: message.t("commands.setstatusrole.author"),
        iconURL: client.user.displayAvatarURL(),
      })
      .setDescription(null)
      .addFields(
        { name: message.t("commands.setstatusrole.field_before"), value: oldDisplay, inline: true },
        { name: message.t("commands.setstatusrole.field_after"), value: `<@&${role.id}>`, inline: true },
        {
          name: message.t("commands.setstatusrole.field_triggers"),
          value: finalTriggers.map((t) => `\`${t}\``).join(" "),
          inline: false,
        },
        {
          name: message.t("commands.setstatusrole.field_synced"),
          value: message.t("commands.setstatusrole.synced_value", { count: syncedFmt }),
          inline: true,
        },
      );
    return message.reply({ embeds: [embed] }).catch(() => {});
  },
};
