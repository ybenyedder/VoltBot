const { EmbedBuilder } = require("discord.js");
const { isBotOwner } = require("../../utils/permissions");

// Convertit un nombre d'octets en chaîne lisible.
function formatBytes(bytes) {
  if (!bytes || bytes < 0) return "0 o";
  const units = ["o", "Ko", "Mo", "Go"];
  let i = 0;
  let n = bytes;
  while (n >= 1024 && i < units.length - 1) {
    n /= 1024;
    i++;
  }
  return `${n.toFixed(n >= 100 || i === 0 ? 0 : 1)} ${units[i]}`;
}

module.exports = {
  name: "dbrestore",
  description:
    "Liste les snapshots DB ou restaure depuis un id. Restauration : arrête le bot, swap au prochain démarrage.",
  category: "admin",
  usage: "+dbrestore [snapshot-id]",
  ownerOnly: true,
  async execute(client, message, args) {
    if (!isBotOwner(client, message.author.id)) {
      return message
        .reply({
          embeds: [
            client.embedBuilder.error(
              client,
              message.t("commands.dbrestore.insufficient_perms"),
            ),
          ],
        })
        .catch(() => {});
    }

    if (
      !client.db ||
      typeof client.db.listSnapshots !== "function" ||
      typeof client.db.stageRestore !== "function"
    ) {
      return message
        .reply({
          embeds: [
            client.embedBuilder.error(
              client,
              message.t("commands.dbrestore.db_unavailable"),
            ),
          ],
        })
        .catch(() => {});
    }

    const all = client.db.listSnapshots();

    // Pas d'argument : on liste les snapshots disponibles.
    if (!args[0]) {
      if (all.length === 0) {
        return message
          .reply({
            embeds: [
              client.embedBuilder.info(
                client,
                message.t("commands.dbrestore.no_snapshots"),
              ),
            ],
          })
          .catch(() => {});
      }

      const lines = all.slice(0, 7).map((s, i) => {
        const date = new Date(s.mtime);
        const ts = Math.floor(s.mtime / 1000);
        return message.t("commands.dbrestore.snapshot_line", { index: i + 1, id: s.id, size: formatBytes(s.size), ts });
      });

      const embed = new EmbedBuilder()
        .setColor(client.embedBuilder.getTheme(client))
        .setAuthor({
          name: message.t("commands.dbrestore.embed_author"),
          iconURL: client.user.displayAvatarURL(),
        })
        .setDescription(lines.join("\n\n"))
        .setFooter({
          text: message.t("commands.dbrestore.footer", { count: all.length }),
        });

      return message.reply({ embeds: [embed] }).catch(() => {});
    }

    // Argument fourni : on tente la restauration.
    const wanted = args[0].trim();
    const snap = all.find((s) => s.id === wanted || s.name === wanted);

    if (!snap) {
      return message
        .reply({
          embeds: [
            client.embedBuilder.error(
              client,
              message.t("commands.dbrestore.snapshot_not_found", { wanted }),
            ),
          ],
        })
        .catch(() => {});
    }

    const result = client.db.stageRestore(snap.id);
    if (!result.ok) {
      return message
        .reply({
          embeds: [
            client.embedBuilder.error(
              client,
              message.t("commands.dbrestore.restore_failed", { error: result.error || message.t("commands.dbrestore.unknown_error") }),
            ),
          ],
        })
        .catch(() => {});
    }

    const embed = client.embedBuilder
      .success(
        client,
        message.t("commands.dbrestore.restore_staged"),
      )
      .addFields(
        { name: message.t("commands.dbrestore.field_snapshot"), value: `\`${snap.name}\``, inline: false },
        { name: message.t("commands.dbrestore.field_size"), value: formatBytes(snap.size), inline: true },
        {
          name: message.t("commands.dbrestore.field_pending_file"),
          value: "`data/bot.db.pending`",
          inline: true,
        },
        {
          name: message.t("commands.dbrestore.field_action_required"),
          value:
            message.t("commands.dbrestore.action_required_value"),
          inline: false,
        },
      );

    await message.reply({ embeds: [embed] }).catch(() => {});

    // Laisse le temps au message de partir, puis arrêt propre.
    setTimeout(() => {
      try {
        process.kill(process.pid, "SIGTERM");
      } catch (e) {
        process.exit(0);
      }
    }, 1500);
  },
};
