const { EmbedBuilder } = require("discord.js");
const axios = require("axios");

module.exports = {
  name: "translate",
  aliases: ["tr", "traduis"],
  description: "Traduit un texte.",
  category: "utility",
  usage: "+translate [langue cible (ex: fr, en, es)] [texte]",
  async execute(client, message, args) {
    const targetLang = args[0];
    const textToTranslate = args.slice(1).join(" ");

    if (!targetLang || !textToTranslate) {
      return message
        .reply({
          embeds: [
            client.embedBuilder.warning(
              client,
              message.t("commands.translate.lang_text_required"),
            ),
          ],
        })
        .catch(() => {});
    }

    try {
      const res = await axios.get(
        `https://api.popcat.xyz/translate?to=${encodeURIComponent(targetLang)}&text=${encodeURIComponent(textToTranslate)}`,
      );

      if (res.data && res.data.translated) {
        const truncate = (s) => (s.length > 1000 ? s.slice(0, 997) + "..." : s);
        const embed = new EmbedBuilder()
          .setColor(client.embedBuilder.getTheme(client))
          .setAuthor({
            name: message.t("commands.translate.embed_author"),
            iconURL: client.user.displayAvatarURL({ size: 256 }),
          })
          .addFields(
            {
              name: message.t("commands.translate.field_source"),
              value: `\`${targetLang.toLowerCase() === "fr" ? "auto" : "auto"}\``,
              inline: true,
            },
            { name: message.t("commands.translate.field_target"), value: `\`${targetLang}\``, inline: true },
            {
              name: message.t("commands.translate.field_text"),
              value: `\`\`\`\n${truncate(res.data.translated)}\n\`\`\``,
              inline: false,
            },
          )
          .setTimestamp()
          .setFooter({
            text: message.t("commands.translate.footer"),
            iconURL: client.user.displayAvatarURL(),
          });
        await message.reply({ embeds: [embed] }).catch(() => {});
      } else {
        message
          .reply({
            embeds: [
              client.embedBuilder.error(
                client,
                message.t("commands.translate.failed"),
              ),
            ],
          })
          .catch(() => {});
      }
    } catch (e) {
      message
        .reply({
          embeds: [
            client.embedBuilder.error(
              client,
              message.t("commands.translate.failed"),
            ),
          ],
        })
        .catch(() => {});
    }
  },
};
