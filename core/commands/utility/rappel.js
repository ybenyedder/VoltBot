const ms = require("ms");

module.exports = {
  name: "rappel",
  aliases: ["remindme"],
  description: "Définit un rappel dans le temps (ex: 10m, 1h, 1d).",
  category: "utility",
  usage: "+rappel <durée> <message>",
  async execute(client, message, args) {
    const time = args[0];
    const text = args.slice(1).join(" ");

    if (!time || !text)
      return message
        .reply({
          embeds: [
            client.embedBuilder.warning(
              client,
              message.t("commands.rappel.invalid_format"),
            ),
          ],
        })
        .catch(() => {});

    const timeMs = ms(time);
    if (!timeMs)
      return message
        .reply({
          embeds: [
            client.embedBuilder.warning(
              client,
              message.t("commands.rappel.invalid_duration"),
            ),
          ],
        })
        .catch(() => {});
    if (timeMs > 2073600000)
      return message
        .reply({
          embeds: [
            client.embedBuilder.warning(client, message.t("commands.rappel.max_duration")),
          ],
        })
        .catch(() => {});

    const whenTs = Math.floor((Date.now() + timeMs) / 1000);

    const confirmEmbed = client.embedBuilder
      .base(client, message.t("commands.rappel.scheduled_title"))
      .addFields(
        { name: message.t("commands.rappel.field_when"), value: `<t:${whenTs}:f>`, inline: true },
        { name: message.t("commands.rappel.field_in"), value: `<t:${whenTs}:R>`, inline: true },
        { name: message.t("commands.rappel.field_message"), value: text.slice(0, 1024), inline: false },
      );

    await message.reply({ embeds: [confirmEmbed] }).catch(() => {});

    setTimeout(async () => {
      try {
        await message.author.send({
          embeds: [
            client.embedBuilder
              .base(client, message.t("commands.rappel.reminder_title"))
              .addFields({
                name: message.t("commands.rappel.field_message"),
                value: text.slice(0, 1024),
                inline: false,
              }),
          ],
        });
      } catch (e) {
        await message.channel
          .send({
            content: `<@${message.author.id}>`,
            embeds: [
              client.embedBuilder
                .base(client, message.t("commands.rappel.reminder_title"))
                .addFields({
                  name: message.t("commands.rappel.field_message"),
                  value: text.slice(0, 1024),
                  inline: false,
                }),
            ],
          })
          .catch(() => {});
      }
    }, timeMs);
  },
};
