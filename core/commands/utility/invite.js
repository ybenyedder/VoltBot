const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  OAuth2Scopes,
  PermissionsBitField,
} = require("discord.js");

module.exports = {
  name: "invite",
  description: "Génère un lien pour inviter le bot sur votre serveur.",
  category: "utility",
  usage: "invite",
  async execute(client, message, args) {
    const inviteLink = client.generateInvite({
      scopes: [OAuth2Scopes.Bot, OAuth2Scopes.ApplicationsCommands],
      permissions: [PermissionsBitField.Flags.Administrator],
    });

    const embed = client.embedBuilder
      .base(client, client.user.username)
      .setAuthor({
        name: client.user.username,
        iconURL: client.user.displayAvatarURL({ size: 64 }),
      })
      .setThumbnail(client.user.displayAvatarURL({ size: 256 }))
      .addFields(
        { name: "ID", value: `\`${client.user.id}\``, inline: true },
        { name: message.t("commands.invite.permissions"), value: `\`${message.t("commands.invite.administrator")}\``, inline: true },
        { name: message.t("commands.invite.link"), value: `[${message.t("commands.invite.invite_btn")}](${inviteLink})`, inline: false },
      );

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setLabel(message.t("commands.invite.invite_btn"))
        .setStyle(ButtonStyle.Link)
        .setURL(inviteLink),
    );

    await message.reply({ embeds: [embed], components: [row] }).catch(() => {});
  },
};
