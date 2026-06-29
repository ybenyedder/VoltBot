const { PermissionFlagsBits } = require("discord.js");

const normalizeLockStatus = (raw) => {
  if (raw && typeof raw === "object" && !Array.isArray(raw)) return raw;
  if (typeof raw === "number") return { enabled: raw === 1 };
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed))
        return parsed;
    } catch (e) {}
  }
  return {};
};

const buildSuccess = (client, message, lockStatus) =>
  client.embedBuilder.base(client, "Verrouillage des invitations").addFields(
    { name: "Salon", value: `<#${message.channel.id}>`, inline: true },
    {
      name: "Statut",
      value: lockStatus.enabled
        ? `\`${message.t("commands.lockinvite.locked")}\``
        : `\`${message.t("commands.lockinvite.unlocked")}\``,
      inline: true,
    },
    {
      name: "Raison",
      value: `\`${lockStatus.reason || message.t("commands.lockinvite.reason_unset")}\``,
      inline: true,
    },
  );

module.exports = {
  name: "lockinvite",
  description: "Verrouille les invitations du serveur",
  category: "invitations",
  usage: "lockinvite",
  userPerms: [PermissionFlagsBits.ManageGuild],
  async execute(client, message, args) {
    if (!args[0]) {
      const lockStatus = normalizeLockStatus(
        client.db.getGuild(message.guild.id, "lockInvite"),
      );

      const embed = client.embedBuilder
        .base(client, "Verrouillage des invitations")
        .addFields(
          { name: "Salon", value: `<#${message.channel.id}>`, inline: true },
          {
            name: "Statut",
            value: lockStatus.enabled
              ? `\`${message.t("commands.lockinvite.locked")}\``
              : `\`${message.t("commands.lockinvite.unlocked")}\``,
            inline: true,
          },
          {
            name: "Raison",
            value: `\`${lockStatus.reason || message.t("commands.lockinvite.reason_unset")}\``,
            inline: true,
          },
          {
            name: "Par",
            value: lockStatus.by
              ? `<@${lockStatus.by}>`
              : `\`${message.t("commands.lockinvite.by_unset")}\``,
            inline: true,
          },
          {
            name: "Usage",
            value:
              "`+lockinvite enable` · `+lockinvite disable` · `+lockinvite reason <texte>`",
            inline: false,
          },
        );

      return message.reply({ embeds: [embed] }).catch(() => {});
    }

    const action = args[0].toLowerCase();
    const lockStatus = normalizeLockStatus(
      client.db.getGuild(message.guild.id, "lockInvite"),
    );

    switch (action) {
      case "enable":
        lockStatus.enabled = true;
        lockStatus.by = message.author.id;
        lockStatus.at = new Date().toISOString();
        client.db.updateGuild(message.guild.id, { lockInvite: lockStatus });

        await message
          .reply({ embeds: [buildSuccess(client, message, lockStatus)] })
          .catch(() => {});
        break;

      case "disable":
        lockStatus.enabled = false;
        lockStatus.by = message.author.id;
        lockStatus.at = new Date().toISOString();
        client.db.updateGuild(message.guild.id, { lockInvite: lockStatus });

        await message
          .reply({ embeds: [buildSuccess(client, message, lockStatus)] })
          .catch(() => {});
        break;

      case "reason": {
        const reason = args.slice(1).join(" ");
        if (!reason) {
          return message
            .reply({
              embeds: [
                client.embedBuilder.warning(client, "Raison manquante."),
              ],
            })
            .catch(() => {});
        }

        lockStatus.reason = reason;
        client.db.updateGuild(message.guild.id, { lockInvite: lockStatus });

        await message
          .reply({ embeds: [buildSuccess(client, message, lockStatus)] })
          .catch(() => {});
        break;
      }

      default:
        await message
          .reply({
            embeds: [
              client.embedBuilder.error(
                client,
                "Action invalide. `enable`, `disable` ou `reason`.",
              ),
            ],
          })
          .catch(() => {});
    }
  },
};
