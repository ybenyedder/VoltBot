const permissions = require("../../utils/permissions");

module.exports = {
  name: "setavatar",
  aliases: ["setpp", "botavatar", "setbotavatar"],
  description: "Change la photo de profil du bot (réservé aux Bot Owners).",
  category: "admin",
  usage: "+setavatar [lien/image jointe]",
  ownerOnly: true,
  async execute(client, message, args) {
    if (!permissions.isBotOwner(client, message.author.id)) {
      return message
        .reply({
          embeds: [
            client.embedBuilder.error(
              client,
              message.t("commands.setavatar.no_perm"),
            ),
          ],
        })
        .catch(() => {});
    }

    let imageUrl = null;

    if (message.attachments.size > 0) {
      const attachment = message.attachments.first();
      if (attachment.contentType?.startsWith("image/")) {
        imageUrl = attachment.url;
      } else {
        return message
          .reply({
            embeds: [
              client.embedBuilder.error(
                client,
                message.t("commands.setavatar.unsupported_file"),
              ),
            ],
          })
          .catch(() => {});
      }
    } else if (args[0]) {
      if (
        args[0].match(/^https?:\/\/.+\.(png|jpg|jpeg|gif|webp)(\?.*)?$/i) ||
        args[0].startsWith("https://")
      ) {
        imageUrl = args[0];
      } else {
        return message
          .reply({
            embeds: [
              client.embedBuilder.error(
                client,
                message.t("commands.setavatar.invalid_link"),
              ),
            ],
          })
          .catch(() => {});
      }
    } else {
      return message
        .reply({
          embeds: [
            client.embedBuilder.error(
              client,
              message.t("commands.setavatar.missing_image"),
            ),
          ],
        })
        .catch(() => {});
    }

    try {
      await client.user.setAvatar(imageUrl);
      const embed = client.embedBuilder
        .success(client, message.t("commands.setavatar.updated"))
        .addFields(
          { name: message.t("commands.setavatar.field_action"), value: "`avatar`", inline: true },
          {
            name: message.t("commands.setavatar.field_value"),
            value: message.t("commands.setavatar.link", { url: imageUrl }),
            inline: true,
          },
          {
            name: message.t("commands.setavatar.field_moderator"),
            value: `<@${message.author.id}>`,
            inline: true,
          },
        )
        .setImage(imageUrl);
      return message.reply({ embeds: [embed] }).catch(() => {});
    } catch (err) {
      if (err.code === 50035) {
        return message
          .reply({
            embeds: [
              client.embedBuilder.error(
                client,
                message.t("commands.setavatar.image_too_large"),
              ),
            ],
          })
          .catch(() => {});
      }
      if (err.message?.includes("rate limit") || err.code === 429) {
        return message
          .reply({
            embeds: [
              client.embedBuilder.error(
                client,
                message.t("commands.setavatar.rate_limit"),
              ),
            ],
          })
          .catch(() => {});
      }
      return message
        .reply({
          embeds: [
            client.embedBuilder.error(client, message.t("commands.setavatar.api_error")),
          ],
        })
        .catch(() => {});
    }
  },
};
