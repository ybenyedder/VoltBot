const { PermissionFlagsBits } = require("discord.js");
const axios = require("axios");
const dns = require("dns").promises;

// Function to check if an IP address is private
const isPrivateIP = (ipAddress) => {
  const parts = ipAddress.split(".");
  if (parts.length !== 4) return false; // Not a valid IPv4 format for this check

  const ipNum =
    (parseInt(parts[0]) << 24) |
    (parseInt(parts[1]) << 16) |
    (parseInt(parts[2]) << 8) |
    parseInt(parts[3]);

  // 10.0.0.0/8
  if ((ipNum & 0xff000000) === 0x0a000000) return true;
  // 172.16.0.0/12
  if ((ipNum & 0xfff00000) === 0xac100000) return true;
  // 192.168.0.0/16
  if ((ipNum & 0xffff0000) === 0xc0a80000) return true;
  // 127.0.0.0/8 (localhost)
  if ((ipNum & 0xff000000) === 0x7f000000) return true;
  // 0.0.0.0/8 (current network)
  if ((ipNum & 0xff000000) === 0x00000000) return true;
  // 169.254.0.0/16 (APIPA)
  if ((ipNum & 0xffff0000) === 0xa9fe0000) return true;

  return false;
};

const fmtNumber = (n) => new Intl.NumberFormat("fr-FR").format(n);

module.exports = {
  name: "fivem",
  description: "Lien avec un serveur FiveM/RedM.",
  category: "config",
  usage: "+fivem <IP:Port / off>",
  userPerms: [PermissionFlagsBits.Administrator],
  async execute(client, message, args) {
    if (!args[0])
      return message
        .reply({
          embeds: [
            client.embedBuilder.error(
              client,
              message.t("commands.fivem.provide_ip"),
            ),
          ],
        })
        .catch(() => {});

    const gs = client.db.getGuild(message.guild.id) || {};
    const oldIp = gs.fivemIP || message.t("commands.fivem.none");

    if (args[0] === "off") {
      client.db.updateGuild(message.guild.id, { fivemIP: null });
      return message
        .reply({
          embeds: [
            client.embedBuilder
              .success(client, message.t("commands.fivem.link_disabled"))
              .addFields(
                { name: message.t("commands.fivem.field_status"), value: "**off**", inline: true },
                { name: message.t("commands.fivem.field_before"), value: `\`${oldIp}\``, inline: true },
              ),
          ],
        })
        .catch(() => {});
    }

    let ip = args[0];
    // Regex IPv4:Port ou hostname:Port — port optionnel.
    const ipRegex =
      /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)(?::\d{1,5})?$|^([a-zA-Z0-9-]+\.)+[a-zA-Z]{2,}(?::\d{1,5})?$/;

    if (!ipRegex.test(ip)) {
      return message
        .reply({
          embeds: [
            client.embedBuilder.error(
              client,
              message.t("commands.fivem.invalid_format"),
            ),
          ],
        })
        .catch(() => {});
    }

    if (!ip.includes(":")) {
      ip += ":30120";
    }

    const ipOnly = ip.split(":")[0];

    // Bloquer les IP privées pour éviter SSRF (incl. hostnames résolus localement).
    const isIPv4 = ipOnly.match(/^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$/);

    if (isIPv4) {
      if (isPrivateIP(ipOnly)) {
        return message
          .reply({
            embeds: [client.embedBuilder.error(client, message.t("commands.fivem.private_ip"))],
          })
          .catch(() => {});
      }
    } else {
      try {
        const addresses = await dns.resolve4(ipOnly).catch(() => []);
        for (const addr of addresses) {
          if (isPrivateIP(addr)) {
            return message
              .reply({
                embeds: [
                  client.embedBuilder
                    .error(client, message.t("commands.fivem.domain_private_ip"))
                    .addFields(
                      {
                        name: message.t("commands.fivem.field_domain"),
                        value: `\`${ipOnly}\``,
                        inline: true,
                      },
                      {
                        name: message.t("commands.fivem.field_ip"),
                        value: `\`${addr}\``,
                        inline: true,
                      },
                    ),
                ],
              })
              .catch(() => {});
          }
        }
      } catch (err) {
        client.logger?.warn(
          `[FIVEM] DNS resolution failed for ${ipOnly}: ${err.message}`,
        );
      }
    }

    try {
      const response = await axios.get(`http://${ip}/info.json`, {
        timeout: 5000,
      });
      if (response.data) {
        client.db.updateGuild(message.guild.id, { fivemIP: ip });
        let hostname = response.data.vars?.sv_hostname || message.t("commands.fivem.unknown");
        if (hostname.length > 100) hostname = hostname.slice(0, 97) + "...";
        const players =
          typeof response.data.clients === "number"
            ? response.data.clients
            : null;
        const maxPlayers =
          typeof response.data.sv_maxclients === "number"
            ? response.data.sv_maxclients
            : null;
        const platform =
          response.data.vars?.gamename || response.data.server || "FiveM";

        const fields = [
          { name: message.t("commands.fivem.field_status"), value: message.t("commands.fivem.status_linked"), inline: true },
          { name: message.t("commands.fivem.field_platform"), value: `\`${platform}\``, inline: true },
          { name: message.t("commands.fivem.field_ip"), value: `\`${ip}\``, inline: true },
          { name: message.t("commands.fivem.field_name"), value: hostname, inline: false },
        ];
        if (players !== null) {
          fields.push({
            name: message.t("commands.fivem.field_players"),
            value:
              maxPlayers !== null
                ? `**${fmtNumber(players)}**/${fmtNumber(maxPlayers)}`
                : `**${fmtNumber(players)}**`,
            inline: true,
          });
        }
        fields.push({
          name: message.t("commands.fivem.field_before"),
          value: `\`${oldIp}\``,
          inline: true,
        });

        const embed = client.embedBuilder
          .success(client, message.t("commands.fivem.server_linked"))
          .addFields(...fields);
        return message.reply({ embeds: [embed] }).catch(() => {});
      }
    } catch (err) {
      return message
        .reply({
          embeds: [
            client.embedBuilder
              .error(client, message.t("commands.fivem.server_unreachable"))
              .addFields({
                name: message.t("commands.fivem.field_target"),
                value: `\`${ip}\``,
                inline: true,
              }),
          ],
        })
        .catch(() => {});
    }
  },
};
