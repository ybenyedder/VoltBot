const {
  PermissionsBitField,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
} = require("discord.js");
const permissions = require("../../utils/permissions");

module.exports = {
  name: "ticketdeloption",
  description: "Supprime une option du menu déroulant des tickets.",
  category: "tickets",
  usage: "+ticketdeloption <Titre_exact>",
  userPerms: [PermissionsBitField.Flags.Administrator],
  async execute(client, message, args) {
    if (!permissions.isAdmin(message, client))
      return message
        .reply({
          embeds: [
            client.embedBuilder.error(
              client,
              message.t("commands.ticketdeloption.permission_denied"),
            ),
          ],
        })
        .catch(() => {});

    if (args.length < 1) {
      return message
        .reply({
          embeds: [
            client.embedBuilder.error(
              client,
              message.t("commands.ticketdeloption.usage"),
            ),
          ],
        })
        .catch(() => {});
    }

    const title = args.join(" ");

    const opt = client.db.db
      .prepare(
        "SELECT * FROM ticket_options WHERE guildId = ? AND title COLLATE NOCASE = ?",
      )
      .get(message.guild.id, title);

    if (!opt) {
      return message
        .reply({
          embeds: [
            client.embedBuilder.error(
              client,
              message.t("commands.ticketdeloption.option_not_found"),
            ),
          ],
        })
        .catch(() => {});
    }

    let activeTickets = 0;
    try {
      const row = client.db.db
        .prepare(
          "SELECT COUNT(*) AS n FROM tickets WHERE guildId = ? AND status = 'open'",
        )
        .get(message.guild.id);
      activeTickets = row?.n || 0;
    } catch (e) {}

    const doDelete = async () => {
      const result = client.db.db
        .prepare(
          "DELETE FROM ticket_options WHERE guildId = ? AND title COLLATE NOCASE = ?",
        )
        .run(message.guild.id, title);
      return result.changes > 0;
    };

    if (activeTickets > 0) {
      const confirmRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`ticketdelopt_yes_${message.author.id}`)
          .setLabel(message.t("commands.ticketdeloption.btn_confirm"))
          .setStyle(ButtonStyle.Danger),
        new ButtonBuilder()
          .setCustomId(`ticketdelopt_no_${message.author.id}`)
          .setLabel(message.t("commands.ticketdeloption.btn_cancel"))
          .setStyle(ButtonStyle.Secondary),
      );

      const prompt = await message
        .reply({
          embeds: [
            client.embedBuilder
              .warning(
                client,
                message.t("commands.ticketdeloption.confirm_active_tickets", {
                  count: activeTickets,
                  title: opt.title,
                }),
              )
              .addFields(
                {
                  name: message.t("commands.ticketdeloption.field_option"),
                  value: `\`${opt.title}\``,
                  inline: true,
                },
                {
                  name: message.t("commands.ticketdeloption.field_action"),
                  value: message.t("commands.ticketdeloption.action_deletion"),
                  inline: true,
                },
                {
                  name: message.t("commands.ticketdeloption.field_moderator"),
                  value: `${message.author}`,
                  inline: true,
                },
              ),
          ],
          components: [confirmRow],
        })
        .catch(() => null);

      if (!prompt) return;

      const collector = prompt.createMessageComponentCollector({
        componentType: ComponentType.Button,
        time: 30_000,
        filter: (i) => i.user.id === message.author.id,
      });

      let decided = false;
      collector.on("collect", async (interaction) => {
        decided = true;
        if (interaction.customId === `ticketdelopt_no_${message.author.id}`) {
          await interaction
            .update({
              embeds: [
                client.embedBuilder.info(
                  client,
                  message.t("commands.ticketdeloption.deletion_cancelled"),
                ),
              ],
              components: [],
            })
            .catch(() => {});
          return collector.stop("cancelled");
        }

        const ok = await doDelete();
        await interaction
          .update({
            embeds: [
              ok
                ? client.embedBuilder
                    .success(
                      client,
                      message.t("commands.ticketdeloption.option_deleted"),
                    )
                    .addFields(
                      {
                        name: message.t(
                          "commands.ticketdeloption.field_option",
                        ),
                        value: `\`${opt.title}\``,
                        inline: true,
                      },
                      {
                        name: message.t(
                          "commands.ticketdeloption.field_action",
                        ),
                        value: message.t(
                          "commands.ticketdeloption.action_deletion",
                        ),
                        inline: true,
                      },
                      {
                        name: message.t(
                          "commands.ticketdeloption.field_moderator",
                        ),
                        value: `${message.author}`,
                        inline: true,
                      },
                    )
                : client.embedBuilder.error(
                    client,
                    message.t("commands.ticketdeloption.option_not_found"),
                  ),
            ],
            components: [],
          })
          .catch(() => {});
        collector.stop("done");
      });

      collector.on("end", async () => {
        if (!decided) {
          await prompt
            .edit({
              embeds: [
                client.embedBuilder.info(
                  client,
                  message.t("commands.ticketdeloption.confirmation_expired"),
                ),
              ],
              components: [],
            })
            .catch(() => {});
        }
      });
      return;
    }

    try {
      const ok = await doDelete();
      if (ok) {
        await message
          .reply({
            embeds: [
              client.embedBuilder
                .success(
                  client,
                  message.t("commands.ticketdeloption.option_deleted"),
                )
                .addFields(
                  {
                    name: message.t("commands.ticketdeloption.field_option"),
                    value: `\`${opt.title}\``,
                    inline: true,
                  },
                  {
                    name: message.t("commands.ticketdeloption.field_action"),
                    value: message.t(
                      "commands.ticketdeloption.action_deletion",
                    ),
                    inline: true,
                  },
                  {
                    name: message.t("commands.ticketdeloption.field_moderator"),
                    value: `${message.author}`,
                    inline: true,
                  },
                ),
            ],
          })
          .catch(() => {});
      } else {
        await message
          .reply({
            embeds: [
              client.embedBuilder.error(
                client,
                message.t("commands.ticketdeloption.option_not_found"),
              ),
            ],
          })
          .catch(() => {});
      }
    } catch (err) {
      await message
        .reply({
          embeds: [
            client.embedBuilder.error(
              client,
              message.t("commands.ticketdeloption.db_error"),
            ),
          ],
        })
        .catch(() => {});
    }
  },
};
