function buildEmbed(client, ts) {
  const fields = [];
  const flavors = [":d", ":D", ":t", ":T", ":f", ":F", ":R"];
  const names = ["d", "D", "t", "T", "f", "F", "R"];

  for (let i = 0; i < flavors.length; i++) {
    fields.push({
      name: `\`${names[i]}\``,
      value: `<t:${ts}${flavors[i]}>`,
      inline: true,
    });
  }

  fields.push({
    name: "Unix",
    value: `\`${ts}\``,
    inline: true,
  });

  return client.embedBuilder
    .base(client, `Timestamp ${ts}`)
    .addFields(...fields);
}

module.exports = {
  name: "timestamp",
  description: "Convertit une date en timestamp Discord",
  category: "utility",
  usage: "timestamp",
  async execute(client, message, args) {
    if (!args[0]) {
      const ts = Math.floor(Date.now() / 1000);
      return message
        .reply({ embeds: [buildEmbed(client, ts)] })
        .catch(() => {});
    }

    let timestamp;

    if (!isNaN(args[0]) && args[0].length >= 10) {
      timestamp = parseInt(args[0]);
      if (timestamp > 1000000000000) timestamp = Math.floor(timestamp / 1000);
    } else {
      const dateString = args.join(" ");

      const ddmmreg = /^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/;
      const match = dateString.match(ddmmreg);

      let date;
      if (match) {
        const day = parseInt(match[1]);
        const month = parseInt(match[2]) - 1;
        const year = parseInt(match[3]);
        date = new Date(year, month, day);
      } else {
        date = new Date(dateString);
      }

      if (isNaN(date.getTime())) {
        return message
          .reply({
            embeds: [
              client.embedBuilder.warning(
                client,
                message.t("commands.timestamp.invalid_date"),
              ),
            ],
          })
          .catch(() => {});
      }
      timestamp = Math.floor(date.getTime() / 1000);
    }

    await message
      .reply({ embeds: [buildEmbed(client, timestamp)] })
      .catch(() => {});
  },
};
