module.exports = {
  name: "work",
  aliases: ["job", "travailler"],
  description: "Travaille pour gagner un peu d'argent.",
  category: "economy",
  usage: "work",
  cooldown: 3600,
  async execute(client, message, args) {
    const config = client.db.getGuild(message.guild.id);
    const min = config.minWork || 50;
    const max = config.maxWork || 200;
    const fmt = new Intl.NumberFormat("fr-FR");

    const jobs = [
      message.t("commands.work.job_programmer"),
      message.t("commands.work.job_delivery"),
      message.t("commands.work.job_youtuber"),
      message.t("commands.work.job_streamer"),
      message.t("commands.work.job_carpet_seller"),
      message.t("commands.work.job_garbage"),
      message.t("commands.work.job_teacher"),
      message.t("commands.work.job_astronaut"),
      message.t("commands.work.job_cook"),
    ];
    const randomJob = jobs[Math.floor(Math.random() * jobs.length)];
    const earnings = Math.floor(Math.random() * (max - min + 1)) + min;

    client.db.addCoins(message.author.id, message.guild.id, earnings);
    const updated = client.db.getUser(message.author.id, message.guild.id);

    const embed = client.embedBuilder
      .success(client, "")
      .setDescription(null)
      .addFields(
        { name: message.t("commands.work.field_job"), value: `\`${randomJob}\``, inline: true },
        {
          name: message.t("commands.work.field_earnings"),
          value: `\`\`\`prolog\n${fmt.format(earnings)}\n\`\`\``,
          inline: true,
        },
        {
          name: message.t("commands.work.field_balance"),
          value: `\`\`\`prolog\n${fmt.format(updated.coins || 0)}\n\`\`\``,
          inline: true,
        },
      );
    await message.reply({ embeds: [embed] }).catch(() => {});
  },
};
