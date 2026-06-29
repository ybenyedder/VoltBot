const { PermissionsBitField } = require("discord.js");

module.exports = {
  name: "steal",
  aliases: ["addemoji"],
  description: "Vole un emoji et l'ajoute au serveur.",
  category: "utility",
  usage: "+steal <emoji> [nom]",
  userPerms: [PermissionsBitField.Flags.ManageGuildExpressions],
  async execute(client, message, args) {
    if (!args[0])
      return message
        .reply({
          embeds: [
            client.embedBuilder.warning(
              client,
              message.t("commands.steal.emoji_required"),
            ),
          ],
        })
        .catch(() => {});

    const emojiRegex = /<(a?):(\w+):(\d+)>/;
    const match = args[0].match(emojiRegex);

    if (!match)
      return message
        .reply({
          embeds: [
            client.embedBuilder.warning(
              client,
              message.t("commands.steal.emoji_invalid"),
            ),
          ],
        })
        .catch(() => {});

    const animated = match[1] === "a";
    const emojiName = args[1] || match[2];
    const emojiId = match[3];
    const url = `https://cdn.discordapp.com/emojis/${emojiId}.${animated ? "gif" : "png"}`;

    try {
      const emoji = await message.guild.emojis.create({
        attachment: url,
        name: emojiName,
      });
      await message
        .reply({
          embeds: [
            client.embedBuilder.success(
              client,
              message.t("commands.steal.added", { emoji, name: emojiName }),
            ),
          ],
        })
        .catch(() => {});
    } catch (err) {
      await message
        .reply({
          embeds: [
            client.embedBuilder.error(
              client,
              message.t("commands.steal.add_failed"),
            ),
          ],
        })
        .catch(() => {});
    }
  },
};
