const { MessageFlags } = require("discord.js");
const embedBuilder = require("./embedBuilder");
const Logger = require("./logger");

const errorCache = new Map();
const ERROR_CACHE_TTL = 60000;

async function executeSafe(
  client,
  interactionOrMessage,
  commandName,
  executionContext,
) {
  try {
    await executionContext();
  } catch (error) {
    const guildId =
      interactionOrMessage?.guild?.id ||
      interactionOrMessage?.guildId ||
      "DM";
    const userId =
      interactionOrMessage?.user?.id ||
      interactionOrMessage?.author?.id ||
      interactionOrMessage?.member?.id ||
      "?";
    // Dedup key includes guild so the same error in two guilds is not suppressed,
    // and uses the full message (not just first 50 chars) to avoid collisions.
    const errorKey = `${commandName}|${guildId}|${error?.code || error?.message || error?.name || "unknown"}`;
    const now = Date.now();

    const lastLogged = errorCache.get(errorKey);
    if (!lastLogged || now - lastLogged > ERROR_CACHE_TTL) {
      Logger.error(
        `[CMD ${commandName}] guild=${guildId} user=${userId}:`,
        error?.stack || error,
      );
      errorCache.set(errorKey, now);
    }

    if (errorCache.size > 100) {
      for (const [key, time] of errorCache) {
        if (now - time > ERROR_CACHE_TTL) {
          errorCache.delete(key);
        }
      }
    }

    let errorMessage =
      "Une erreur inattendue est survenue lors de l'execution de cette commande.";

    if (error?.code === 50013) {
      errorMessage =
        "Je n'ai pas les permissions necessaires pour effectuer cette action.";
    } else if (error?.code === 50001) {
      errorMessage = "Je n'ai pas acces a ce salon.";
    } else if (error?.code === 10008) {
      errorMessage = "Le message n'existe plus.";
    } else if (error?.code === 10007) {
      errorMessage = "L'utilisateur n'existe plus sur ce serveur.";
    } else if (error?.code === 50035) {
      errorMessage = "Donnees invalides fournies a Discord.";
    } else if (error?.code === 429) {
      errorMessage =
        "Rate limit Discord atteint. Reessayez dans quelques secondes.";
    } else if (error?.code === "ECONNRESET" || error?.code === "ETIMEDOUT") {
      errorMessage = "Erreur de connexion. Reessayez dans quelques instants.";
    }

    const builder = client?.embedBuilder || embedBuilder;
    const errorEmbed = builder.error(client, errorMessage);

    try {
      if (
        typeof interactionOrMessage.isCommand === "function" ||
        interactionOrMessage.deferred !== undefined
      ) {
        if (interactionOrMessage.deferred || interactionOrMessage.replied) {
          await interactionOrMessage
            .editReply({
              embeds: [errorEmbed],
              flags: [MessageFlags.Ephemeral],
            })
            .catch(() => {});
        } else {
          await interactionOrMessage
            .reply({ embeds: [errorEmbed], flags: [MessageFlags.Ephemeral] })
            .catch(() => {});
        }
      } else if (interactionOrMessage.channel) {
        await interactionOrMessage
          .reply({ embeds: [errorEmbed] })
          .catch(() => {});
      }
    } catch (replyError) {
      if (process.env.DEBUG_MODE) {
        Logger.error(
          `[CMD ${commandName}] guild=${guildId} user=${userId} failed to send error reply:`,
          replyError?.message,
        );
      }
    }
  }
}

async function dbSafe(operation, fallback = null) {
  try {
    return await operation();
  } catch (error) {
    Logger.error("[DB] Database operation failed:", error?.message);
    return fallback;
  }
}

async function discordApiSafe(operation, retries = 2, delay = 1000) {
  for (let i = 0; i <= retries; i++) {
    try {
      return await operation();
    } catch (error) {
      if (
        error?.code === 50013 ||
        error?.code === 50001 ||
        error?.code === 10008
      ) {
        throw error;
      }

      if (i === retries) {
        throw error;
      }

      if (error?.code === 429) {
        const retryAfter = error?.retry_after || 5000;
        await new Promise((r) => setTimeout(r, retryAfter));
      } else {
        await new Promise((r) => setTimeout(r, delay * (i + 1)));
      }
    }
  }
}

module.exports = { executeSafe, dbSafe, discordApiSafe };
