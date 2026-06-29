const { EmbedBuilder } = require("discord.js");

module.exports = {
  name: "report",
  description: "Signale un utilisateur au staff",
  category: "moderation",
  usage: "report",
  async execute(client, message, args) {
    if (!args[0] || !args[1]) {
      return message
        .reply({
          embeds: [
            client.embedBuilder.error(
              client,
              message.t("commands.report.usage"),
            ),
          ],
        })
        .catch(() => {});
    }

    const user =
      message.mentions.users.first() || client.users.cache.get(args[0]);
    if (!user)
      return message
        .reply({
          embeds: [
            client.embedBuilder.error(
              client,
              message.t("commands.report.user_not_found"),
            ),
          ],
        })
        .catch(() => {});

    const reason = args.slice(1).join("");

    const reports = client.db.getGuild(message.guild.id, "reports") || [];
    const reportId = reports.length + 1;
    reports.push({
      id: reportId,
      reportedUserId: user.id,
      reportedUserTag: user.tag,
      reporterId: message.author.id,
      reporterTag: message.author.tag,
      reason: reason,
      date: new Date().toISOString(),
      status: "pending",
    });

    client.db.updateGuild(message.guild.id, { reports: reports });

    const guildSettings = client.db.getGuild(message.guild.id);
    const modChannel =
      (guildSettings.modLogsChannel &&
        message.guild.channels.cache.get(guildSettings.modLogsChannel)) ||
      message.guild.channels.cache.find(
        (c) => c.name.includes("mod") || c.name.includes("staff"),
      );

    const staffEmbed = new EmbedBuilder()
      .setColor("#FEE75C")
      .setAuthor({
        name: message.t("commands.report.new_report", { id: reportId }),
        iconURL: user.displayAvatarURL(),
      })
      .addFields(
        {
          name: message.t("commands.report.field_reported"),
          value: `${user.tag}\n\`${user.id}\``,
          inline: true,
        },
        {
          name: message.t("commands.report.field_reporter"),
          value: `${message.author.tag}\n\`${message.author.id}\``,
          inline: true,
        },
        {
          name: message.t("commands.report.field_date"),
          value: `<t:${Math.floor(Date.now() / 1000)}:F>`,
          inline: true,
        },
        {
          name: message.t("commands.report.field_reason"),
          value: reason,
          inline: false,
        },
      )
      .setFooter({
        text: message.t("commands.report.footer"),
      })
      .setTimestamp();

    if (modChannel) {
      modChannel.send({ embeds: [staffEmbed] }).catch(() => {});
      await message
        .reply({
          embeds: [
            client.embedBuilder.success(
              client,
              message.t("commands.report.sent"),
            ),
          ],
        })
        .catch(() => {});
    } else {
      await message
        .reply({
          embeds: [
            client.embedBuilder.warning(
              client,
              message.t("commands.report.no_mod_channel"),
            ),
          ],
        })
        .catch(() => {});
    }
  },
};
