const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  MessageFlags,
} = require("discord.js");

module.exports = {
  name: "tictactoe",
  aliases: ["morpion", "ttt"],
  description: "Joue au morpion contre un autre joueur.",
  category: "fun",
  usage: "+tictactoe @user",
  async execute(client, message, args) {
    const opponent = message.mentions.members.first();
    if (!opponent)
      return message
        .reply({
          embeds: [
            client.embedBuilder.error(
              client,
              "Cible introuvable. Mentionne un membre.",
            ),
          ],
        })
        .catch(() => {});
    if (opponent.id === message.author.id)
      return message
        .reply({
          embeds: [client.embedBuilder.error(client, "Adversaire invalide.")],
        })
        .catch(() => {});
    if (opponent.user.bot)
      return message
        .reply({
          embeds: [
            client.embedBuilder.error(client, "Pas de partie contre un bot."),
          ],
        })
        .catch(() => {});

    const board = [
      ["", "", ""],
      ["", "", ""],
      ["", "", ""],
    ];

    const player1 = message.author.id;
    const player2 = opponent.id;
    let currentPlayer = player1;

    const renderBoard = () => {
      const rows = board.map((row) =>
        row.map((c) => (c === "" ? "." : c)).join(" "),
      );
      return "```\n" + rows.map((r) => ` ${r}`).join("\n") + "\n```";
    };

    const generateButtons = () => {
      const rows = [];
      for (let i = 0; i < 3; i++) {
        const row = new ActionRowBuilder();
        for (let j = 0; j < 3; j++) {
          let style = ButtonStyle.Secondary;
          let label = "​";
          if (board[i][j] === "X") {
            style = ButtonStyle.Primary;
            label = "X";
          }
          if (board[i][j] === "O") {
            style = ButtonStyle.Danger;
            label = "O";
          }

          row.addComponents(
            new ButtonBuilder()
              .setCustomId(`ttt_${i}_${j}`)
              .setLabel(label)
              .setStyle(style)
              .setDisabled(board[i][j] !== ""),
          );
        }
        rows.push(row);
      }
      return rows;
    };

    const checkWin = (b, char) => {
      for (let i = 0; i < 3; i++) {
        if (b[i][0] === char && b[i][1] === char && b[i][2] === char)
          return true;
        if (b[0][i] === char && b[1][i] === char && b[2][i] === char)
          return true;
      }
      if (b[0][0] === char && b[1][1] === char && b[2][2] === char) return true;
      if (b[0][2] === char && b[1][1] === char && b[2][0] === char) return true;
      return false;
    };

    const checkTie = (b) => b.flat().every((cell) => cell !== "");

    const buildTurnEmbed = () => {
      const char = currentPlayer === player1 ? "X" : "O";
      return client.embedBuilder
        .base(client, "Morpion", renderBoard())
        .addFields(
          { name: "Tour", value: `**${char}**`, inline: true },
          { name: "Joueur", value: `<@${currentPlayer}>`, inline: true },
        );
    };

    const buildEndEmbed = (helper, label, winnerId = null) => {
      const embed = helper(client, "Morpion").addFields({
        name: "Plateau",
        value: renderBoard(),
        inline: false,
      });
      if (winnerId)
        embed.addFields({
          name: "Vainqueur",
          value: `<@${winnerId}>`,
          inline: true,
        });
      embed.addFields({ name: "Issue", value: `**${label}**`, inline: true });
      return embed;
    };

    const msg = await message
      .reply({
        content: `<@${player1}> vs <@${player2}>`,
        embeds: [buildTurnEmbed()],
        components: generateButtons(),
        allowedMentions: { users: [player1, player2] },
      })
      .catch(() => null);
    if (!msg) return;

    const collector = msg.createMessageComponentCollector({ time: 120000 });

    collector.on("collect", async (interaction) => {
      if (interaction.user.id !== currentPlayer) {
        return interaction
          .reply({
            content: "Ce n'est pas ton tour.",
            flags: [MessageFlags.Ephemeral],
          })
          .catch(() => {});
      }

      const [, r, c] = interaction.customId.split("_");
      const char = currentPlayer === player1 ? "X" : "O";
      board[parseInt(r)][parseInt(c)] = char;

      if (checkWin(board, char)) {
        collector.stop("done");
        const rows = generateButtons();
        rows.forEach((row) =>
          row.components.forEach((btn) => btn.setDisabled(true)),
        );
        return interaction
          .update({
            embeds: [
              buildEndEmbed(
                client.embedBuilder.success,
                "Victoire.",
                currentPlayer,
              ),
            ],
            components: rows,
          })
          .catch(() => {});
      }

      if (checkTie(board)) {
        collector.stop("done");
        const rows = generateButtons();
        rows.forEach((row) =>
          row.components.forEach((btn) => btn.setDisabled(true)),
        );
        return interaction
          .update({
            embeds: [buildEndEmbed(client.embedBuilder.warning, "Match nul.")],
            components: rows,
          })
          .catch(() => {});
      }

      currentPlayer = currentPlayer === player1 ? player2 : player1;

      await interaction
        .update({
          embeds: [buildTurnEmbed()],
          components: generateButtons(),
        })
        .catch(() => {});
      collector.resetTimer();
    });

    collector.on("end", (collected, reason) => {
      if (reason === "time") {
        msg
          .edit({
            embeds: [client.embedBuilder.warning(client, message.t("commands.tictactoe.timeout"))],
            components: [],
          })
          .catch(() => {});
      }
    });
  },
};
