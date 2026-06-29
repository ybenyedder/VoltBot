const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");

module.exports = {
  name: "quiz",
  aliases: ["trivia"],
  description: "Pose une question de culture générale.",
  category: "fun",
  usage: "quiz",
  async execute(client, message, args) {
    const questions = [
      {
        q: message.t("commands.quiz.q1"),
        a: message.t("commands.quiz.q1_a"),
        choices: [
          message.t("commands.quiz.q1_c1"),
          message.t("commands.quiz.q1_c2"),
          message.t("commands.quiz.q1_c3"),
          message.t("commands.quiz.q1_c4"),
        ],
      },
      {
        q: message.t("commands.quiz.q2"),
        a: message.t("commands.quiz.q2_a"),
        choices: [
          message.t("commands.quiz.q2_c1"),
          message.t("commands.quiz.q2_c2"),
          message.t("commands.quiz.q2_c3"),
          message.t("commands.quiz.q2_c4"),
        ],
      },
      {
        q: message.t("commands.quiz.q3"),
        a: message.t("commands.quiz.q3_a"),
        choices: [
          message.t("commands.quiz.q3_c1"),
          message.t("commands.quiz.q3_c2"),
          message.t("commands.quiz.q3_c3"),
          message.t("commands.quiz.q3_c4"),
        ],
      },
      {
        q: message.t("commands.quiz.q4"),
        a: message.t("commands.quiz.q4_a"),
        choices: [
          message.t("commands.quiz.q4_c1"),
          message.t("commands.quiz.q4_c2"),
          message.t("commands.quiz.q4_c3"),
          message.t("commands.quiz.q4_c4"),
        ],
      },
      {
        q: message.t("commands.quiz.q5"),
        a: message.t("commands.quiz.q5_a"),
        choices: [
          message.t("commands.quiz.q5_c1"),
          message.t("commands.quiz.q5_c2"),
          message.t("commands.quiz.q5_c3"),
          message.t("commands.quiz.q5_c4"),
        ],
      },
    ];

    const qa = questions[Math.floor(Math.random() * questions.length)];
    const letters = ["A", "B", "C", "D"];
    const correctIdx = qa.choices.findIndex(
      (c) => c.toLowerCase() === qa.a.toLowerCase(),
    );

    const optionsBlock = qa.choices
      .map((c, i) => `${letters[i]} · ${c}`)
      .join("\n");

    const buildQuestionEmbed = () =>
      client.embedBuilder
        .base(client, message.t("commands.quiz.title"), qa.q)
        .addFields({ name: message.t("commands.quiz.field_options"), value: optionsBlock, inline: false });

    const buildResultEmbed = (picked, timedOut = false) => {
      const correctLine = `${letters[correctIdx]} · ${qa.choices[correctIdx]}`;
      const score = picked === correctIdx ? "1 / 1" : "0 / 1";
      let embed;
      if (timedOut) {
        embed = client.embedBuilder.error(client, message.t("commands.quiz.timeout"));
      } else if (picked === correctIdx) {
        embed = client.embedBuilder.success(client, message.t("commands.quiz.correct_answer"));
      } else {
        embed = client.embedBuilder.error(client, message.t("commands.quiz.wrong_answer"));
      }
      embed.addFields(
        { name: message.t("commands.quiz.field_correct"), value: correctLine, inline: true },
        { name: message.t("commands.quiz.field_score"), value: score, inline: true },
      );
      return embed;
    };

    const buildButtons = (disabled = false) => {
      const row = new ActionRowBuilder();
      qa.choices.forEach((_, i) => {
        row.addComponents(
          new ButtonBuilder()
            .setCustomId(`quiz_${i}`)
            .setLabel(letters[i])
            .setStyle(ButtonStyle.Primary)
            .setDisabled(disabled),
        );
      });
      return [row];
    };

    const msg = await message
      .reply({ embeds: [buildQuestionEmbed()], components: buildButtons() })
      .catch(() => null);
    if (!msg) return;

    const filter = (i) =>
      i.user.id === message.author.id && i.customId.startsWith("quiz_");
    const collector = msg.createMessageComponentCollector({
      filter,
      time: 15000,
      max: 1,
    });

    collector.on("collect", async (interaction) => {
      const picked = parseInt(interaction.customId.split("_")[1]);
      await interaction
        .update({
          embeds: [buildResultEmbed(picked)],
          components: buildButtons(true),
        })
        .catch(() => {});
    });

    collector.on("end", (collected) => {
      if (collected.size === 0) {
        msg
          .edit({
            embeds: [buildResultEmbed(-1, true)],
            components: buildButtons(true),
          })
          .catch(() => {});
      }
    });
  },
};
