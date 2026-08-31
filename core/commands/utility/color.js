const { AttachmentBuilder } = require("discord.js");
const Canvas = require("@napi-rs/canvas");

module.exports = {
  name: "color",
  aliases: ["hex"],
  description: "Affiche un aperçu de la couleur hexadécimale spécifiée.",
  category: "utility",
  usage: "+color [#hexCode]",
  async execute(client, message, args) {
    const hex =
      args[0] && /^#?([0-9A-F]{3}){1,2}$/i.test(args[0]) ? args[0] : null;

    if (!hex) {
      return message
        .reply({
          embeds: [
            client.embedBuilder.warning(
              client,
              message.t("commands.color.invalid_hex"),
            ),
          ],
        })
        .catch(() => {});
    }

    const formattedHex = (hex.startsWith("#") ? hex : `#${hex}`).toUpperCase();

    const canvas = Canvas.createCanvas(200, 200);
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = formattedHex;
    ctx.fillRect(0, 0, 200, 200);

    const attachment = new AttachmentBuilder(canvas.toBuffer('image/png'), {
      name: "color.png",
    });

    const int = parseInt(formattedHex.slice(1), 16);
    const r = (int >> 16) & 255;
    const g = (int >> 8) & 255;
    const b = int & 255;

    const embed = client.embedBuilder
      .base(client, formattedHex)
      .setImage("attachment://color.png")
      .addFields(
        { name: "Hex", value: `\`${formattedHex}\``, inline: true },
        { name: "RGB", value: `\`${r}, ${g}, ${b}\``, inline: true },
        { name: "Int", value: `\`${int}\``, inline: true },
      );

    await message
      .reply({ embeds: [embed], files: [attachment] })
      .catch(() => {});
  },
};
