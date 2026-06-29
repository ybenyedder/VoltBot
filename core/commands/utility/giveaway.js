const {
  PermissionsBitField,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require("discord.js");
const ms = require("ms");
const giveawayUtils = require("../../utils/giveaways");

module.exports = {
  name: "giveaway",
  aliases: ["gw"],
  description: "Lance un giveaway.",
  category: "utility",
  usage: "+giveaway [duree] [gagnants] [prix]",
  userPerms: [PermissionsBitField.Flags.ManageMessages],
  async execute(client, message, args) {
    if (args.length >= 3) {
      const duration = ms(args[0]);
      const winnersCount = parseInt(args[1], 10) || 1;
      const prize = args.slice(2).join(" ").trim();

      if (!duration || duration < 10000) {
        return message
          .reply({
            embeds: [
              client.embedBuilder.error(
                client,
                message.t("commands.giveaway.invalid_duration"),
              ),
            ],
          })
          .catch(() => {});
      }

      if (!prize) {
        return message
          .reply({
            embeds: [
              client.embedBuilder.error(
                client,
                message.t("commands.giveaway.provide_prize"),
              ),
            ],
          })
          .catch(() => {});
      }

      const created = await giveawayUtils.createGiveaway(client, {
        channel: message.channel,
        guild: message.guild,
        prize,
        winnersCount,
        durationMs: duration,
        hostId: message.author.id,
      });

      await message
        .reply({
          embeds: [
            client.embedBuilder.success(
              client,
              message.t("commands.giveaway.created", { url: created.message.url }),
            ),
          ],
        })
        .catch(() => {});
      return;
    }

    const openBtn = new ButtonBuilder()
      .setCustomId(`open_giveaway_modal_${message.author.id}`)
      .setLabel(message.t("commands.giveaway.btn_configure"))
      .setStyle(ButtonStyle.Primary);

    const row = new ActionRowBuilder().addComponents(openBtn);
    const embed = client.embedBuilder
      .base(client, message.t("commands.giveaway.create_title"))
      .setDescription(message.t("commands.giveaway.create_desc"));

    await message.reply({ embeds: [embed], components: [row] }).catch(() => {});
  },
};
