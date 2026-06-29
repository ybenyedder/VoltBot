const { PermissionsBitField } = require("discord.js");

module.exports = {
  name: "dog",
  description:
    "Force un utilisateur à vous suivre partout en vocal (troll). Il sera déplacé dans votre VC automatiquement.",
  category: "moderation",
  usage: "+dog @user",
  userPerms: [PermissionsBitField.Flags.MoveMembers],
  botPerms: [PermissionsBitField.Flags.MoveMembers],
  async execute(client, message, args) {
    const target = message.mentions.members.first();
    if (!target)
      return message
        .reply({
          embeds: [
            client.embedBuilder.error(client, message.t("commands.dog.mention_user")),
          ],
        })
        .catch(() => {});
    if (target.id === message.author.id)
      return message
        .reply({
          embeds: [client.embedBuilder.error(client, message.t("commands.dog.invalid_target"))],
        })
        .catch(() => {});

    // Vérifier si déjà dog
    if (client.dogMap.has(target.id)) {
      return message
        .reply({
          embeds: [
            client.embedBuilder.error(
              client,
              message.t("commands.dog.already_followed", { user: target.user.username }),
            ),
          ],
        })
        .catch(() => {});
    }

    // Stocker : target -> { master: l'auteur }
    client.dogMap.set(target.id, {
      masterId: message.author.id,
      guildId: message.guild.id,
    });
    client.db.addDogState(target.id, message.guild.id, message.author.id);

    // Si le master est en vocal, déplacer le target immédiatement
    if (message.member.voice.channel && target.voice.channel) {
      target.voice.setChannel(message.member.voice.channel).catch(() => {});
    }

    message
      .reply({
        embeds: [
          client.embedBuilder.success(
            client,
            message.t("commands.dog.now_following", { user: target.user.username }),
          ),
        ],
      })
      .catch(() => {});
  },
};
