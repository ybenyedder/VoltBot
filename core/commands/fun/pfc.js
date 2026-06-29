const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");

module.exports = {
  name: "pfc",
  description: "Joue à Pierre-Feuille-Ciseaux contre le bot.",
  category: "fun",
  usage: "+pfc",
  async execute(client, message, args) {
    const choices = ["pierre", "feuille", "ciseaux"];
    const labels = {
      pierre: message.t("commands.pfc.label_pierre"),
      feuille: message.t("commands.pfc.label_feuille"),
      ciseaux: message.t("commands.pfc.label_ciseaux"),
    };

    const buildButtons = (disabled = false) => {
      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("pfc_pierre")
          .setLabel(message.t("commands.pfc.label_pierre"))
          .setStyle(ButtonStyle.Primary)
          .setDisabled(disabled),
        new ButtonBuilder()
          .setCustomId("pfc_feuille")
          .setLabel(message.t("commands.pfc.label_feuille"))
          .setStyle(ButtonStyle.Primary)
          .setDisabled(disabled),
        new ButtonBuilder()
          .setCustomId("pfc_ciseaux")
          .setLabel(message.t("commands.pfc.label_ciseaux"))
          .setStyle(ButtonStyle.Primary)
          .setDisabled(disabled),
      );
      return [row];
    };

    const intro = client.embedBuilder.base(
      client,
      message.t("commands.pfc.title"),
      message.t("commands.pfc.choose", { user: `<@${message.author.id}>` }),
    );
    const msg = await message
      .reply({ embeds: [intro], components: buildButtons() })
      .catch(() => null);
    if (!msg) return;

    const filter = (i) =>
      i.user.id === message.author.id && i.customId.startsWith("pfc_");
    const collector = msg.createMessageComponentCollector({
      filter,
      time: 30000,
      max: 1,
    });

    collector.on("collect", async (interaction) => {
      const userChoice = interaction.customId.split("_")[1];
      const botChoice = choices[Math.floor(Math.random() * choices.length)];

      let helper;
      let issue;
      if (userChoice === botChoice) {
        helper = client.embedBuilder.warning;
        issue = message.t("commands.pfc.tie");
      } else if (
        (userChoice === "pierre" && botChoice === "ciseaux") ||
        (userChoice === "feuille" && botChoice === "pierre") ||
        (userChoice === "ciseaux" && botChoice === "feuille")
      ) {
        helper = client.embedBuilder.success;
        issue = message.t("commands.pfc.win");
      } else {
        helper = client.embedBuilder.error;
        issue = message.t("commands.pfc.lose");
      }

      const resultEmbed = helper(client, message.t("commands.pfc.title")).addFields(
        { name: message.t("commands.pfc.field_player"), value: labels[userChoice], inline: true },
        { name: message.t("commands.pfc.field_bot"), value: labels[botChoice], inline: true },
        { name: message.t("commands.pfc.field_issue"), value: `**${issue}**`, inline: true },
      );

      await interaction
        .update({ embeds: [resultEmbed], components: buildButtons(true) })
        .catch(() => {});
    });

    collector.on("end", (collected) => {
      if (collected.size === 0) {
        msg
          .edit({
            embeds: [client.embedBuilder.warning(client, message.t("commands.pfc.timeout"))],
            components: buildButtons(true),
          })
          .catch(() => {});
      }
    });
  },
};
