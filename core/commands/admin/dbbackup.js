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
  name: "dbbackup",
  aliases: ["dbsnapshot"],
  description:
    "Crée un snapshot atomique de la base SQLite via db.backup(). Garde les 7 plus récents.",
  category: "admin",
  usage: "+dbbackup",
  ownerOnly: true,
  async execute(client, message) {
    if (!isBotOwner(client, message.author.id)) {
      return message
        .reply({
          embeds: [
            client.embedBuilder.error(
              client,
              message.t("commands.dbbackup.insufficient_perms"),
            ),
          ],
        })
        .catch(() => {});
    }

    if (
      !client.db ||
      typeof client.db.createSnapshot !== "function" ||
      typeof client.db.listSnapshots !== "function"
    ) {
      return message
        .reply({
          embeds: [
            client.embedBuilder.error(
              client,
              message.t("commands.dbbackup.db_unavailable"),
            ),
          ],
        })
        .catch(() => {});
    }

    const pending = await message
      .reply({
        embeds: [
          client.embedBuilder.info(
            client,
            message.t("commands.dbbackup.in_progress"),
          ),
        ],
      })
      .catch(() => null);

    const result = await client.db.createSnapshot();

    if (!result.ok) {
      const embed = client.embedBuilder.error(
        client,
        message.t("commands.dbbackup.snapshot_failed", { error: result.error || message.t("commands.dbbackup.unknown_error") }),
      );
      if (pending) return pending.edit({ embeds: [embed] }).catch(() => {});
      return message.reply({ embeds: [embed] }).catch(() => {});
    }

    const all = client.db.listSnapshots();
    const name = require("path").basename(result.file);

    const embed = client.embedBuilder
      .success(client, message.t("commands.dbbackup.snapshot_created"))
      .addFields(
        { name: message.t("commands.dbbackup.field_file"), value: `\`${name}\``, inline: false },
        { name: message.t("commands.dbbackup.field_size"), value: formatBytes(result.size), inline: true },
        {
          name: message.t("commands.dbbackup.field_total_kept"),
          value: `${all.length}/7`,
          inline: true,
        },
      );

    if (pending) return pending.edit({ embeds: [embed] }).catch(() => {});
    return message.reply({ embeds: [embed] }).catch(() => {});
  },
};
