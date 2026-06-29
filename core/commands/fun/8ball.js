module.exports = {
  name: "8ball",
  aliases: ["ask", "question"],
  description: "Pose une question à la boule magique.",
  category: "fun",
  usage: "+8ball [question]",
  async execute(client, message, args) {
    if (args.length === 0)
      return message
        .reply({
          embeds: [client.embedBuilder.error(client, message.t("commands.8ball.no_question"))],
        })
        .catch(() => {});

    const answers = [
      message.t("commands.8ball.answer_try_later"),
      message.t("commands.8ball.answer_try_again"),
      message.t("commands.8ball.answer_no_opinion"),
      message.t("commands.8ball.answer_destiny"),
      message.t("commands.8ball.answer_die_cast"),
      message.t("commands.8ball.answer_fifty_fifty"),
      message.t("commands.8ball.answer_maybe"),
      message.t("commands.8ball.answer_i_think_yes"),
      message.t("commands.8ball.answer_certain"),
      message.t("commands.8ball.answer_absolutely_yes"),
      message.t("commands.8ball.answer_count_on_it"),
      message.t("commands.8ball.answer_no_doubt"),
      message.t("commands.8ball.answer_very_likely"),
      message.t("commands.8ball.answer_yes"),
      message.t("commands.8ball.answer_looking_good"),
      message.t("commands.8ball.answer_no"),
      message.t("commands.8ball.answer_unlikely"),
      message.t("commands.8ball.answer_dont_dream"),
      message.t("commands.8ball.answer_dont_count_on_it"),
      message.t("commands.8ball.answer_impossible"),
    ];

    const result = answers[Math.floor(Math.random() * answers.length)];
    const question = args.join(" ");

    const embed = client.embedBuilder
      .base(client, message.t("commands.8ball.title"), null)
      .addFields(
        { name: message.t("commands.8ball.field_question"), value: question, inline: false },
        { name: message.t("commands.8ball.field_answer"), value: `**${result}**`, inline: false },
      );

    await message.reply({ embeds: [embed] }).catch(() => {});
  },
};
