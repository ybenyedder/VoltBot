const { PermissionFlagsBits } = require("discord.js");

module.exports = {
  name: "editnote",
  description: "Modifie une note d'un utilisateur",
  category: "moderation",
  usage: "editnote",
  userPerms: [PermissionFlagsBits.ManageMessages],
  async execute(client, message, args) {
    if (!args[0] || !args[1] || !args[2]) {
      return message
        .reply({
          embeds: [
            client.embedBuilder.error(
              client,
              message.t("commands.editnote.missing_args"),
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
              message.t("commands.editnote.target_not_found"),
            ),
          ],
        })
        .catch(() => {});

    const noteId = parseInt(args[1]);
    if (!noteId)
      return message
        .reply({
          embeds: [client.embedBuilder.error(client, message.t("commands.editnote.invalid_id"))],
        })
        .catch(() => {});

    const newContent = args.slice(2).join(" ");

    const notes = client.db.getUser(user.id, message.guild.id, "notes") || [];
    const noteIndex = notes.findIndex((n) => n.id === noteId);

    if (noteIndex === -1) {
      return message
        .reply({
          embeds: [client.embedBuilder.error(client, message.t("commands.editnote.note_not_found"))],
        })
        .catch(() => {});
    }

    const oldContent = notes[noteIndex].content;
    notes[noteIndex].content = newContent;
    notes[noteIndex].editedBy = message.author.id;
    notes[noteIndex].editedAt = new Date().toISOString();

    client.db.updateUser(user.id, message.guild.id, { notes: notes });

    const embed = client.embedBuilder
      .success(client, "​")
      .setDescription(null)
      .setAuthor({ name: message.t("commands.editnote.embed_title", { id: noteId }) })
      .addFields(
        { name: message.t("commands.editnote.field_target"), value: `<@${user.id}>`, inline: true },
        { name: message.t("commands.editnote.field_moderator"), value: `<@${message.author.id}>`, inline: true },
        {
          name: message.t("commands.editnote.field_diff"),
          value: `\`\`\`diff\n- ${oldContent}\n+ ${newContent}\n\`\`\``,
          inline: false,
        },
      );

    await message.reply({ embeds: [embed] }).catch(() => {});
  },
};
