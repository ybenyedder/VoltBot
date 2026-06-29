const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  MessageFlags,
} = require("discord.js");

module.exports = {
  name: "pendu",
  aliases: ["hangman"],
  description: "Joue au jeu du pendu.",
  category: "fun",
  usage: "pendu",
  async execute(client, message, args) {
    const mots = [
      "DISCORD",
      "BOT",
      "JAVASCRIPT",
      "PROGRAMMATION",
      "ORDINATEUR",
      "CLAVIER",
      "INTERNET",
      "DEVELOPPEUR",
      "RESEAU",
      "SERVEUR",
    ];
    const motATrouver = mots[Math.floor(Math.random() * mots.length)];
    const lettresTrouvees = new Set();
    const lettresRatees = [];
    const lettresEssayees = [];
    let erreurs = 0;
    const maxErreurs = 6;
    let partieTerminee = false;

    const renderMot = () =>
      "```\n" +
      motATrouver
        .split("")
        .map((l) => (lettresTrouvees.has(l) ? l : "_"))
        .join(" ") +
      "\n```";

    const buildButtons = (disabled = false) => {
      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("pendu_guess")
          .setLabel(message.t("commands.pendu.btn_guess"))
          .setStyle(ButtonStyle.Primary)
          .setDisabled(disabled),
        new ButtonBuilder()
          .setCustomId("pendu_quit")
          .setLabel(message.t("commands.pendu.btn_quit"))
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(disabled),
      );
      return [row];
    };

    const buildEmbed = () => {
      const embed = client.embedBuilder
        .base(client, message.t("commands.pendu.title"), renderMot())
        .addFields(
          {
            name: message.t("commands.pendu.tried_letters"),
            value: lettresEssayees.length ? lettresEssayees.join(" ") : "—",
            inline: false,
          },
          {
            name: message.t("commands.pendu.errors"),
            value: `**${erreurs}** / ${maxErreurs}`,
            inline: true,
          },
          {
            name: message.t("commands.pendu.remaining"),
            value: `**${maxErreurs - erreurs}**`,
            inline: true,
          },
        );
      return embed;
    };

    const buildResultEmbed = (gagne) => {
      const helper = gagne
        ? client.embedBuilder.success
        : client.embedBuilder.error;
      const issue = gagne
        ? message.t("commands.pendu.won")
        : message.t("commands.pendu.lost");
      return helper(client, message.t("commands.pendu.title")).addFields(
        { name: message.t("commands.pendu.word"), value: `**${motATrouver}**`, inline: false },
        {
          name: message.t("commands.pendu.errors"),
          value: `**${erreurs}** / ${maxErreurs}`,
          inline: true,
        },
        { name: message.t("commands.pendu.outcome"), value: `**${issue}**`, inline: true },
      );
    };

    const msg = await message
      .reply({ embeds: [buildEmbed()], components: buildButtons() })
      .catch(() => null);
    if (!msg) return;

    const filter = (i) =>
      i.user.id === message.author.id && i.customId.startsWith("pendu_");
    const collector = msg.createMessageComponentCollector({
      filter,
      time: 120000,
    });

    collector.on("collect", async (interaction) => {
      if (interaction.customId === "pendu_quit") {
        partieTerminee = true;
        collector.stop("quit");
        return interaction
          .update({ embeds: [buildResultEmbed(false)], components: [] })
          .catch(() => {});
      }

      const modal = new ModalBuilder()
        .setCustomId(`pendu_modal_${interaction.id}`)
        .setTitle(message.t("commands.pendu.title"))
        .addComponents(
          new ActionRowBuilder().addComponents(
            new TextInputBuilder()
              .setCustomId("lettre")
              .setLabel(message.t("commands.pendu.input_letter"))
              .setStyle(TextInputStyle.Short)
              .setMinLength(1)
              .setMaxLength(1)
              .setRequired(true)
              .setPlaceholder("A"),
          ),
        );
      await interaction.showModal(modal).catch(() => {});

      let submitted;
      try {
        submitted = await interaction.awaitModalSubmit({
          filter: (i) =>
            i.customId === `pendu_modal_${interaction.id}` &&
            i.user.id === message.author.id,
          time: 60000,
        });
      } catch (e) {
        return;
      }

      const raw = submitted.fields.getTextInputValue("lettre").trim();
      const lettre = raw.toUpperCase();
      if (!/^[A-Z]$/.test(lettre)) {
        return submitted
          .reply({
            embeds: [client.embedBuilder.error(client, message.t("commands.pendu.invalid_letter"))],
            flags: [MessageFlags.Ephemeral],
          })
          .catch(() => {});
      }

      if (lettresTrouvees.has(lettre) || lettresRatees.includes(lettre)) {
        return submitted
          .reply({
            embeds: [
              client.embedBuilder.warning(client, message.t("commands.pendu.letter_already_tried")),
            ],
            flags: [MessageFlags.Ephemeral],
          })
          .catch(() => {});
      }

      lettresEssayees.push(lettre);
      if (motATrouver.includes(lettre)) {
        lettresTrouvees.add(lettre);
      } else {
        lettresRatees.push(lettre);
        erreurs++;
      }

      const gagne = motATrouver.split("").every((l) => lettresTrouvees.has(l));

      if (gagne || erreurs >= maxErreurs) {
        partieTerminee = true;
        collector.stop("done");
        return submitted
          .update({ embeds: [buildResultEmbed(gagne)], components: [] })
          .catch(() => {});
      }

      await submitted
        .update({ embeds: [buildEmbed()], components: buildButtons() })
        .catch(() => {});
      collector.resetTimer();
    });

    collector.on("end", (collected, reason) => {
      if (reason === "time" && !partieTerminee) {
        partieTerminee = true;
        msg
          .edit({
            embeds: [client.embedBuilder.warning(client, message.t("commands.pendu.time_up"))],
            components: buildButtons(true),
          })
          .catch(() => {});
      }
    });
  },
};
