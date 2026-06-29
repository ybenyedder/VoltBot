const permissions = require("../../utils/permissions");

module.exports = {
  name: "setbotbanner",
  aliases: ["botbanner"],
  description: "Change la banniere du bot (necessite Nitro ou bot verifie).",
  category: "admin",
  usage: "+setbotbanner [lien/image jointe]",
  ownerOnly: true,
  async execute(client, message, args) {
    if (!permissions.isBotOwner(client, message.author.id)) {
      return message
        .reply({
          embeds: [
            client.embedBuilder.error(
              client,
              message.t("commands.setbanner.no_perm"),
            ),
          ],
        })
        .catch(() => {});
    }

    let imageUrl = null;
    const subAction = args[0]?.toLowerCase();
    const isRemoveAction =
      (subAction === "remove" || subAction === "clear") &&
      message.attachments.size === 0;

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
                message.t("commands.setbanner.unsupported_file"),
              ),
            ],
          })
          .catch(() => {});
      }
    } else if (isRemoveAction) {
      imageUrl = null;
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
                message.t("commands.setbanner.invalid_link"),
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
              message.t("commands.setbanner.missing_image"),
            ),
          ],
        })
        .catch(() => {});
    }

    try {
      await client.user.setBanner(imageUrl);
      const embed = client.embedBuilder
        .success(
          client,
          imageUrl
            ? message.t("commands.setbanner.updated")
            : message.t("commands.setbanner.removed"),
        )
        .addFields(
          { name: message.t("commands.setbanner.field_action"), value: "`banner`", inline: true },
          {
            name: message.t("commands.setbanner.field_value"),
            value: imageUrl
              ? message.t("commands.setbanner.link", { url: imageUrl })
              : "`null`",
            inline: true,
          },
          {
            name: message.t("commands.setbanner.field_moderator"),
            value: `<@${message.author.id}>`,
            inline: true,
          },
        );
      if (imageUrl) embed.setImage(imageUrl);
      return message.reply({ embeds: [embed] }).catch(() => {});
    } catch (err) {
      if (err.code === 50035 || err.message?.includes("banner")) {
        return message
          .reply({
            embeds: [
              client.embedBuilder.error(
                client,
                message.t("commands.setbanner.not_verified"),
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
                message.t("commands.setbanner.rate_limit"),
              ),
            ],
          })
          .catch(() => {});
      }
      return message
        .reply({
          embeds: [
            client.embedBuilder.error(client, message.t("commands.setbanner.api_error")),
          ],
        })
        .catch(() => {});
    }
  },
};
