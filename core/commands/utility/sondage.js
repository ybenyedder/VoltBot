const {
  PermissionsBitField,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require("discord.js");
const { sendEphemeralReply } = require("../../utils/ephemeralReply");

module.exports = {
  name: "sondage",
  aliases: ["poll", "vote"],
  description: "Crée un sondage interactif.",
  category: "utility",
  usage: "+sondage <question>",
  userPerms: [PermissionsBitField.Flags.ManageMessages],
  async execute(client, message, args) {
    const question = args.join(" ");
    if (!question) {
      return sendEphemeralReply(message, {
        embeds: [
          client.embedBuilder.warning(
            client,
            message.t("commands.sondage.question_required"),
          ),
        ],
        ephemeral: true,
      });
    }

    if (message.guild && message.deletable)
      await message.delete().catch(() => {});

    try {
      await message.channel.send({
        poll: {
          question: { text: question.substring(0, 300) },
          answers: [
            { text: message.t("commands.sondage.answer_for") },
            { text: message.t("commands.sondage.answer_against") },
            { text: message.t("commands.sondage.answer_undecided") },
          ],
          duration: 24,
          allowMultiselect: false,
        },
      });
    } catch (err) {
      const options = [
        message.t("commands.sondage.answer_for"),
        message.t("commands.sondage.answer_against"),
        message.t("commands.sondage.answer_undecided"),
      ];
      const embed = client.embedBuilder
        .premium(client, message.t("commands.sondage.title"), question.substring(0, 300))
        .addFields(
          ...options.map((o) => ({ name: o, value: "`0`", inline: true })),
        )
        .setFooter({
          text: message.author.tag,
          iconURL: message.author.displayAvatarURL(),
        });

      const row = new ActionRowBuilder().addComponents(
        ...options.map((o, i) =>
          new ButtonBuilder()
            .setCustomId(`sondage_vote_${i}`)
            .setLabel(o)
            .setStyle(ButtonStyle.Primary),
        ),
      );

      await message.channel
        .send({ embeds: [embed], components: [row] })
        .catch(() => null);
    }
  },
};
