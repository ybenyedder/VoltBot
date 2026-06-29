const { PermissionFlagsBits } = require("discord.js");

const fmtNum = (n) => new Intl.NumberFormat("fr-FR").format(n);

module.exports = {
  name: "addnote",
  description: "Ajoute une note à un utilisateur",
  category: "moderation",
  usage: "addnote",
  userPerms: [PermissionFlagsBits.ManageMessages],
  async execute(client, message, args) {
    if (!args[0] || !args[1]) {
      return message
        .reply({
          embeds: [
            client.embedBuilder.error(
              client,
              message.t("commands.addnote.missing_args"),
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
              message.t("commands.addnote.target_not_found"),
            ),
          ],
        })
        .catch(() => {});

    const note = args.slice(1).join(" ");
    const notes = client.db.getUser(user.id, message.guild.id, "notes") || [];

    const newId = notes.length + 1;
    notes.push({
      id: newId,
      content: note,
      moderator: message.author.id,
      date: new Date().toISOString(),
      guild: message.guild.id,
    });

    client.db.updateUser(user.id, message.guild.id, { notes: notes });

    const embed = client.embedBuilder
      .success(client, "​")
      .setDescription(null)
      .setAuthor({
        name: message.t("commands.addnote.note_added", { id: newId }),
        iconURL: user.displayAvatarURL({ size: 256 }),
      })
      .addFields(
        {
          name: message.t("commands.addnote.field_target"),
          value: `<@${user.id}>`,
          inline: true,
        },
        {
          name: message.t("commands.addnote.field_moderator"),
          value: `<@${message.author.id}>`,
          inline: true,
        },
        {
          name: message.t("commands.addnote.field_total"),
          value: fmtNum(notes.length),
          inline: true,
        },
        {
          name: message.t("commands.addnote.field_content"),
          value: note,
          inline: false,
        },
      );

    await message.reply({ embeds: [embed] }).catch(() => {});
  },
};
