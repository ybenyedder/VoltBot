const { PermissionFlagsBits } = require("discord.js");

const fmtNum = (n) => new Intl.NumberFormat("fr-FR").format(n);

module.exports = {
  name: "delnote",
  description: "Supprime une note d'un utilisateur",
  category: "moderation",
  usage: "delnote",
  userPerms: [PermissionFlagsBits.ManageMessages],
  async execute(client, message, args) {
    if (!args[0]) {
      return message
        .reply({
          embeds: [
            client.embedBuilder.error(
              client,
              message.t("commands.delnote.missing_args"),
            ),
          ],
        })
        .catch(() => {});
    }

    const user =
      message.mentions.users.first() || client.users.cache.get(args[0]);
    if (!user)
      return message
        .reply({
          embeds: [
            client.embedBuilder.error(
              client,
              message.t("commands.delnote.target_not_found"),
            ),
          ],
        })
        .catch(() => {});

    const noteId = parseInt(args[1]);
    if (!noteId)
      return message
        .reply({
          embeds: [client.embedBuilder.error(client, message.t("commands.delnote.invalid_id"))],
        })
        .catch(() => {});

    const notes = client.db.getUser(user.id, message.guild.id, "notes") || [];
    const noteIndex = notes.findIndex((n) => n.id === noteId);

    if (noteIndex === -1) {
      return message
        .reply({
          embeds: [client.embedBuilder.error(client, message.t("commands.delnote.note_not_found"))],
        })
        .catch(() => {});
    }

    const deletedNote = notes[noteIndex];
    notes.splice(noteIndex, 1);
    client.db.updateUser(user.id, message.guild.id, { notes: notes });

    const embed = client.embedBuilder
      .success(client, "​")
      .setDescription(null)
      .setAuthor({ name: message.t("commands.delnote.title", { id: noteId }) })
      .addFields(
        { name: message.t("commands.delnote.field_target"), value: `<@${user.id}>`, inline: true },
        { name: message.t("commands.delnote.field_moderator"), value: `<@${message.author.id}>`, inline: true },
        { name: message.t("commands.delnote.field_remaining"), value: fmtNum(notes.length), inline: true },
        { name: message.t("commands.delnote.field_content"), value: deletedNote.content, inline: false },
      );

    await message.reply({ embeds: [embed] }).catch(() => {});
  },
};
